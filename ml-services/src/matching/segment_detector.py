"""Meeting segment detection for form matching (PX-887 Phase 1 + Phase 2 NLP).

Detects boundaries between different parts of a meeting based on
vocabulary shifts. Industry-aware: nonprofit/tech meetings segment,
healthcare stays single-encounter.

Phase 2 adds IntentClassifier for better segment type detection.
"""

import time
from dataclasses import dataclass
from typing import TYPE_CHECKING, Optional

import structlog

from src.matching.types import (
    Segment,
    SegmentType,
    Signal,
    SegmentationResult,
)
from src.matching.signals import SignalDetector, SignalsConfig

if TYPE_CHECKING:
    from src.matching.nlp import IntentClassifier


logger = structlog.get_logger()


@dataclass
class SegmentConfig:
    """Configuration for segment detection."""

    # Minimum segment duration in seconds
    min_segment_duration: float = 60.0

    # Vocabulary shift threshold (0.0-1.0)
    # Higher = more significant shift required for boundary
    shift_threshold: float = 0.6

    # Number of signals to consider for shift detection
    window_size: int = 10

    # Maximum segments per meeting
    max_segments: int = 10

    # Industries that use single-encounter mode (no segmentation)
    single_encounter_industries: tuple[str, ...] = ("healthcare",)

    # Enable NLP-based intent classification
    enable_nlp: bool = True


# Vocabulary patterns for segment type detection
SEGMENT_VOCABULARY = {
    SegmentType.INTAKE: {
        "keywords": ["intake", "new client", "enrollment", "eligibility", "referral"],
        "patterns": [],
    },
    SegmentType.CASE_REVIEW: {
        "keywords": ["case review", "client update", "progress", "barriers", "goals"],
        "patterns": [],
    },
    SegmentType.CLIENT_SESSION: {
        "keywords": ["session", "appointment", "meeting with", "check-in"],
        "patterns": [],
    },
    SegmentType.TEAM_SYNC: {
        "keywords": ["team", "sync", "updates", "coverage", "pto", "schedule"],
        "patterns": [],
    },
    SegmentType.ADMIN: {
        "keywords": ["admin", "paperwork", "documentation", "compliance", "audit"],
        "patterns": [],
    },
    SegmentType.STANDUP: {
        "keywords": ["standup", "blockers", "yesterday", "today", "sprint"],
        "patterns": [],
    },
    SegmentType.RETROSPECTIVE: {
        "keywords": ["retro", "retrospective", "went well", "improve", "action items"],
        "patterns": [],
    },
    SegmentType.USER_INTERVIEW: {
        "keywords": ["user interview", "usability", "feedback", "prototype", "task"],
        "patterns": [],
    },
    SegmentType.CUSTOMER_CALL: {
        "keywords": ["customer", "support", "ticket", "issue", "resolution"],
        "patterns": [],
    },
    SegmentType.PATIENT_VISIT: {
        "keywords": ["patient", "visit", "chief complaint", "assessment", "plan"],
        "patterns": [],
    },
    SegmentType.CARE_HUDDLE: {
        "keywords": ["huddle", "care team", "handoff", "discharge", "rounds"],
        "patterns": [],
    },
}


class MeetingSegmentDetector:
    """Detects segments within meeting transcripts.

    Phase 1: Rule-based vocabulary shift detection.
    Phase 2: NLP-enhanced intent classification (optional).

    Segments represent distinct parts of a meeting that may need
    different forms.

    Industry-aware behavior:
    - Nonprofit/Tech: Segment meetings (sync -> case review -> supervision)
    - Healthcare: Single encounter mode (entire visit is one segment)
    """

    def __init__(
        self,
        config: Optional[SegmentConfig] = None,
        signal_detector: Optional[SignalDetector] = None,
        intent_classifier: Optional["IntentClassifier"] = None,
    ):
        """Initialize the segment detector.

        Args:
            config: Segment detection configuration
            signal_detector: Signal detector for vocabulary analysis
            intent_classifier: Optional NLP intent classifier (Phase 2)
        """
        self.config = config or SegmentConfig()
        self.signal_detector = signal_detector or SignalDetector()
        self._intent_classifier = intent_classifier
        self._nlp_available: Optional[bool] = None

        # Build segment vocabulary configs
        self._segment_configs = self._build_segment_configs()

    @property
    def nlp_available(self) -> bool:
        """Check if NLP intent classification is available."""
        if not self.config.enable_nlp:
            return False

        if self._nlp_available is None:
            try:
                from src.matching.nlp import IntentClassifier

                if self._intent_classifier is None:
                    self._intent_classifier = IntentClassifier()

                # Check if the underlying models are available
                self._nlp_available = (
                    self._intent_classifier.embedding_model is not None
                    and self._intent_classifier.embedding_model.available
                )

                if self._nlp_available:
                    logger.info("NLP intent classification enabled")
                else:
                    logger.info(
                        "NLP intent classification disabled - using rule-based fallback"
                    )
            except ImportError:
                self._nlp_available = False
                logger.debug("NLP module not available - using rule-based fallback")

        return self._nlp_available

    @property
    def intent_classifier(self) -> Optional["IntentClassifier"]:
        """Get the intent classifier if NLP is available."""
        if self.nlp_available:
            return self._intent_classifier
        return None

    def _build_segment_configs(self) -> dict[SegmentType, SignalsConfig]:
        """Build SignalsConfig for each segment type."""
        configs = {}
        for segment_type, vocab in SEGMENT_VOCABULARY.items():
            configs[segment_type] = SignalsConfig(
                keywords=vocab["keywords"],
                patterns=vocab["patterns"],
                weights={},
            )
        return configs

    def detect_segments(
        self,
        transcript: str,
        industry: Optional[str] = None,
        timestamps: Optional[list[tuple[float, float, str]]] = None,
    ) -> SegmentationResult:
        """Detect segments in a transcript.

        Args:
            transcript: Full transcript text
            industry: Optional industry for industry-aware behavior
            timestamps: Optional list of (start, end, text) tuples

        Returns:
            SegmentationResult with detected segments
        """
        start_time = time.perf_counter()

        # Check for single-encounter mode
        if industry and industry.lower() in self.config.single_encounter_industries:
            segment = self._create_single_encounter(transcript, timestamps)
            elapsed_ms = (time.perf_counter() - start_time) * 1000

            logger.info(
                "Single encounter mode - no segmentation",
                industry=industry,
                processing_time_ms=elapsed_ms,
            )

            return SegmentationResult(
                segments=[segment],
                total_segments=1,
                industry_behavior="single_encounter",
                processing_time_ms=elapsed_ms,
            )

        # Segment the transcript
        if timestamps:
            segments = self._segment_with_timestamps(transcript, timestamps)
        else:
            segments = self._segment_by_vocabulary(transcript)

        elapsed_ms = (time.perf_counter() - start_time) * 1000

        logger.info(
            "Detected meeting segments",
            segment_count=len(segments),
            industry=industry,
            processing_time_ms=elapsed_ms,
        )

        return SegmentationResult(
            segments=segments,
            total_segments=len(segments),
            industry_behavior="segment",
            processing_time_ms=elapsed_ms,
        )

    def _create_single_encounter(
        self,
        transcript: str,
        timestamps: Optional[list[tuple[float, float, str]]] = None,
    ) -> Segment:
        """Create a single segment for the entire encounter.

        Used for healthcare and other single-encounter industries.
        """
        # Detect segment type
        segment_type, confidence = self._classify_segment(transcript)

        # Get signals for the whole transcript
        signals = self._detect_segment_signals(transcript)

        # Calculate time bounds
        if timestamps:
            start_time = timestamps[0][0]
            end_time = timestamps[-1][1]
        else:
            start_time = 0.0
            end_time = 0.0

        return Segment(
            segment_index=0,
            start_time=start_time,
            end_time=end_time,
            segment_type=segment_type,
            confidence=confidence,
            text=transcript,
            signals=signals,
        )

    def _segment_by_vocabulary(self, transcript: str) -> list[Segment]:
        """Segment transcript based on vocabulary shifts.

        Simple Phase 1 implementation that splits on paragraph boundaries
        and analyzes vocabulary in each chunk.
        """
        # Split into chunks (paragraphs or fixed size)
        chunks = self._split_into_chunks(transcript)

        if len(chunks) <= 1:
            # Single chunk - return as one segment
            segment_type, confidence = self._classify_segment(transcript)
            signals = self._detect_segment_signals(transcript)

            return [
                Segment(
                    segment_index=0,
                    start_time=0.0,
                    end_time=0.0,
                    segment_type=segment_type,
                    confidence=confidence,
                    text=transcript,
                    signals=signals,
                )
            ]

        # Analyze vocabulary in each chunk
        chunk_types: list[tuple[SegmentType, float]] = []
        for chunk in chunks:
            segment_type, confidence = self._classify_segment(chunk)
            chunk_types.append((segment_type, confidence))

        # Detect boundaries where vocabulary shifts
        segments = []
        current_segment_start = 0
        current_type = chunk_types[0][0]
        current_text_parts = [chunks[0]]

        for i in range(1, len(chunks)):
            new_type, confidence = chunk_types[i]

            if new_type != current_type and confidence > self.config.shift_threshold:
                # Boundary detected - create segment
                segment_text = "\n".join(current_text_parts)
                signals = self._detect_segment_signals(segment_text)

                segments.append(
                    Segment(
                        segment_index=len(segments),
                        start_time=0.0,  # No timestamps available
                        end_time=0.0,
                        segment_type=current_type,
                        confidence=chunk_types[current_segment_start][1],
                        text=segment_text,
                        signals=signals,
                    )
                )

                # Start new segment
                current_segment_start = i
                current_type = new_type
                current_text_parts = [chunks[i]]

                # Check max segments
                if len(segments) >= self.config.max_segments - 1:
                    # Combine remaining chunks into final segment
                    remaining_text = "\n".join(chunks[i:])
                    final_type, final_confidence = self._classify_segment(remaining_text)
                    final_signals = self._detect_segment_signals(remaining_text)

                    segments.append(
                        Segment(
                            segment_index=len(segments),
                            start_time=0.0,
                            end_time=0.0,
                            segment_type=final_type,
                            confidence=final_confidence,
                            text=remaining_text,
                            signals=final_signals,
                        )
                    )
                    return segments
            else:
                # Continue current segment
                current_text_parts.append(chunks[i])

        # Add final segment
        if current_text_parts:
            segment_text = "\n".join(current_text_parts)
            signals = self._detect_segment_signals(segment_text)

            segments.append(
                Segment(
                    segment_index=len(segments),
                    start_time=0.0,
                    end_time=0.0,
                    segment_type=current_type,
                    confidence=chunk_types[current_segment_start][1],
                    text=segment_text,
                    signals=signals,
                )
            )

        return segments

    def _segment_with_timestamps(
        self,
        transcript: str,
        timestamps: list[tuple[float, float, str]],
    ) -> list[Segment]:
        """Segment transcript using timestamp information.

        More accurate segmentation when timestamps are available.
        """
        if not timestamps:
            return self._segment_by_vocabulary(transcript)

        # Group utterances into chunks based on time gaps and vocabulary
        segments = []
        current_segment_utterances: list[tuple[float, float, str]] = []
        current_type: Optional[SegmentType] = None

        for start, end, text in timestamps:
            # Classify this utterance
            utterance_type, confidence = self._classify_segment(text)

            if not current_segment_utterances:
                # First utterance
                current_segment_utterances.append((start, end, text))
                current_type = utterance_type
                continue

            # Check for boundary conditions
            should_split = False

            # Time gap check (> 30 seconds gap suggests topic change)
            last_end = current_segment_utterances[-1][1]
            if start - last_end > 30.0:
                should_split = True

            # Vocabulary shift check
            if utterance_type != current_type and confidence > self.config.shift_threshold:
                should_split = True

            if should_split and len(segments) < self.config.max_segments - 1:
                # Create segment from current utterances
                segment = self._create_segment_from_utterances(
                    current_segment_utterances,
                    current_type or SegmentType.UNKNOWN,
                    len(segments),
                )
                segments.append(segment)

                # Start new segment
                current_segment_utterances = [(start, end, text)]
                current_type = utterance_type
            else:
                # Continue current segment
                current_segment_utterances.append((start, end, text))

        # Add final segment
        if current_segment_utterances:
            segment = self._create_segment_from_utterances(
                current_segment_utterances,
                current_type or SegmentType.UNKNOWN,
                len(segments),
            )
            segments.append(segment)

        return segments

    def _create_segment_from_utterances(
        self,
        utterances: list[tuple[float, float, str]],
        segment_type: SegmentType,
        index: int,
    ) -> Segment:
        """Create a Segment from a list of utterances."""
        text = " ".join(u[2] for u in utterances)
        signals = self._detect_segment_signals(text)

        # Recalculate type confidence for combined text
        _, confidence = self._classify_segment(text)

        return Segment(
            segment_index=index,
            start_time=utterances[0][0],
            end_time=utterances[-1][1],
            segment_type=segment_type,
            confidence=confidence,
            text=text,
            signals=signals,
        )

    def _classify_segment(self, text: str) -> tuple[SegmentType, float]:
        """Classify a text segment into a segment type.

        Uses NLP intent classifier if available, falls back to rule-based.

        Returns the best matching type and confidence score.
        """
        if not text:
            return SegmentType.UNKNOWN, 0.0

        # Try NLP-based classification first
        if self.intent_classifier:
            nlp_result = self._classify_with_nlp(text)
            if nlp_result is not None:
                return nlp_result

        # Fall back to rule-based classification
        return self._classify_rule_based(text)

    def _classify_with_nlp(self, text: str) -> Optional[tuple[SegmentType, float]]:
        """Classify segment using NLP intent classifier.

        Args:
            text: Text to classify

        Returns:
            (SegmentType, confidence) or None if classification failed
        """
        if not self.intent_classifier:
            return None

        try:
            result = self.intent_classifier.classify(text, use_embeddings=True)

            # Convert intent to segment type
            segment_type = result.to_segment_type()

            if segment_type == SegmentType.UNKNOWN and result.confidence < 0.3:
                # Low confidence - fall back to rule-based
                return None

            logger.debug(
                "NLP segment classification",
                intent=result.intent.value,
                segment_type=segment_type.value,
                confidence=result.confidence,
                signals=len(result.supporting_signals),
            )

            return segment_type, result.confidence

        except Exception as e:
            logger.warning(
                "NLP classification failed, using rule-based fallback",
                error=str(e),
            )
            return None

    def _classify_rule_based(self, text: str) -> tuple[SegmentType, float]:
        """Classify segment using rule-based vocabulary matching.

        This is the Phase 1 implementation used as fallback.

        Args:
            text: Text to classify

        Returns:
            (SegmentType, confidence)
        """
        best_type = SegmentType.UNKNOWN
        best_score = 0.0

        for segment_type, config in self._segment_configs.items():
            result = self.signal_detector.detect_all(text, config)

            # Score based on weighted signals
            score = result.total_weight / (result.text_length / 100 + 1)

            if score > best_score:
                best_score = score
                best_type = segment_type

        # Normalize confidence
        confidence = min(1.0, best_score / 10)

        return best_type, confidence

    def _detect_segment_signals(self, text: str) -> list[Signal]:
        """Detect all signals in a segment using all vocabularies."""
        all_signals = []

        for config in self._segment_configs.values():
            result = self.signal_detector.detect_all(text, config)
            all_signals.extend(result.signals)

        # Deduplicate by position
        seen_positions: set[tuple[int, int]] = set()
        unique_signals = []

        for signal in all_signals:
            key = (signal.position, signal.length)
            if key not in seen_positions:
                seen_positions.add(key)
                unique_signals.append(signal)

        return unique_signals

    def _split_into_chunks(self, text: str, max_chunk_size: int = 500) -> list[str]:
        """Split text into chunks for analysis.

        Splits on paragraph boundaries when possible.
        """
        # Try paragraph split first
        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]

        if paragraphs:
            return paragraphs

        # Fall back to sentence-based splitting
        sentences = [s.strip() for s in text.split(". ") if s.strip()]

        if len(sentences) <= 3:
            return [text]

        # Group sentences into chunks
        chunks = []
        current_chunk = []
        current_length = 0

        for sentence in sentences:
            if current_length + len(sentence) > max_chunk_size and current_chunk:
                chunks.append(". ".join(current_chunk) + ".")
                current_chunk = [sentence]
                current_length = len(sentence)
            else:
                current_chunk.append(sentence)
                current_length += len(sentence)

        if current_chunk:
            chunks.append(". ".join(current_chunk) + ".")

        return chunks
