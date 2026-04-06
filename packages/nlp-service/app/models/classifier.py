"""
Tier Classifier: Main classification logic.
PX-878: Tiered Content Classifier

Combines multiple signals (NER, sentiment, taxonomy) to classify
transcript segments into sensitivity tiers.
"""

import logging
from typing import Optional

from app.schemas.sensitivity import (
    SensitivityTier,
    SensitivityCategory,
    SegmentSignals,
    EntitySignal,
    SentimentSignal,
    TaxonomySignal,
)
from app.models.ner import NERExtractor
from app.models.sentiment import SentimentAnalyzer
from app.utils.taxonomy import TaxonomyMatcher


logger = logging.getLogger(__name__)


# Signal weights for combining multiple signals
SIGNAL_WEIGHTS = {
    "taxonomy": 0.40,      # Highest weight for explicit pattern matches
    "sentiment": 0.25,     # Emotional content indicator
    "entities": 0.20,      # PHI and named entity signals
    "context": 0.15,       # Speaker and contextual signals
}


class TierClassifier:
    """
    Main classifier that combines NER, sentiment, and taxonomy signals
    to classify transcript segments into sensitivity tiers.
    """

    def __init__(self):
        self.ner: Optional[NERExtractor] = None
        self.sentiment: Optional[SentimentAnalyzer] = None
        self.taxonomy: Optional[TaxonomyMatcher] = None
        self.version = "v1.0.0"
        self.is_loaded = False

    def load_models(self) -> None:
        """Load all component models."""
        try:
            logger.info("Loading NER model...")
            self.ner = NERExtractor()

            logger.info("Loading sentiment analyzer...")
            self.sentiment = SentimentAnalyzer()

            logger.info("Loading taxonomy matcher...")
            self.taxonomy = TaxonomyMatcher()

            self.is_loaded = True
            logger.info("All models loaded successfully")

        except Exception as e:
            logger.error(f"Error loading models: {e}")
            # Fall back to rule-based classification
            self.ner = None
            self.sentiment = SentimentAnalyzer()  # VADER is lightweight
            self.taxonomy = TaxonomyMatcher()
            self.is_loaded = True  # Can still classify with reduced accuracy
            logger.warning("Running with reduced model set")

    def classify(
        self,
        text: str,
        speaker: Optional[str] = None,
    ) -> tuple[SensitivityTier, float, Optional[SensitivityCategory], SegmentSignals]:
        """
        Classify a text segment into a sensitivity tier.

        Args:
            text: The text to classify
            speaker: Optional speaker label (AGENT/CLIENT)

        Returns:
            Tuple of (tier, confidence, category, signals)
        """
        if not text or not text.strip():
            return (
                SensitivityTier.STANDARD,
                1.0,
                None,
                self._empty_signals(),
            )

        # Extract signals
        entity_signals = self._extract_entities(text)
        sentiment_signal = self._analyze_sentiment(text)
        taxonomy_signals = self._match_taxonomy(text)

        # Build signals object
        signals = SegmentSignals(
            entities=entity_signals,
            sentiment=sentiment_signal,
            taxonomy=taxonomy_signals,
        )

        # Calculate tier and confidence
        tier, confidence, category = self._combine_signals(
            entity_signals=entity_signals,
            sentiment_signal=sentiment_signal,
            taxonomy_signals=taxonomy_signals,
            speaker=speaker,
        )

        return tier, confidence, category, signals

    def _extract_entities(self, text: str) -> list[EntitySignal]:
        """Extract named entities from text."""
        if self.ner is None:
            return []

        try:
            return self.ner.extract(text)
        except Exception as e:
            logger.warning(f"NER extraction failed: {e}")
            return []

    def _analyze_sentiment(self, text: str) -> SentimentSignal:
        """Analyze sentiment of text."""
        if self.sentiment is None:
            return SentimentSignal(
                compound=0.0,
                positive=0.0,
                negative=0.0,
                neutral=1.0,
                category="NEUTRAL",
            )

        try:
            return self.sentiment.analyze(text)
        except Exception as e:
            logger.warning(f"Sentiment analysis failed: {e}")
            return SentimentSignal(
                compound=0.0,
                positive=0.0,
                negative=0.0,
                neutral=1.0,
                category="NEUTRAL",
            )

    def _match_taxonomy(self, text: str) -> list[TaxonomySignal]:
        """Match text against sensitivity taxonomy."""
        if self.taxonomy is None:
            return []

        try:
            return self.taxonomy.match(text)
        except Exception as e:
            logger.warning(f"Taxonomy matching failed: {e}")
            return []

    def _combine_signals(
        self,
        entity_signals: list[EntitySignal],
        sentiment_signal: SentimentSignal,
        taxonomy_signals: list[TaxonomySignal],
        speaker: Optional[str],
    ) -> tuple[SensitivityTier, float, Optional[SensitivityCategory]]:
        """
        Combine all signals to determine final tier and confidence.

        Signal combination logic:
        1. If any taxonomy pattern matches REDACTED with high score → REDACTED
        2. If any taxonomy pattern matches RESTRICTED with high score → RESTRICTED
        3. If sentiment is highly personal + negative → lean REDACTED
        4. If high-sensitivity entities present → boost RESTRICTED confidence
        5. If speaker=CLIENT + emotional → boost sensitivity
        """
        # Start with STANDARD
        tier = SensitivityTier.STANDARD
        confidence = 0.85  # Base confidence
        category = None

        # Check taxonomy signals (highest priority)
        for tax_signal in sorted(taxonomy_signals, key=lambda x: x.score, reverse=True):
            if tax_signal.score >= 0.7:
                if tax_signal.tier == SensitivityTier.REDACTED:
                    tier = SensitivityTier.REDACTED
                    confidence = min(0.95, tax_signal.score)
                    category = self._category_from_taxonomy(tax_signal.category)
                    break
                elif tax_signal.tier == SensitivityTier.RESTRICTED:
                    if tier != SensitivityTier.REDACTED:
                        tier = SensitivityTier.RESTRICTED
                        confidence = min(0.90, tax_signal.score)
                        category = self._category_from_taxonomy(tax_signal.category)

        # Adjust based on sentiment
        if sentiment_signal.category == "PERSONAL":
            if sentiment_signal.compound < -0.3:  # Negative personal content
                if tier == SensitivityTier.STANDARD:
                    tier = SensitivityTier.REDACTED
                    confidence = 0.7  # Lower confidence for sentiment-only detection
                    category = SensitivityCategory.PERSONAL_OFF_TOPIC
                elif tier == SensitivityTier.REDACTED:
                    confidence = min(confidence + 0.1, 0.95)

        # Adjust based on entities
        high_sensitivity_entities = [e for e in entity_signals if e.sensitivity == "HIGH"]
        if high_sensitivity_entities:
            if tier == SensitivityTier.STANDARD:
                tier = SensitivityTier.RESTRICTED
                confidence = 0.75
                category = SensitivityCategory.HEALTH_SENSITIVE  # Default for high-sensitivity entities
            elif tier != SensitivityTier.REDACTED:
                confidence = min(confidence + 0.05, 0.95)

        # Speaker context adjustment
        if speaker == "CLIENT" and sentiment_signal.compound < -0.2:
            # Client expressing negative emotion - more likely personal
            if tier == SensitivityTier.STANDARD:
                confidence *= 0.9  # Reduce confidence, might need review

        return tier, confidence, category

    def _category_from_taxonomy(self, taxonomy_category: str) -> Optional[SensitivityCategory]:
        """Map taxonomy category to SensitivityCategory enum."""
        mapping = {
            "personal_struggles": SensitivityCategory.PERSONAL_OFF_TOPIC,
            "gossip": SensitivityCategory.PERSONAL_OFF_TOPIC,
            "off_topic": SensitivityCategory.PERSONAL_OFF_TOPIC,
            "hr_sensitive": SensitivityCategory.HR_SENSITIVE,
            "legal": SensitivityCategory.LEGAL_SENSITIVE,
            "health": SensitivityCategory.HEALTH_SENSITIVE,
            "financial": SensitivityCategory.FINANCIAL_SENSITIVE,
            "strategic": SensitivityCategory.FINANCIAL_SENSITIVE,
        }
        return mapping.get(taxonomy_category)

    def _empty_signals(self) -> SegmentSignals:
        """Return empty signals for empty text."""
        return SegmentSignals(
            entities=[],
            sentiment=SentimentSignal(
                compound=0.0,
                positive=0.0,
                negative=0.0,
                neutral=1.0,
                category="NEUTRAL",
            ),
            taxonomy=[],
        )
