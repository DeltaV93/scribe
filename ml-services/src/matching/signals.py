"""Signal detection for form matching (PX-887 Phase 1).

Provides rule-based signal detection from text using keywords,
regex patterns, and configurable weights.
"""

import re
import time
from dataclasses import dataclass
from typing import Optional

import structlog

from src.matching.types import Signal, DetectionResult, Match


logger = structlog.get_logger()


@dataclass
class SignalsConfig:
    """Configuration for signal detection."""

    keywords: list[str]
    patterns: list[str]
    weights: dict[str, float]

    # Language detection
    spanish_keywords: Optional[list[str]] = None

    # Case sensitivity
    case_sensitive: bool = False

    # Minimum word length to consider
    min_keyword_length: int = 2


class SignalDetector:
    """Detects signals (keywords and patterns) in text.

    Phase 1 implementation uses rule-based detection:
    - Keyword matching with optional weights
    - Regex pattern matching for structured data (case#, MRN, etc.)
    - Spanish keyword support for LEP populations

    Phase 2 will add spaCy NLP integration.
    """

    # Pre-compiled word boundary regex for keyword matching
    _WORD_BOUNDARY_PATTERN = re.compile(r"\b", re.UNICODE)

    # Spanish character normalization
    _SPANISH_CHAR_MAP = {
        "á": "a",
        "é": "e",
        "í": "i",
        "ó": "o",
        "ú": "u",
        "ñ": "n",
        "ü": "u",
    }

    def __init__(self, config: Optional[SignalsConfig] = None):
        """Initialize the signal detector.

        Args:
            config: Optional default configuration. Can be overridden per-call.
        """
        self.default_config = config
        self._pattern_cache: dict[str, re.Pattern] = {}

    def detect_keywords(
        self,
        text: str,
        keywords: list[str],
        weights: Optional[dict[str, float]] = None,
        case_sensitive: bool = False,
    ) -> list[Signal]:
        """Detect keyword signals in text.

        Performs whole-word matching to avoid false positives.
        Supports weighted keywords for scoring.

        Args:
            text: The text to search
            keywords: List of keywords to match
            weights: Optional weight multipliers per keyword
            case_sensitive: Whether matching is case-sensitive

        Returns:
            List of detected Signal objects
        """
        if not text or not keywords:
            return []

        weights = weights or {}
        signals: list[Signal] = []

        # Normalize text for matching
        search_text = text if case_sensitive else text.lower()

        # Build a combined regex for all keywords (more efficient)
        # Escape special regex characters in keywords
        escaped_keywords = [re.escape(kw) for kw in keywords]

        for keyword in keywords:
            kw_search = keyword if case_sensitive else keyword.lower()
            escaped_kw = re.escape(kw_search)

            # Use word boundaries for whole-word matching
            pattern = rf"\b{escaped_kw}\b"

            try:
                # Get or compile pattern
                if pattern not in self._pattern_cache:
                    flags = 0 if case_sensitive else re.IGNORECASE
                    self._pattern_cache[pattern] = re.compile(pattern, flags | re.UNICODE)

                compiled = self._pattern_cache[pattern]

                for match in compiled.finditer(search_text):
                    # Detect language based on keyword characteristics
                    language = self._detect_keyword_language(keyword)

                    signals.append(
                        Signal(
                            type="keyword",
                            value=text[match.start() : match.end()],  # Original case
                            normalized_value=kw_search,
                            weight=weights.get(keyword, weights.get(kw_search, 1.0)),
                            position=match.start(),
                            length=match.end() - match.start(),
                            language=language,
                            metadata={"pattern": pattern},
                        )
                    )

            except re.error as e:
                logger.warning(
                    "Invalid keyword regex pattern",
                    keyword=keyword,
                    error=str(e),
                )

        return signals

    def detect_patterns(
        self,
        text: str,
        patterns: list[str],
        weights: Optional[dict[str, float]] = None,
    ) -> list[Signal]:
        """Detect regex pattern signals in text.

        Used for structured data like:
        - Case numbers: case#123, case 456
        - MRNs: MRN: 12345
        - Ticket IDs: JIRA-123, ticket#456
        - ICD codes: ICD-10: A00.1

        Args:
            text: The text to search
            patterns: List of regex patterns to match
            weights: Optional weight multipliers per pattern

        Returns:
            List of detected Signal objects
        """
        if not text or not patterns:
            return []

        weights = weights or {}
        signals: list[Signal] = []

        for pattern in patterns:
            try:
                # Get or compile pattern
                if pattern not in self._pattern_cache:
                    self._pattern_cache[pattern] = re.compile(
                        pattern, re.IGNORECASE | re.UNICODE
                    )

                compiled = self._pattern_cache[pattern]

                for match in compiled.finditer(text):
                    matched_text = match.group(0)

                    signals.append(
                        Signal(
                            type="pattern",
                            value=matched_text,
                            normalized_value=matched_text.lower(),
                            weight=weights.get(pattern, 1.0),
                            position=match.start(),
                            length=len(matched_text),
                            language="en",  # Patterns are typically English-based
                            metadata={
                                "pattern": pattern,
                                "groups": match.groups() if match.groups() else None,
                            },
                        )
                    )

            except re.error as e:
                logger.warning(
                    "Invalid regex pattern",
                    pattern=pattern,
                    error=str(e),
                )

        return signals

    def detect_all(
        self,
        text: str,
        config: Optional[SignalsConfig] = None,
    ) -> DetectionResult:
        """Detect all signals (keywords + patterns) in text.

        Args:
            text: The text to search
            config: Signal configuration (uses default if not provided)

        Returns:
            DetectionResult with all detected signals
        """
        start_time = time.perf_counter()

        cfg = config or self.default_config
        if not cfg:
            return DetectionResult(
                signals=[],
                total_weight=0.0,
                keyword_count=0,
                pattern_count=0,
                processing_time_ms=0.0,
                text_length=len(text) if text else 0,
            )

        # Detect keywords
        keyword_signals = self.detect_keywords(
            text,
            cfg.keywords,
            cfg.weights,
            cfg.case_sensitive,
        )

        # Detect Spanish keywords if provided
        if cfg.spanish_keywords:
            spanish_signals = self.detect_keywords(
                text,
                cfg.spanish_keywords,
                cfg.weights,
                cfg.case_sensitive,
            )
            keyword_signals.extend(spanish_signals)

        # Detect patterns
        pattern_signals = self.detect_patterns(
            text,
            cfg.patterns,
            cfg.weights,
        )

        # Combine and deduplicate by position
        all_signals = keyword_signals + pattern_signals
        all_signals = self._deduplicate_signals(all_signals)

        # Calculate total weight
        total_weight = sum(s.weight for s in all_signals)

        elapsed_ms = (time.perf_counter() - start_time) * 1000

        return DetectionResult(
            signals=all_signals,
            total_weight=total_weight,
            keyword_count=len([s for s in all_signals if s.type == "keyword"]),
            pattern_count=len([s for s in all_signals if s.type == "pattern"]),
            processing_time_ms=elapsed_ms,
            text_length=len(text) if text else 0,
        )

    def apply_weights(
        self,
        matches: list[Match],
        weights: dict[str, float],
    ) -> list[Match]:
        """Apply weight multipliers to a list of matches.

        Updates the signal weights and recalculates score contributions.

        Args:
            matches: List of Match objects to update
            weights: Weight multipliers by keyword/pattern

        Returns:
            Updated list of Match objects
        """
        for match in matches:
            key = match.signal.normalized_value
            if key in weights:
                match.signal.weight = weights[key]
                # Recalculate contribution based on new weight
                match.score_contribution = match.signal.weight * (
                    1.5 if match.is_primary else 1.0
                )

        return matches

    def _detect_keyword_language(self, keyword: str) -> str:
        """Detect the likely language of a keyword.

        Simple heuristic based on character patterns.

        Args:
            keyword: The keyword to analyze

        Returns:
            Language code ("en" or "es")
        """
        # Check for Spanish-specific characters
        spanish_chars = {"á", "é", "í", "ó", "ú", "ñ", "ü", "¿", "¡"}
        if any(c in keyword.lower() for c in spanish_chars):
            return "es"

        # Common Spanish keywords
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
        if keyword.lower() in spanish_keywords:
            return "es"

        return "en"

    def _deduplicate_signals(self, signals: list[Signal]) -> list[Signal]:
        """Remove duplicate signals at the same position.

        When multiple patterns match the same text, keep the one with
        the highest weight.

        Args:
            signals: List of signals to deduplicate

        Returns:
            Deduplicated list of signals
        """
        if not signals:
            return []

        # Group by (position, length)
        position_map: dict[tuple[int, int], Signal] = {}

        for signal in signals:
            key = (signal.position, signal.length)
            if key not in position_map:
                position_map[key] = signal
            else:
                # Keep the one with higher weight
                if signal.weight > position_map[key].weight:
                    position_map[key] = signal

        return sorted(position_map.values(), key=lambda s: s.position)

    def normalize_spanish_text(self, text: str) -> str:
        """Normalize Spanish text for matching.

        Converts accented characters to their base forms.

        Args:
            text: Text to normalize

        Returns:
            Normalized text
        """
        result = text.lower()
        for accented, base in self._SPANISH_CHAR_MAP.items():
            result = result.replace(accented, base)
        return result

    def clear_cache(self) -> None:
        """Clear the compiled pattern cache."""
        self._pattern_cache.clear()
