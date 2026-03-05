"""Unit tests for signal detection (PX-887 Phase 1)."""

import pytest

from src.matching.signals import SignalDetector, SignalsConfig
from src.matching.types import Signal


class TestSignalDetector:
    """Tests for the SignalDetector class."""

    @pytest.fixture
    def detector(self) -> SignalDetector:
        """Create a signal detector instance."""
        return SignalDetector()

    @pytest.fixture
    def sample_config(self) -> SignalsConfig:
        """Create a sample signals configuration."""
        return SignalsConfig(
            keywords=["client", "intake", "assessment", "referral"],
            patterns=[
                r"case\s+#?\d+",
                r"client\s+id[:\s]+\d+",
            ],
            weights={
                "client": 1.5,
                "intake": 1.3,
                "assessment": 1.2,
            },
        )


class TestKeywordDetection(TestSignalDetector):
    """Tests for keyword detection."""

    def test_detect_single_keyword(self, detector: SignalDetector):
        """Test detecting a single keyword."""
        text = "The client arrived for their appointment."
        signals = detector.detect_keywords(text, ["client"])

        assert len(signals) == 1
        assert signals[0].type == "keyword"
        assert signals[0].value == "client"
        assert signals[0].normalized_value == "client"

    def test_detect_multiple_keywords(self, detector: SignalDetector):
        """Test detecting multiple keywords."""
        text = "During the intake, the client completed their assessment."
        signals = detector.detect_keywords(text, ["intake", "client", "assessment"])

        assert len(signals) == 3
        values = {s.normalized_value for s in signals}
        assert values == {"intake", "client", "assessment"}

    def test_keyword_case_insensitive(self, detector: SignalDetector):
        """Test that keyword detection is case-insensitive by default."""
        text = "The CLIENT arrived for their Intake appointment."
        signals = detector.detect_keywords(text, ["client", "intake"])

        assert len(signals) == 2
        # Original case should be preserved in value
        assert any(s.value == "CLIENT" for s in signals)
        assert any(s.value == "Intake" for s in signals)

    def test_keyword_case_sensitive(self, detector: SignalDetector):
        """Test case-sensitive keyword detection."""
        text = "The CLIENT arrived for their Intake appointment."
        signals = detector.detect_keywords(
            text, ["client", "intake"], case_sensitive=True
        )

        # Should not match because of case mismatch
        assert len(signals) == 0

    def test_keyword_with_weights(self, detector: SignalDetector):
        """Test that weights are applied correctly."""
        text = "The client completed their intake assessment."
        weights = {"client": 1.5, "intake": 1.3}
        signals = detector.detect_keywords(text, ["client", "intake"], weights=weights)

        assert len(signals) == 2
        client_signal = next(s for s in signals if s.normalized_value == "client")
        intake_signal = next(s for s in signals if s.normalized_value == "intake")

        assert client_signal.weight == 1.5
        assert intake_signal.weight == 1.3

    def test_keyword_whole_word_matching(self, detector: SignalDetector):
        """Test that keywords match whole words only."""
        text = "The participant joined the participation program."
        signals = detector.detect_keywords(text, ["participant"])

        # Should only match "participant", not "participation"
        assert len(signals) == 1
        assert signals[0].value == "participant"

    def test_keyword_multiple_occurrences(self, detector: SignalDetector):
        """Test detecting multiple occurrences of the same keyword."""
        text = "The client met with another client to discuss client needs."
        signals = detector.detect_keywords(text, ["client"])

        assert len(signals) == 3
        positions = [s.position for s in signals]
        assert len(set(positions)) == 3  # All unique positions

    def test_empty_keywords_list(self, detector: SignalDetector):
        """Test with empty keywords list."""
        text = "Some text here."
        signals = detector.detect_keywords(text, [])

        assert signals == []

    def test_empty_text(self, detector: SignalDetector):
        """Test with empty text."""
        signals = detector.detect_keywords("", ["client"])

        assert signals == []


class TestSpanishKeywordDetection(TestSignalDetector):
    """Tests for Spanish keyword detection."""

    def test_detect_spanish_keywords(self, detector: SignalDetector):
        """Test detecting Spanish keywords."""
        text = "El cliente llegó para su cita de evaluación."
        signals = detector.detect_keywords(text, ["cliente", "cita", "evaluación"])

        assert len(signals) == 3
        values = {s.normalized_value for s in signals}
        assert "cliente" in values
        assert "cita" in values

    def test_spanish_language_detection(self, detector: SignalDetector):
        """Test that Spanish keywords are detected with correct language."""
        text = "El cliente participó en el programa."
        signals = detector.detect_keywords(text, ["cliente", "programa"])

        # Spanish keywords should be marked as Spanish
        cliente_signal = next(s for s in signals if s.normalized_value == "cliente")
        assert cliente_signal.language == "es"

    def test_mixed_english_spanish(self, detector: SignalDetector):
        """Test mixed English and Spanish keywords."""
        text = "The client met with el participante to discuss the case."
        signals = detector.detect_keywords(text, ["client", "participante", "case"])

        assert len(signals) == 3

        english_signals = [s for s in signals if s.language == "en"]
        spanish_signals = [s for s in signals if s.language == "es"]

        assert len(english_signals) == 2
        assert len(spanish_signals) == 1

    def test_spanish_accented_characters(self, detector: SignalDetector):
        """Test Spanish keywords with accented characters."""
        text = "La evaluación del diagnóstico está completa."
        signals = detector.detect_keywords(text, ["evaluación", "diagnóstico"])

        assert len(signals) == 2


class TestPatternDetection(TestSignalDetector):
    """Tests for regex pattern detection."""

    def test_detect_case_number_pattern(self, detector: SignalDetector):
        """Test detecting case number patterns."""
        text = "Reviewing case #12345 for the client."
        patterns = [r"case\s+#?\d+"]
        signals = detector.detect_patterns(text, patterns)

        assert len(signals) == 1
        assert signals[0].type == "pattern"
        assert "12345" in signals[0].value

    def test_detect_client_id_pattern(self, detector: SignalDetector):
        """Test detecting client ID patterns."""
        text = "Client ID: 98765 was updated."
        patterns = [r"client\s+id[:\s]+\d+"]
        signals = detector.detect_patterns(text, patterns)

        assert len(signals) == 1
        assert "98765" in signals[0].value

    def test_detect_mrn_pattern(self, detector: SignalDetector):
        """Test detecting MRN patterns (healthcare)."""
        text = "Patient MRN: 123456789 admitted today."
        patterns = [r"MRN\s*[:#]?\s*\d+"]
        signals = detector.detect_patterns(text, patterns)

        assert len(signals) == 1
        assert "123456789" in signals[0].value

    def test_detect_icd10_pattern(self, detector: SignalDetector):
        """Test detecting ICD-10 code patterns."""
        text = "Diagnosis ICD-10: A00.1, treatment started."
        patterns = [r"ICD[\-\s]?10[:\s]+[A-Z]\d+"]
        signals = detector.detect_patterns(text, patterns)

        assert len(signals) == 1
        assert "A00" in signals[0].value

    def test_detect_ticket_pattern(self, detector: SignalDetector):
        """Test detecting ticket ID patterns (tech)."""
        text = "Working on JIRA: PROJ-123 today."
        patterns = [r"JIRA[:\s]*[A-Z]+\-\d+"]
        signals = detector.detect_patterns(text, patterns)

        assert len(signals) == 1
        assert "PROJ-123" in signals[0].value

    def test_multiple_pattern_matches(self, detector: SignalDetector):
        """Test multiple matches for the same pattern."""
        text = "Updated case #123 and case #456."
        patterns = [r"case\s+#?\d+"]
        signals = detector.detect_patterns(text, patterns)

        assert len(signals) == 2

    def test_pattern_with_weights(self, detector: SignalDetector):
        """Test pattern weights."""
        text = "Case #123 assigned."
        patterns = [r"case\s+#?\d+"]
        weights = {r"case\s+#?\d+": 2.0}
        signals = detector.detect_patterns(text, patterns, weights)

        assert len(signals) == 1
        assert signals[0].weight == 2.0

    def test_invalid_pattern_handled(self, detector: SignalDetector):
        """Test that invalid regex patterns are handled gracefully."""
        text = "Some text."
        patterns = [r"[invalid(regex"]  # Invalid regex

        # Should not raise, should return empty or skip invalid
        signals = detector.detect_patterns(text, patterns)
        assert signals == []

    def test_empty_patterns_list(self, detector: SignalDetector):
        """Test with empty patterns list."""
        text = "Case #123."
        signals = detector.detect_patterns(text, [])

        assert signals == []


class TestDetectAll(TestSignalDetector):
    """Tests for combined detection."""

    def test_detect_all_keywords_and_patterns(
        self,
        detector: SignalDetector,
        sample_config: SignalsConfig,
    ):
        """Test detecting both keywords and patterns."""
        text = "The client for case #12345 completed their intake assessment."
        result = detector.detect_all(text, sample_config)

        assert result.keyword_count >= 3  # client, intake, assessment
        assert result.pattern_count >= 1  # case #12345
        assert result.total_weight > 0
        assert result.processing_time_ms >= 0

    def test_detect_all_with_spanish(self, detector: SignalDetector):
        """Test detect_all with Spanish keywords."""
        config = SignalsConfig(
            keywords=["client", "case"],
            patterns=[],
            weights={},
            spanish_keywords=["cliente", "caso"],
        )
        text = "The client met with el cliente about the caso."
        result = detector.detect_all(text, config)

        assert result.keyword_count >= 2

    def test_detect_all_deduplicates(self, detector: SignalDetector):
        """Test that overlapping matches are deduplicated."""
        config = SignalsConfig(
            keywords=["client id"],
            patterns=[r"client\s+id"],
            weights={},
        )
        text = "The client id is 123."
        result = detector.detect_all(text, config)

        # Should deduplicate overlapping matches
        positions = [(s.position, s.length) for s in result.signals]
        assert len(positions) == len(set(positions))

    def test_detect_all_returns_processing_time(
        self,
        detector: SignalDetector,
        sample_config: SignalsConfig,
    ):
        """Test that processing time is tracked."""
        text = "Some sample text for processing."
        result = detector.detect_all(text, sample_config)

        assert result.processing_time_ms >= 0
        assert result.text_length == len(text)

    def test_detect_all_no_config(self, detector: SignalDetector):
        """Test detect_all without config returns empty result."""
        result = detector.detect_all("Some text.", None)

        assert result.signals == []
        assert result.total_weight == 0.0


class TestWeightApplication(TestSignalDetector):
    """Tests for weight application."""

    def test_apply_weights_updates_signals(self, detector: SignalDetector):
        """Test that apply_weights updates match weights."""
        from src.matching.types import Match, Signal

        signal = Signal(
            type="keyword",
            value="client",
            normalized_value="client",
            weight=1.0,
            position=0,
        )
        match = Match(
            signal=signal,
            score_contribution=1.0,
            is_primary=False,
        )

        weights = {"client": 2.0}
        updated = detector.apply_weights([match], weights)

        assert len(updated) == 1
        assert updated[0].signal.weight == 2.0

    def test_apply_weights_recalculates_contribution(self, detector: SignalDetector):
        """Test that score contribution is recalculated."""
        from src.matching.types import Match, Signal

        signal = Signal(
            type="keyword",
            value="intake",
            normalized_value="intake",
            weight=1.0,
            position=0,
        )
        match = Match(
            signal=signal,
            score_contribution=1.0,
            is_primary=True,  # Primary gets 1.5x multiplier
        )

        weights = {"intake": 2.0}
        updated = detector.apply_weights([match], weights)

        # 2.0 weight * 1.5 primary multiplier = 3.0
        assert updated[0].score_contribution == 3.0


class TestCacheAndNormalization(TestSignalDetector):
    """Tests for caching and text normalization."""

    def test_pattern_cache(self, detector: SignalDetector):
        """Test that patterns are cached for efficiency."""
        patterns = [r"case\s+#?\d+"]
        text = "Case #123"

        # First call compiles pattern
        detector.detect_patterns(text, patterns)
        assert len(detector._pattern_cache) > 0

        # Second call uses cache
        detector.detect_patterns(text, patterns)
        assert len(detector._pattern_cache) > 0

    def test_clear_cache(self, detector: SignalDetector):
        """Test cache clearing."""
        patterns = [r"case\s+#?\d+"]
        detector.detect_patterns("Case #123", patterns)
        assert len(detector._pattern_cache) > 0

        detector.clear_cache()
        assert len(detector._pattern_cache) == 0

    def test_normalize_spanish_text(self, detector: SignalDetector):
        """Test Spanish text normalization."""
        text = "Evaluación diagnóstico"
        normalized = detector.normalize_spanish_text(text)

        assert "á" not in normalized
        assert "ó" not in normalized
        assert normalized == "evaluacion diagnostico"


class TestSignalPositions(TestSignalDetector):
    """Tests for signal position tracking."""

    def test_keyword_position_tracking(self, detector: SignalDetector):
        """Test that keyword positions are tracked correctly."""
        text = "Start client middle client end"
        signals = detector.detect_keywords(text, ["client"])

        assert len(signals) == 2
        assert signals[0].position == 6  # First "client"
        assert signals[1].position == 20  # Second "client"

    def test_pattern_position_tracking(self, detector: SignalDetector):
        """Test that pattern positions are tracked correctly."""
        text = "Prefix case #123 suffix"
        patterns = [r"case\s+#?\d+"]
        signals = detector.detect_patterns(text, patterns)

        assert len(signals) == 1
        assert signals[0].position == 7  # "case #123" starts at position 7

    def test_signal_length_tracking(self, detector: SignalDetector):
        """Test that signal lengths are tracked correctly."""
        text = "The client ID: 12345 was updated."
        patterns = [r"client\s+ID[:\s]+\d+"]
        signals = detector.detect_patterns(text, patterns)

        assert len(signals) == 1
        assert signals[0].length == len("client ID: 12345")
