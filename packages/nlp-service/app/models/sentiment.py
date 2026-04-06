"""
Sentiment Analysis using VADER.
PX-878: Tiered Content Classifier

Analyzes sentiment and categorizes as PERSONAL, PROFESSIONAL, or NEUTRAL.
"""

import logging

from app.schemas.sensitivity import SentimentSignal


logger = logging.getLogger(__name__)


# Keywords that suggest personal vs professional context
PERSONAL_KEYWORDS = {
    # Relationships
    "marriage", "married", "divorce", "divorced", "spouse", "husband", "wife",
    "boyfriend", "girlfriend", "dating", "relationship", "family", "kids",
    "children", "parents", "mom", "dad", "brother", "sister",

    # Emotions
    "stressed", "depressed", "anxious", "worried", "scared", "angry",
    "frustrated", "upset", "sad", "happy", "excited", "overwhelmed",
    "exhausted", "tired", "burned out", "burnout",

    # Health
    "sick", "illness", "hospital", "doctor", "therapy", "therapist",
    "medication", "diagnosis", "symptoms", "pain", "surgery",

    # Finance (personal)
    "debt", "broke", "bankruptcy", "foreclosure", "eviction",

    # Life events
    "funeral", "death", "pregnant", "baby", "moving", "vacation",
}

PROFESSIONAL_KEYWORDS = {
    # Work tasks
    "meeting", "deadline", "project", "report", "presentation", "schedule",
    "appointment", "follow-up", "followup", "check-in", "checkin",

    # Process
    "application", "enrollment", "intake", "assessment", "referral",
    "documentation", "form", "verify", "confirm", "update",

    # Business
    "client", "customer", "account", "service", "program", "benefit",
    "eligibility", "requirement", "policy", "procedure",
}


class SentimentAnalyzer:
    """
    Analyze sentiment using VADER and categorize context.
    """

    def __init__(self):
        self.analyzer = None
        self._load_analyzer()

    def _load_analyzer(self) -> None:
        """Load VADER sentiment analyzer."""
        try:
            from nltk.sentiment.vader import SentimentIntensityAnalyzer
            import nltk

            # Download VADER lexicon if not present
            try:
                nltk.data.find("sentiment/vader_lexicon.zip")
            except LookupError:
                nltk.download("vader_lexicon", quiet=True)

            self.analyzer = SentimentIntensityAnalyzer()
            logger.info("VADER sentiment analyzer loaded")

        except Exception as e:
            logger.error(f"Failed to load VADER: {e}")
            raise

    def analyze(self, text: str) -> SentimentSignal:
        """
        Analyze sentiment of text.

        Args:
            text: Input text

        Returns:
            SentimentSignal with scores and category
        """
        if not self.analyzer:
            return SentimentSignal(
                compound=0.0,
                positive=0.0,
                negative=0.0,
                neutral=1.0,
                category="NEUTRAL",
            )

        # Get VADER scores
        scores = self.analyzer.polarity_scores(text)

        # Determine category (PERSONAL/PROFESSIONAL/NEUTRAL)
        category = self._categorize_context(text, scores["compound"])

        return SentimentSignal(
            compound=scores["compound"],
            positive=scores["pos"],
            negative=scores["neg"],
            neutral=scores["neu"],
            category=category,
        )

    def _categorize_context(self, text: str, compound_score: float) -> str:
        """
        Categorize text as PERSONAL, PROFESSIONAL, or NEUTRAL.

        Uses keyword matching and sentiment scores.
        """
        text_lower = text.lower()

        # Count keyword matches
        personal_count = sum(1 for kw in PERSONAL_KEYWORDS if kw in text_lower)
        professional_count = sum(1 for kw in PROFESSIONAL_KEYWORDS if kw in text_lower)

        # Strong sentiment combined with personal keywords = PERSONAL
        if personal_count > 0 and abs(compound_score) > 0.3:
            return "PERSONAL"

        # More personal keywords than professional
        if personal_count > professional_count + 1:
            return "PERSONAL"

        # More professional keywords
        if professional_count > personal_count:
            return "PROFESSIONAL"

        # Very negative with no professional context = likely personal
        if compound_score < -0.5 and professional_count == 0:
            return "PERSONAL"

        # Default to neutral
        return "NEUTRAL"
