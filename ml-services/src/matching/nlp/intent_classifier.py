"""Intent classification for meeting segments (PX-887 Phase 2).

Classifies meeting segments into intent categories using a hybrid
approach combining keyword matching and semantic embeddings.
"""

import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

import structlog

from src.matching.nlp.embeddings import EmbeddingModel
from src.matching.types import SegmentType

logger = structlog.get_logger()


class MeetingIntent(str, Enum):
    """Meeting segment intent categories.

    Maps to form types and meeting segment types.
    """

    # Client/patient interactions
    INTAKE = "intake"
    CASE_REVIEW = "case_review"
    CLIENT_SESSION = "client_session"
    PATIENT_VISIT = "patient_visit"
    CUSTOMER_CALL = "customer_call"

    # Team coordination
    TEAM_SYNC = "team_sync"
    STANDUP = "standup"
    CARE_HUDDLE = "care_huddle"
    HANDOFF = "handoff"

    # Operational
    ADMIN = "admin"
    RETROSPECTIVE = "retrospective"
    PLANNING = "planning"

    # Research/feedback
    USER_INTERVIEW = "user_interview"
    FEEDBACK_SESSION = "feedback_session"

    # Catch-all
    UNKNOWN = "unknown"


# Keyword vocabulary for each intent
INTENT_KEYWORDS: dict[MeetingIntent, list[str]] = {
    MeetingIntent.INTAKE: [
        "intake",
        "new client",
        "new patient",
        "enrollment",
        "eligibility",
        "referral",
        "initial assessment",
        "first visit",
        "onboarding",
        "registration",
    ],
    MeetingIntent.CASE_REVIEW: [
        "case review",
        "case conference",
        "client update",
        "patient update",
        "progress review",
        "barriers",
        "goals",
        "treatment plan",
        "care plan",
        "staffing",
    ],
    MeetingIntent.CLIENT_SESSION: [
        "session",
        "appointment",
        "check-in",
        "follow-up",
        "counseling",
        "therapy",
        "one-on-one",
    ],
    MeetingIntent.PATIENT_VISIT: [
        "patient visit",
        "chief complaint",
        "assessment",
        "examination",
        "diagnosis",
        "treatment",
        "prescription",
        "discharge",
    ],
    MeetingIntent.CUSTOMER_CALL: [
        "customer call",
        "support call",
        "customer support",
        "help desk",
        "ticket",
        "issue",
        "resolution",
        "escalation",
    ],
    MeetingIntent.TEAM_SYNC: [
        "team sync",
        "team meeting",
        "sync up",
        "updates",
        "coverage",
        "pto",
        "schedule",
        "availability",
    ],
    MeetingIntent.STANDUP: [
        "standup",
        "stand-up",
        "daily",
        "scrum",
        "blockers",
        "yesterday",
        "today",
        "sprint",
    ],
    MeetingIntent.CARE_HUDDLE: [
        "huddle",
        "care huddle",
        "morning huddle",
        "care team",
        "handoff",
        "shift change",
        "rounds",
    ],
    MeetingIntent.HANDOFF: [
        "handoff",
        "hand-off",
        "transition",
        "shift change",
        "coverage",
        "taking over",
    ],
    MeetingIntent.ADMIN: [
        "admin",
        "administrative",
        "paperwork",
        "documentation",
        "compliance",
        "audit",
        "reporting",
    ],
    MeetingIntent.RETROSPECTIVE: [
        "retrospective",
        "retro",
        "went well",
        "improve",
        "action items",
        "lessons learned",
        "postmortem",
    ],
    MeetingIntent.PLANNING: [
        "planning",
        "sprint planning",
        "roadmap",
        "priorities",
        "grooming",
        "backlog",
        "estimation",
    ],
    MeetingIntent.USER_INTERVIEW: [
        "user interview",
        "user research",
        "usability",
        "prototype",
        "feedback",
        "user testing",
        "UX research",
    ],
    MeetingIntent.FEEDBACK_SESSION: [
        "feedback",
        "review",
        "performance",
        "1:1",
        "one on one",
        "coaching",
        "mentoring",
    ],
}


# Example sentences for embedding-based classification
INTENT_EXAMPLES: dict[MeetingIntent, list[str]] = {
    MeetingIntent.INTAKE: [
        "We're meeting with a new client today to complete their intake assessment.",
        "Let's go through the enrollment paperwork and verify eligibility.",
        "This is the initial visit to gather background information.",
    ],
    MeetingIntent.CASE_REVIEW: [
        "Let's review the progress on this case and discuss any barriers.",
        "We need to update the treatment plan based on recent developments.",
        "The client has made progress toward their goals this month.",
    ],
    MeetingIntent.CLIENT_SESSION: [
        "Thanks for coming in today for your session.",
        "Let's check in on how things have been going since we last met.",
        "How are you feeling about the progress we've made?",
    ],
    MeetingIntent.PATIENT_VISIT: [
        "What brings you in today? What's your chief complaint?",
        "I'm going to examine you and then we'll discuss treatment options.",
        "Based on the assessment, I'm prescribing the following.",
    ],
    MeetingIntent.TEAM_SYNC: [
        "Let's go around and share updates from each team.",
        "Who has PTO coming up that we need to plan coverage for?",
        "Any changes to the schedule we should be aware of?",
    ],
    MeetingIntent.STANDUP: [
        "What did you work on yesterday and what's planned for today?",
        "Any blockers we need to discuss?",
        "Let's keep this quick - just the highlights.",
    ],
    MeetingIntent.RETROSPECTIVE: [
        "What went well this sprint that we should continue doing?",
        "What could we improve for next time?",
        "Let's capture some action items from this discussion.",
    ],
    MeetingIntent.USER_INTERVIEW: [
        "We'd like to understand how you currently use this feature.",
        "Can you walk me through your typical workflow?",
        "What challenges do you face when trying to accomplish this task?",
    ],
}


@dataclass
class IntentSignal:
    """A signal supporting an intent classification."""

    signal_type: str  # "keyword", "embedding", "pattern"
    value: str  # The text that triggered the signal
    weight: float = 1.0  # Contribution to intent score


@dataclass
class IntentResult:
    """Result of intent classification."""

    intent: MeetingIntent
    confidence: float  # 0.0 to 1.0
    supporting_signals: list[IntentSignal] = field(default_factory=list)
    all_scores: dict[str, float] = field(default_factory=dict)  # All intents with scores
    processing_time_ms: float = 0.0

    def to_segment_type(self) -> SegmentType:
        """Convert to SegmentType for compatibility."""
        mapping = {
            MeetingIntent.INTAKE: SegmentType.INTAKE,
            MeetingIntent.CASE_REVIEW: SegmentType.CASE_REVIEW,
            MeetingIntent.CLIENT_SESSION: SegmentType.CLIENT_SESSION,
            MeetingIntent.PATIENT_VISIT: SegmentType.PATIENT_VISIT,
            MeetingIntent.CUSTOMER_CALL: SegmentType.CUSTOMER_CALL,
            MeetingIntent.TEAM_SYNC: SegmentType.TEAM_SYNC,
            MeetingIntent.STANDUP: SegmentType.STANDUP,
            MeetingIntent.CARE_HUDDLE: SegmentType.CARE_HUDDLE,
            MeetingIntent.ADMIN: SegmentType.ADMIN,
            MeetingIntent.RETROSPECTIVE: SegmentType.RETROSPECTIVE,
            MeetingIntent.USER_INTERVIEW: SegmentType.USER_INTERVIEW,
        }
        return mapping.get(self.intent, SegmentType.UNKNOWN)


class IntentClassifier:
    """Classifies meeting segments into intent categories.

    Uses a hybrid approach:
    1. Keyword matching for fast, interpretable classification
    2. Embedding similarity for semantic understanding

    Combines both scores with configurable weights.
    Falls back to keyword-only if embeddings are unavailable.
    """

    def __init__(
        self,
        embedding_model: Optional[EmbeddingModel] = None,
        keyword_weight: float = 0.6,
        embedding_weight: float = 0.4,
        min_confidence: float = 0.3,
    ):
        """Initialize the intent classifier.

        Args:
            embedding_model: Optional embedding model for semantic similarity
            keyword_weight: Weight for keyword-based scores (0.0-1.0)
            embedding_weight: Weight for embedding-based scores (0.0-1.0)
            min_confidence: Minimum confidence to return an intent
        """
        self._embedding_model = embedding_model
        self.keyword_weight = keyword_weight
        self.embedding_weight = embedding_weight
        self.min_confidence = min_confidence

        # Pre-compute keyword patterns for faster matching
        self._keyword_patterns: dict[MeetingIntent, set[str]] = {}
        for intent, keywords in INTENT_KEYWORDS.items():
            self._keyword_patterns[intent] = {kw.lower() for kw in keywords}

        # Cache for example embeddings
        self._example_embeddings_cached = False

    @property
    def embedding_model(self) -> Optional[EmbeddingModel]:
        """Get or create the embedding model."""
        if self._embedding_model is None:
            self._embedding_model = EmbeddingModel()
        return self._embedding_model

    def _cache_example_embeddings(self) -> None:
        """Pre-cache embeddings for intent examples."""
        if self._example_embeddings_cached:
            return

        if not self.embedding_model.available:
            return

        all_examples = []
        for examples in INTENT_EXAMPLES.values():
            all_examples.extend(examples)

        self.embedding_model.embed_batch(all_examples)
        self._example_embeddings_cached = True

        logger.debug(
            "Cached intent example embeddings",
            example_count=len(all_examples),
        )

    def classify(self, text: str, use_embeddings: bool = True) -> IntentResult:
        """Classify text into an intent category.

        Args:
            text: Text to classify
            use_embeddings: Whether to use embedding similarity

        Returns:
            IntentResult with classification and confidence
        """
        start_time = time.perf_counter()

        if not text:
            return IntentResult(
                intent=MeetingIntent.UNKNOWN,
                confidence=0.0,
                processing_time_ms=0.0,
            )

        # Get keyword scores
        keyword_scores, keyword_signals = self._score_keywords(text)

        # Get embedding scores if available and requested
        embedding_scores: dict[MeetingIntent, float] = {}
        embedding_signals: list[IntentSignal] = []

        if use_embeddings and self.embedding_model.available:
            self._cache_example_embeddings()
            embedding_scores, embedding_signals = self._score_embeddings(text)

        # Combine scores
        combined_scores = self._combine_scores(keyword_scores, embedding_scores)

        # Get best intent
        best_intent = MeetingIntent.UNKNOWN
        best_score = 0.0

        for intent, score in combined_scores.items():
            if score > best_score:
                best_score = score
                best_intent = intent

        # Check minimum confidence
        if best_score < self.min_confidence:
            best_intent = MeetingIntent.UNKNOWN
            best_score = 0.0

        # Gather supporting signals for best intent
        supporting_signals = []
        for signal in keyword_signals + embedding_signals:
            # Only include signals that contributed to the winning intent
            signal_intent = self._get_signal_intent(signal)
            if signal_intent == best_intent or signal_intent is None:
                supporting_signals.append(signal)

        elapsed_ms = (time.perf_counter() - start_time) * 1000

        return IntentResult(
            intent=best_intent,
            confidence=best_score,
            supporting_signals=supporting_signals,
            all_scores={i.value: s for i, s in combined_scores.items()},
            processing_time_ms=elapsed_ms,
        )

    def _score_keywords(
        self,
        text: str,
    ) -> tuple[dict[MeetingIntent, float], list[IntentSignal]]:
        """Score text against keyword patterns."""
        text_lower = text.lower()
        words = set(text_lower.split())

        scores: dict[MeetingIntent, float] = {}
        signals: list[IntentSignal] = []

        for intent, keywords in self._keyword_patterns.items():
            intent_score = 0.0

            for keyword in keywords:
                # Check for keyword presence
                if " " in keyword:
                    # Multi-word keyword - check substring
                    if keyword in text_lower:
                        weight = 1.5  # Multi-word matches are stronger
                        intent_score += weight
                        signals.append(
                            IntentSignal(
                                signal_type="keyword",
                                value=keyword,
                                weight=weight,
                            )
                        )
                else:
                    # Single word - check word set
                    if keyword in words:
                        weight = 1.0
                        intent_score += weight
                        signals.append(
                            IntentSignal(
                                signal_type="keyword",
                                value=keyword,
                                weight=weight,
                            )
                        )

            # Normalize score by number of keywords for this intent
            if keywords:
                scores[intent] = intent_score / len(keywords)
            else:
                scores[intent] = 0.0

        return scores, signals

    def _score_embeddings(
        self,
        text: str,
    ) -> tuple[dict[MeetingIntent, float], list[IntentSignal]]:
        """Score text using embedding similarity to intent examples."""
        scores: dict[MeetingIntent, float] = {}
        signals: list[IntentSignal] = []

        text_embedding = self.embedding_model.embed(text)
        if text_embedding is None:
            return scores, signals

        for intent, examples in INTENT_EXAMPLES.items():
            if not examples:
                scores[intent] = 0.0
                continue

            # Get similarity to each example
            similarities = []
            for example in examples:
                sim_result = self.embedding_model.compute_similarity(text, example)
                if sim_result:
                    similarities.append(sim_result.similarity)

            if similarities:
                # Use max similarity as the score
                max_sim = max(similarities)
                avg_sim = sum(similarities) / len(similarities)

                # Weighted combination favoring max
                score = 0.7 * max_sim + 0.3 * avg_sim

                scores[intent] = max(0.0, score)

                if score > 0.5:
                    signals.append(
                        IntentSignal(
                            signal_type="embedding",
                            value=f"semantic similarity to {intent.value}",
                            weight=score,
                        )
                    )
            else:
                scores[intent] = 0.0

        return scores, signals

    def _combine_scores(
        self,
        keyword_scores: dict[MeetingIntent, float],
        embedding_scores: dict[MeetingIntent, float],
    ) -> dict[MeetingIntent, float]:
        """Combine keyword and embedding scores."""
        combined: dict[MeetingIntent, float] = {}

        all_intents = set(keyword_scores.keys()) | set(embedding_scores.keys())

        for intent in all_intents:
            kw_score = keyword_scores.get(intent, 0.0)
            emb_score = embedding_scores.get(intent, 0.0)

            if embedding_scores:
                # Full hybrid scoring
                combined[intent] = (
                    self.keyword_weight * kw_score + self.embedding_weight * emb_score
                )
            else:
                # Keyword only
                combined[intent] = kw_score

        return combined

    def _get_signal_intent(self, signal: IntentSignal) -> Optional[MeetingIntent]:
        """Determine which intent a signal supports."""
        if signal.signal_type == "keyword":
            for intent, keywords in self._keyword_patterns.items():
                if signal.value.lower() in keywords:
                    return intent
        return None

    def classify_batch(
        self,
        texts: list[str],
        use_embeddings: bool = True,
    ) -> list[IntentResult]:
        """Classify multiple texts.

        Args:
            texts: Texts to classify
            use_embeddings: Whether to use embedding similarity

        Returns:
            List of IntentResults
        """
        return [self.classify(text, use_embeddings) for text in texts]

    def get_top_intents(
        self,
        text: str,
        n: int = 3,
        use_embeddings: bool = True,
    ) -> list[tuple[MeetingIntent, float]]:
        """Get top N most likely intents.

        Args:
            text: Text to classify
            n: Number of intents to return
            use_embeddings: Whether to use embedding similarity

        Returns:
            List of (intent, score) tuples, sorted by score descending
        """
        result = self.classify(text, use_embeddings)

        sorted_intents = sorted(
            result.all_scores.items(),
            key=lambda x: x[1],
            reverse=True,
        )

        return [
            (MeetingIntent(intent), score) for intent, score in sorted_intents[:n]
        ]
