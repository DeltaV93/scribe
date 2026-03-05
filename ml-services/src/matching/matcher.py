"""Form matching orchestrator (PX-887 Phase 1 + Phase 2 NLP).

Combines signal detection, confidence scoring, and segment detection
to match transcripts to forms. Phase 2 adds optional NLP enhancement.
"""

import time
from typing import TYPE_CHECKING, Optional
from uuid import UUID

import structlog

from src.matching.types import (
    ConfidenceLevel,
    FormCandidate,
    Match,
    MatchingContext,
    MatchResult,
    Segment,
    Signal,
)
from src.matching.signals import SignalDetector, SignalsConfig
from src.matching.confidence import ConfidenceScorer, ThresholdTier
from src.matching.segment_detector import MeetingSegmentDetector
from src.org_profile.industry_defaults import (
    merge_industry_signals,
    get_industry,
)

if TYPE_CHECKING:
    from src.matching.nlp import EmbeddingModel, EntityExtractor


logger = structlog.get_logger()


# NLP enhancement configuration
NLP_CONFIG = {
    # Weight for NLP semantic similarity score
    "semantic_similarity_weight": 0.3,
    # Weight for rule-based score
    "rule_based_weight": 0.7,
    # Minimum semantic similarity to boost confidence
    "min_semantic_similarity": 0.5,
    # Boost applied when semantic similarity is high
    "semantic_boost_max": 0.15,
}


class FormMatcher:
    """Orchestrates form matching for transcripts.

    Combines:
    - SignalDetector: Keyword and pattern detection
    - ConfidenceScorer: Score calculation and tier thresholds
    - MeetingSegmentDetector: Segment boundary detection
    - (Phase 2) NLP components for semantic enhancement

    Rule-based matching is always available. NLP enhancement is optional
    and gracefully degrades if models are not installed.
    """

    def __init__(
        self,
        signal_detector: Optional[SignalDetector] = None,
        confidence_scorer: Optional[ConfidenceScorer] = None,
        segment_detector: Optional[MeetingSegmentDetector] = None,
        enable_nlp: bool = True,
    ):
        """Initialize the form matcher.

        Args:
            signal_detector: Optional custom signal detector
            confidence_scorer: Optional custom confidence scorer
            segment_detector: Optional custom segment detector
            enable_nlp: Whether to enable NLP enhancement (Phase 2)
        """
        self.signal_detector = signal_detector or SignalDetector()
        self.confidence_scorer = confidence_scorer or ConfidenceScorer()
        self.segment_detector = segment_detector or MeetingSegmentDetector()

        # NLP components (lazy loaded)
        self._enable_nlp = enable_nlp
        self._embedding_model: Optional["EmbeddingModel"] = None
        self._entity_extractor: Optional["EntityExtractor"] = None
        self._nlp_available: Optional[bool] = None

    @property
    def nlp_available(self) -> bool:
        """Check if NLP components are available."""
        if not self._enable_nlp:
            return False

        if self._nlp_available is None:
            try:
                from src.matching.nlp import EmbeddingModel

                self._embedding_model = EmbeddingModel()
                self._nlp_available = self._embedding_model.available

                if self._nlp_available:
                    logger.info("NLP enhancement enabled for form matching")
                else:
                    logger.info(
                        "NLP enhancement disabled - sentence-transformers not available"
                    )
            except ImportError:
                self._nlp_available = False
                logger.info("NLP enhancement disabled - nlp module not available")

        return self._nlp_available

    @property
    def embedding_model(self) -> Optional["EmbeddingModel"]:
        """Get the embedding model if available."""
        if self.nlp_available:
            return self._embedding_model
        return None

    @property
    def entity_extractor(self) -> Optional["EntityExtractor"]:
        """Get the entity extractor (lazy loaded)."""
        if not self.nlp_available:
            return None

        if self._entity_extractor is None:
            try:
                from src.matching.nlp import EntityExtractor

                self._entity_extractor = EntityExtractor()
            except ImportError:
                pass

        return self._entity_extractor

    def match_forms(
        self,
        transcript: str,
        context: MatchingContext,
        timestamps: Optional[list[tuple[float, float, str]]] = None,
        use_nlp: Optional[bool] = None,
    ) -> list[MatchResult]:
        """Match a transcript to forms.

        The matching process:
        1. Load signals from context (industry defaults + org customizations)
        2. If segmentation enabled, detect segments
        3. For each segment (or whole transcript):
           a. Detect signals in text (rule-based)
           b. (Phase 2) Enhance with NLP if available
           c. Score each form candidate
           d. Apply risk tier thresholds
        4. Return ranked results

        Args:
            transcript: The transcript text to match
            context: Matching context with org settings and form candidates
            timestamps: Optional timestamps for segment detection
            use_nlp: Override NLP usage (None uses instance setting)

        Returns:
            List of MatchResult objects, ranked by confidence
        """
        start_time = time.perf_counter()

        # Determine if NLP should be used
        should_use_nlp = use_nlp if use_nlp is not None else self.nlp_available

        # Build signals config from context
        signals_config = self._build_signals_config(context)

        # Get all results
        all_results: list[MatchResult] = []

        # Check if segmentation is enabled and applicable
        if context.enable_segmentation and context.industry:
            segmentation_result = self.segment_detector.detect_segments(
                transcript,
                industry=context.industry,
                timestamps=timestamps,
            )

            # Match each segment
            for segment in segmentation_result.segments:
                segment_results = self._match_segment(
                    segment,
                    context,
                    signals_config,
                    use_nlp=should_use_nlp,
                )
                all_results.extend(segment_results)
        else:
            # Match entire transcript as single segment
            results = self._match_text(
                transcript,
                context,
                signals_config,
                use_nlp=should_use_nlp,
            )
            all_results.extend(results)

        # Sort by confidence and assign ranks
        all_results.sort(key=lambda r: r.confidence, reverse=True)
        for i, result in enumerate(all_results):
            result.rank = i + 1

        # Limit to max suggestions
        all_results = all_results[: context.max_suggestions]

        elapsed_ms = (time.perf_counter() - start_time) * 1000

        logger.info(
            "Form matching completed",
            org_id=str(context.org_id),
            industry=context.industry,
            result_count=len(all_results),
            top_confidence=all_results[0].confidence if all_results else 0,
            processing_time_ms=elapsed_ms,
            nlp_enabled=should_use_nlp,
        )

        return all_results

    def _build_signals_config(self, context: MatchingContext) -> SignalsConfig:
        """Build SignalsConfig from MatchingContext.

        Merges industry defaults with org customizations.
        """
        # Start with context signals (already merged in most cases)
        keywords = list(context.keywords)
        patterns = list(context.patterns)
        weights = dict(context.weights)

        # If context doesn't have signals, load from industry defaults
        if not keywords and context.industry:
            industry_signals = merge_industry_signals(
                context.industry,
                context.secondary_industry,
            )
            keywords = industry_signals.get("keywords", [])
            patterns = industry_signals.get("patterns", [])
            weights = industry_signals.get("weights", {})

        # Separate Spanish keywords
        spanish_keywords = [
            kw
            for kw in keywords
            if self._is_spanish_keyword(kw)
        ]

        return SignalsConfig(
            keywords=keywords,
            patterns=patterns,
            weights=weights,
            spanish_keywords=spanish_keywords,
        )

    def _is_spanish_keyword(self, keyword: str) -> bool:
        """Check if a keyword is likely Spanish."""
        spanish_chars = {"á", "é", "í", "ó", "ú", "ñ", "ü"}
        if any(c in keyword.lower() for c in spanish_chars):
            return True

        # Known Spanish keywords from industry defaults
        spanish_keywords = {
            "cliente",
            "participante",
            "inscripcion",
            "caso",
            "referido",
            "evaluacion",
            "servicio",
            "programa",
            "beneficio",
            "elegibilidad",
            "seguimiento",
            "paciente",
            "diagnostico",
            "tratamiento",
            "medicamento",
            "cita",
            "visita",
            "historia",
            "sintomas",
            "queja_principal",
            "alta",
        }
        return keyword.lower() in spanish_keywords

    def _match_segment(
        self,
        segment: Segment,
        context: MatchingContext,
        signals_config: SignalsConfig,
        use_nlp: bool = False,
    ) -> list[MatchResult]:
        """Match a single segment to forms."""
        results = self._match_text(
            segment.text,
            context,
            signals_config,
            segment_index=segment.segment_index,
            segment_type=segment.segment_type,
            use_nlp=use_nlp,
        )
        return results

    def _match_text(
        self,
        text: str,
        context: MatchingContext,
        signals_config: SignalsConfig,
        segment_index: Optional[int] = None,
        segment_type=None,
        use_nlp: bool = False,
    ) -> list[MatchResult]:
        """Match text against form candidates.

        Args:
            text: Text to match
            context: Matching context
            signals_config: Signal detection configuration
            segment_index: Optional segment index
            segment_type: Optional segment type
            use_nlp: Whether to use NLP enhancement

        Returns:
            List of MatchResult objects
        """
        # Detect signals in text (rule-based)
        detection_result = self.signal_detector.detect_all(text, signals_config)

        if not detection_result.signals:
            logger.debug(
                "No signals detected in text",
                text_length=len(text),
                segment_index=segment_index,
            )
            return []

        # Extract entities if NLP is enabled
        extracted_entities: list[Signal] = []
        if use_nlp and self.entity_extractor:
            extracted_entities = self._extract_entity_signals(text)

        results: list[MatchResult] = []

        # Score each form candidate
        for form in context.form_candidates:
            # Get threshold tier for this form
            tier = self.confidence_scorer.get_threshold_tier(
                org_id=context.org_id,
                model_id=None,  # Form matching doesn't use model IDs
                risk_overrides=context.risk_overrides,
            )

            # Score the form (rule-based)
            all_signals = detection_result.signals + extracted_entities
            confidence, matches = self.confidence_scorer.score_matches(
                signals=all_signals,
                form_id=form.form_id,
                form_name=form.form_name,
                primary_keywords=form.keywords,
            )

            # Apply NLP semantic enhancement if available
            semantic_boost = 0.0
            if use_nlp and self.embedding_model and form.keywords:
                semantic_boost = self._compute_semantic_boost(text, form)
                confidence = min(1.0, confidence + semantic_boost)

            # Check minimum threshold
            if confidence < context.min_confidence_threshold:
                continue

            # Get confidence level with tier adjustment
            confidence_level = self.confidence_scorer.get_confidence_level(
                confidence,
                tier,
            )

            scoring_breakdown = {
                "signal_count": len(matches),
                "keyword_matches": len([m for m in matches if m.signal.type == "keyword"]),
                "pattern_matches": len([m for m in matches if m.signal.type == "pattern"]),
                "entity_matches": len([m for m in matches if m.signal.type == "entity"]),
                "total_weight": detection_result.total_weight,
                "semantic_boost": semantic_boost,
                "nlp_enabled": use_nlp,
            }

            result = MatchResult(
                form_id=form.form_id,
                form_name=form.form_name,
                confidence=confidence,
                confidence_level=confidence_level,
                matched_signals=matches,
                segment_index=segment_index,
                segment_type=segment_type,
                scoring_breakdown=scoring_breakdown,
                processing_time_ms=detection_result.processing_time_ms,
            )
            results.append(result)

        # Sort by confidence
        results.sort(key=lambda r: r.confidence, reverse=True)

        return results

    def _extract_entity_signals(self, text: str) -> list[Signal]:
        """Extract named entities and convert to signals.

        Uses the entity extractor to find domain-specific identifiers
        like case numbers, MRNs, and client IDs.

        Args:
            text: Text to analyze

        Returns:
            List of entity-based signals
        """
        if not self.entity_extractor:
            return []

        try:
            result = self.entity_extractor.extract(
                text,
                include_spacy=True,
                include_patterns=True,
            )

            signals = []
            for entity in result.entities:
                signals.append(
                    Signal(
                        type="entity",
                        value=entity.value,
                        normalized_value=entity.normalized_value,
                        weight=entity.confidence,
                        position=entity.start_char,
                        length=entity.end_char - entity.start_char,
                        language="en",
                        metadata={
                            "entity_type": entity.type,
                            "source": entity.source,
                        },
                    )
                )

            return signals

        except Exception as e:
            logger.warning(
                "Error extracting entities",
                error=str(e),
            )
            return []

    def _compute_semantic_boost(
        self,
        text: str,
        form: FormCandidate,
    ) -> float:
        """Compute semantic similarity boost for a form.

        Uses embedding similarity between transcript text and
        form keywords/description to boost confidence.

        Args:
            text: Transcript text
            form: Form candidate to compare

        Returns:
            Confidence boost (0.0 to semantic_boost_max)
        """
        if not self.embedding_model or not form.keywords:
            return 0.0

        try:
            # Create form description from keywords
            form_description = " ".join(form.keywords)

            # Compute semantic similarity
            sim_result = self.embedding_model.compute_similarity(text, form_description)

            if sim_result is None:
                return 0.0

            similarity = sim_result.similarity

            # Only boost if similarity exceeds minimum threshold
            min_sim = NLP_CONFIG["min_semantic_similarity"]
            max_boost = NLP_CONFIG["semantic_boost_max"]

            if similarity < min_sim:
                return 0.0

            # Linear interpolation from min_sim to 1.0 -> 0.0 to max_boost
            boost = (similarity - min_sim) / (1.0 - min_sim) * max_boost

            logger.debug(
                "Computed semantic boost",
                form_name=form.form_name,
                similarity=similarity,
                boost=boost,
            )

            return boost

        except Exception as e:
            logger.warning(
                "Error computing semantic boost",
                form_name=form.form_name,
                error=str(e),
            )
            return 0.0

    def match_metadata(
        self,
        context: MatchingContext,
    ) -> list[MatchResult]:
        """Match based on metadata only (before transcript is available).

        Uses meeting title, attendees, and calendar metadata for
        early form suggestions.

        Args:
            context: Matching context with metadata

        Returns:
            List of preliminary MatchResult objects
        """
        start_time = time.perf_counter()

        if not context.meeting_title and not context.attendees:
            return []

        # Build text from metadata
        metadata_text_parts = []

        if context.meeting_title:
            metadata_text_parts.append(context.meeting_title)

        if context.attendees:
            metadata_text_parts.append(" ".join(context.attendees))

        if context.calendar_metadata:
            description = context.calendar_metadata.get("description", "")
            if description:
                metadata_text_parts.append(description)

        metadata_text = " ".join(metadata_text_parts)

        if not metadata_text.strip():
            return []

        # Build signals config
        signals_config = self._build_signals_config(context)

        # Match against metadata
        results = self._match_text(
            metadata_text,
            context,
            signals_config,
        )

        elapsed_ms = (time.perf_counter() - start_time) * 1000

        logger.info(
            "Metadata matching completed",
            org_id=str(context.org_id),
            result_count=len(results),
            processing_time_ms=elapsed_ms,
        )

        return results

    def detect_signals(
        self,
        text: str,
        context: MatchingContext,
    ) -> dict:
        """Detect signals in text without form matching.

        Useful for debugging or preview purposes.

        Args:
            text: Text to analyze
            context: Matching context for signal configuration

        Returns:
            Dictionary with detection results
        """
        signals_config = self._build_signals_config(context)
        result = self.signal_detector.detect_all(text, signals_config)

        return {
            "signals": [
                {
                    "type": s.type,
                    "value": s.value,
                    "normalized_value": s.normalized_value,
                    "weight": s.weight,
                    "position": s.position,
                    "language": s.language,
                }
                for s in result.signals
            ],
            "total_weight": result.total_weight,
            "keyword_count": result.keyword_count,
            "pattern_count": result.pattern_count,
            "processing_time_ms": result.processing_time_ms,
        }

    def calculate_confidence(
        self,
        text: str,
        context: MatchingContext,
        form_id: Optional[UUID] = None,
    ) -> dict:
        """Calculate confidence score for text.

        Args:
            text: Text to analyze
            context: Matching context
            form_id: Optional specific form to score against

        Returns:
            Dictionary with confidence details
        """
        signals_config = self._build_signals_config(context)
        result = self.signal_detector.detect_all(text, signals_config)

        confidence = self.confidence_scorer.calculate_confidence(
            result.signals,
            context,
        )

        # Get default tier
        tier = self.confidence_scorer.get_threshold_tier(
            org_id=context.org_id,
            risk_overrides=context.risk_overrides,
        )

        confidence_level = self.confidence_scorer.get_confidence_level(
            confidence,
            tier,
        )

        return {
            "confidence": confidence,
            "confidence_level": confidence_level.value,
            "threshold_tier": tier.risk_tier,
            "auto_apply_threshold": tier.auto_apply_threshold,
            "suggest_threshold": tier.suggest_threshold,
            "signal_count": len(result.signals),
            "would_auto_apply": confidence >= tier.auto_apply_threshold,
            "would_suggest": confidence >= tier.suggest_threshold,
        }
