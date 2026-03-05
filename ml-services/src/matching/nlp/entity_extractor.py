"""Named entity extraction for form matching (PX-887 Phase 2).

Extracts named entities from transcript text using spaCy NER.
Supports custom entity patterns for domain-specific identifiers
like case numbers and MRNs.
"""

import re
import time
from dataclasses import dataclass, field
from typing import Optional

import structlog

from src.matching.nlp.tokenizer import SpaCyTokenizer, Doc

logger = structlog.get_logger()


# Standard spaCy entity types we extract
STANDARD_ENTITY_TYPES = {
    "PERSON",  # People, including fictional
    "ORG",  # Companies, agencies, institutions
    "DATE",  # Dates or periods
    "MONEY",  # Monetary values
    "GPE",  # Geopolitical entities (countries, cities, states)
    "TIME",  # Times smaller than a day
    "PERCENT",  # Percentages
    "CARDINAL",  # Numerals not covered by another type
    "ORDINAL",  # "first", "second", etc.
    "QUANTITY",  # Measurements
}


# Custom entity patterns for domain-specific identifiers
CUSTOM_ENTITY_PATTERNS = {
    "CASE_NUMBER": [
        r"case\s*#?\s*(\d+)",
        r"case\s+number[:\s]+(\d+)",
        r"case\s+id[:\s]+(\d+)",
    ],
    "MRN": [
        r"MRN[:\s#]*(\d+)",
        r"medical\s+record\s+number[:\s]+(\d+)",
    ],
    "CLIENT_ID": [
        r"client\s*id[:\s#]+(\d+)",
        r"participant\s*id[:\s#]+(\d+)",
    ],
    "TICKET_ID": [
        r"([A-Z]{2,}-\d+)",  # JIRA-123, PROJ-456
        r"ticket[:\s#]+(\d+)",
    ],
    "SSN": [
        r"\b(\d{3}-\d{2}-\d{4})\b",  # SSN format
    ],
    "PHONE": [
        r"\b(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})\b",
        r"\((\d{3})\)\s*\d{3}[-.\s]?\d{4}",
    ],
    "EMAIL": [
        r"\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b",
    ],
    "ICD_CODE": [
        r"ICD[\-\s]?10[:\s]+([A-Z]\d+\.?\d*)",
        r"\b([A-Z]\d{2}\.?\d{0,2})\b",  # General ICD-10 format
    ],
}


@dataclass
class EntityMatch:
    """A matched entity from text.

    Represents a single named entity or custom pattern match.
    """

    type: str  # Entity type (PERSON, ORG, CASE_NUMBER, etc.)
    value: str  # The matched text
    normalized_value: str  # Normalized/cleaned value
    start_char: int  # Character offset
    end_char: int  # Character offset (exclusive)
    confidence: float = 1.0  # Confidence score (1.0 for pattern matches)
    source: str = "spacy"  # "spacy" or "pattern"
    metadata: dict = field(default_factory=dict)


@dataclass
class ExtractionResult:
    """Result of entity extraction."""

    entities: list[EntityMatch]
    entity_counts: dict[str, int]
    processing_time_ms: float


class EntityExtractor:
    """Extracts named entities using spaCy and custom patterns.

    Combines spaCy's NER with custom regex patterns for
    domain-specific identifiers like case numbers and MRNs.

    Uses lazy loading - spaCy is only loaded on first use.
    Falls back to pattern-only extraction if spaCy is unavailable.
    """

    def __init__(
        self,
        tokenizer: Optional[SpaCyTokenizer] = None,
        custom_patterns: Optional[dict[str, list[str]]] = None,
        include_standard_types: Optional[set[str]] = None,
    ):
        """Initialize the entity extractor.

        Args:
            tokenizer: SpaCy tokenizer instance (created if not provided)
            custom_patterns: Additional custom entity patterns
            include_standard_types: Which standard entity types to include
        """
        self._tokenizer = tokenizer
        self._custom_patterns = {**CUSTOM_ENTITY_PATTERNS}

        if custom_patterns:
            for ent_type, patterns in custom_patterns.items():
                if ent_type in self._custom_patterns:
                    self._custom_patterns[ent_type].extend(patterns)
                else:
                    self._custom_patterns[ent_type] = patterns

        self._include_types = include_standard_types or STANDARD_ENTITY_TYPES
        self._compiled_patterns: dict[str, list[re.Pattern]] = {}

        # Pre-compile patterns
        self._compile_patterns()

    @property
    def tokenizer(self) -> SpaCyTokenizer:
        """Get or create the tokenizer."""
        if self._tokenizer is None:
            self._tokenizer = SpaCyTokenizer()
        return self._tokenizer

    def _compile_patterns(self) -> None:
        """Pre-compile custom entity patterns."""
        for ent_type, patterns in self._custom_patterns.items():
            self._compiled_patterns[ent_type] = []
            for pattern in patterns:
                try:
                    compiled = re.compile(pattern, re.IGNORECASE)
                    self._compiled_patterns[ent_type].append(compiled)
                except re.error as e:
                    logger.warning(
                        "Invalid entity pattern",
                        entity_type=ent_type,
                        pattern=pattern,
                        error=str(e),
                    )

    def extract(
        self,
        text: str,
        lang: str = "en",
        include_spacy: bool = True,
        include_patterns: bool = True,
    ) -> ExtractionResult:
        """Extract entities from text.

        Args:
            text: Text to analyze
            lang: Language code for spaCy
            include_spacy: Whether to use spaCy NER
            include_patterns: Whether to use custom patterns

        Returns:
            ExtractionResult with all entities found
        """
        start_time = time.perf_counter()

        if not text:
            return ExtractionResult(
                entities=[],
                entity_counts={},
                processing_time_ms=0.0,
            )

        entities: list[EntityMatch] = []

        # Extract using spaCy if available
        if include_spacy:
            spacy_entities = self._extract_spacy(text, lang)
            entities.extend(spacy_entities)

        # Extract using custom patterns
        if include_patterns:
            pattern_entities = self._extract_patterns(text)
            entities.extend(pattern_entities)

        # Deduplicate overlapping entities (prefer spaCy for standard types)
        entities = self._deduplicate_entities(entities)

        # Count by type
        entity_counts: dict[str, int] = {}
        for ent in entities:
            entity_counts[ent.type] = entity_counts.get(ent.type, 0) + 1

        elapsed_ms = (time.perf_counter() - start_time) * 1000

        logger.debug(
            "Extracted entities",
            total=len(entities),
            counts=entity_counts,
            processing_time_ms=elapsed_ms,
        )

        return ExtractionResult(
            entities=entities,
            entity_counts=entity_counts,
            processing_time_ms=elapsed_ms,
        )

    def _extract_spacy(self, text: str, lang: str) -> list[EntityMatch]:
        """Extract entities using spaCy NER."""
        doc = self.tokenizer.tokenize(text, lang)

        if doc is None:
            return []

        entities = []
        for ent in doc.entities:
            if ent.label not in self._include_types:
                continue

            entities.append(
                EntityMatch(
                    type=ent.label,
                    value=ent.text,
                    normalized_value=ent.text.strip().lower(),
                    start_char=ent.start_char,
                    end_char=ent.end_char,
                    confidence=0.9,  # spaCy NER confidence (conservative estimate)
                    source="spacy",
                )
            )

        return entities

    def _extract_patterns(self, text: str) -> list[EntityMatch]:
        """Extract entities using custom regex patterns."""
        entities = []

        for ent_type, patterns in self._compiled_patterns.items():
            for pattern in patterns:
                for match in pattern.finditer(text):
                    # Use the first capturing group if available
                    if match.groups():
                        value = match.group(1)
                        # Adjust positions for the captured group
                        start = match.start(1)
                        end = match.end(1)
                    else:
                        value = match.group(0)
                        start = match.start()
                        end = match.end()

                    entities.append(
                        EntityMatch(
                            type=ent_type,
                            value=value,
                            normalized_value=value.strip().lower(),
                            start_char=start,
                            end_char=end,
                            confidence=1.0,  # Pattern matches are deterministic
                            source="pattern",
                            metadata={"pattern": pattern.pattern},
                        )
                    )

        return entities

    def _deduplicate_entities(
        self,
        entities: list[EntityMatch],
    ) -> list[EntityMatch]:
        """Remove overlapping entities.

        When entities overlap, prefer:
        1. Longer matches over shorter
        2. spaCy matches over pattern matches for same length
        3. First occurrence for ties
        """
        if len(entities) <= 1:
            return entities

        # Sort by start position, then by length (descending)
        sorted_entities = sorted(
            entities,
            key=lambda e: (e.start_char, -(e.end_char - e.start_char)),
        )

        result = []
        covered_ranges: list[tuple[int, int]] = []

        for ent in sorted_entities:
            # Check if this entity overlaps with any already selected
            overlaps = False
            for start, end in covered_ranges:
                if ent.start_char < end and ent.end_char > start:
                    overlaps = True
                    break

            if not overlaps:
                result.append(ent)
                covered_ranges.append((ent.start_char, ent.end_char))

        return result

    def extract_by_type(
        self,
        text: str,
        entity_types: set[str],
        lang: str = "en",
    ) -> list[EntityMatch]:
        """Extract only specific entity types.

        Args:
            text: Text to analyze
            entity_types: Set of entity types to extract
            lang: Language code

        Returns:
            List of matching entities
        """
        result = self.extract(text, lang)
        return [e for e in result.entities if e.type in entity_types]

    def extract_phi(self, text: str, lang: str = "en") -> list[EntityMatch]:
        """Extract potential PHI (Protected Health Information).

        Returns entities that could be PHI for compliance purposes.

        Args:
            text: Text to analyze
            lang: Language code

        Returns:
            List of potential PHI entities
        """
        phi_types = {
            "PERSON",
            "SSN",
            "PHONE",
            "EMAIL",
            "MRN",
            "DATE",  # Dates can be PHI in healthcare context
            "GPE",  # Addresses
        }

        return self.extract_by_type(text, phi_types, lang)

    def has_sensitive_entities(self, text: str, lang: str = "en") -> bool:
        """Check if text contains sensitive entities.

        Useful for quick PHI detection.

        Args:
            text: Text to check
            lang: Language code

        Returns:
            True if sensitive entities are found
        """
        phi_entities = self.extract_phi(text, lang)
        return len(phi_entities) > 0

    def add_custom_pattern(self, entity_type: str, pattern: str) -> bool:
        """Add a custom entity pattern at runtime.

        Args:
            entity_type: Entity type label
            pattern: Regex pattern

        Returns:
            True if pattern was added successfully
        """
        try:
            compiled = re.compile(pattern, re.IGNORECASE)

            if entity_type not in self._compiled_patterns:
                self._compiled_patterns[entity_type] = []
                self._custom_patterns[entity_type] = []

            self._compiled_patterns[entity_type].append(compiled)
            self._custom_patterns[entity_type].append(pattern)

            logger.debug(
                "Added custom entity pattern",
                entity_type=entity_type,
                pattern=pattern,
            )
            return True

        except re.error as e:
            logger.warning(
                "Invalid entity pattern",
                entity_type=entity_type,
                pattern=pattern,
                error=str(e),
            )
            return False
