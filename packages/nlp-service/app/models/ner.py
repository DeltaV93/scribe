"""
Named Entity Recognition using spaCy.
PX-878: Tiered Content Classifier

Extracts entities from text and assigns sensitivity levels.
"""

import logging
from typing import Optional

from app.schemas.sensitivity import EntitySignal


logger = logging.getLogger(__name__)


# Entity types and their sensitivity levels
ENTITY_SENSITIVITY = {
    # High sensitivity - PHI identifiers
    "PERSON": "MEDIUM",       # Names - context dependent
    "SSN": "HIGH",            # Custom entity for SSN patterns
    "MEDICAL": "HIGH",        # Custom entity for medical terms

    # Medium sensitivity
    "ORG": "LOW",
    "GPE": "LOW",             # Geo-political entities (cities, countries)
    "LOC": "LOW",             # Locations
    "DATE": "LOW",
    "TIME": "LOW",
    "MONEY": "MEDIUM",        # Financial amounts
    "CARDINAL": "LOW",        # Numbers
    "ORDINAL": "LOW",
    "PERCENT": "LOW",

    # Low sensitivity
    "PRODUCT": "LOW",
    "EVENT": "LOW",
    "WORK_OF_ART": "LOW",
    "LAW": "MEDIUM",          # Legal references
    "LANGUAGE": "LOW",
    "FAC": "LOW",             # Facilities
    "NORP": "LOW",            # Nationalities, religious/political groups
}


class NERExtractor:
    """
    Extract named entities from text using spaCy.
    """

    def __init__(self):
        self.nlp = None
        self._load_model()

    def _load_model(self) -> None:
        """Load spaCy model."""
        try:
            import spacy
            self.nlp = spacy.load("en_core_web_lg")
            logger.info("spaCy model loaded: en_core_web_lg")
        except Exception as e:
            logger.error(f"Failed to load spaCy model: {e}")
            raise

    def extract(self, text: str) -> list[EntitySignal]:
        """
        Extract entities from text.

        Args:
            text: Input text

        Returns:
            List of EntitySignal objects
        """
        if not self.nlp:
            return []

        doc = self.nlp(text)
        entities = []

        for ent in doc.ents:
            sensitivity = ENTITY_SENSITIVITY.get(ent.label_, "LOW")

            # Boost sensitivity for certain patterns
            if ent.label_ == "PERSON":
                # Check if it's in a sensitive context
                context = text[max(0, ent.start_char - 50):ent.end_char + 50].lower()
                if any(word in context for word in ["patient", "client", "victim", "diagnosis"]):
                    sensitivity = "HIGH"

            entities.append(EntitySignal(
                text=ent.text,
                label=ent.label_,
                start=ent.start_char,
                end=ent.end_char,
                sensitivity=sensitivity,
            ))

        # Custom pattern matching for SSN-like patterns
        import re
        ssn_pattern = r'\b\d{3}[-]?\d{2}[-]?\d{4}\b'
        for match in re.finditer(ssn_pattern, text):
            entities.append(EntitySignal(
                text=match.group(),
                label="SSN",
                start=match.start(),
                end=match.end(),
                sensitivity="HIGH",
            ))

        return entities
