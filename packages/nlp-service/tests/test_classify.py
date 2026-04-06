"""
Tests for classification API.
"""

import pytest
from fastapi.testclient import TestClient


# Test fixtures
STANDARD_SEGMENTS = [
    {
        "index": 0,
        "text": "I'm calling about your housing application.",
        "speaker": "AGENT",
    },
    {
        "index": 1,
        "text": "Let me update your contact information.",
        "speaker": "AGENT",
    },
    {
        "index": 2,
        "text": "Your appointment is scheduled for Tuesday.",
        "speaker": "AGENT",
    },
]

RESTRICT_SEGMENTS = [
    {
        "index": 0,
        "text": "We need to discuss the termination paperwork.",
        "speaker": "AGENT",
    },
    {
        "index": 1,
        "text": "Your salary increase has been approved.",
        "speaker": "AGENT",
    },
    {
        "index": 2,
        "text": "This is confidential but we're restructuring.",
        "speaker": "AGENT",
    },
]

REDACT_SEGMENTS = [
    {
        "index": 0,
        "text": "My marriage is falling apart and I'm so stressed.",
        "speaker": "CLIENT",
    },
    {
        "index": 1,
        "text": "Between you and me, the boss is terrible.",
        "speaker": "CLIENT",
    },
    {
        "index": 2,
        "text": "Did you watch the game last night?",
        "speaker": "AGENT",
    },
]


class TestTaxonomyMatcher:
    """Tests for taxonomy pattern matching."""

    def test_standard_text_no_match(self):
        """Standard work content should not match sensitive patterns."""
        from app.utils.taxonomy import TaxonomyMatcher

        matcher = TaxonomyMatcher()

        for segment in STANDARD_SEGMENTS:
            matches = matcher.match(segment["text"])
            # Should have few or no high-scoring matches
            high_score_matches = [m for m in matches if m.score >= 0.7]
            assert len(high_score_matches) == 0, f"Unexpected match for: {segment['text']}"

    def test_restrict_patterns_match(self):
        """Restricted content should match RESTRICT patterns."""
        from app.utils.taxonomy import TaxonomyMatcher

        matcher = TaxonomyMatcher()

        for segment in RESTRICT_SEGMENTS:
            matches = matcher.match(segment["text"])
            restrict_matches = [m for m in matches if m.tier.value == "RESTRICTED"]
            assert len(restrict_matches) > 0, f"Expected RESTRICT match for: {segment['text']}"

    def test_redact_patterns_match(self):
        """Personal content should match REDACT patterns."""
        from app.utils.taxonomy import TaxonomyMatcher

        matcher = TaxonomyMatcher()

        # Test first segment (personal struggles)
        matches = matcher.match(REDACT_SEGMENTS[0]["text"])
        redact_matches = [m for m in matches if m.tier.value == "REDACTED"]
        assert len(redact_matches) > 0, f"Expected REDACT match for: {REDACT_SEGMENTS[0]['text']}"

        # Test second segment (gossip)
        matches = matcher.match(REDACT_SEGMENTS[1]["text"])
        redact_matches = [m for m in matches if m.tier.value == "REDACTED"]
        assert len(redact_matches) > 0, f"Expected REDACT match for: {REDACT_SEGMENTS[1]['text']}"


class TestSentimentAnalyzer:
    """Tests for sentiment analysis."""

    def test_personal_negative_sentiment(self):
        """Personal negative text should be categorized as PERSONAL."""
        from app.models.sentiment import SentimentAnalyzer

        analyzer = SentimentAnalyzer()

        result = analyzer.analyze("My marriage is falling apart and I'm so stressed.")

        assert result.compound < 0, "Expected negative compound score"
        assert result.category == "PERSONAL", "Expected PERSONAL category"

    def test_professional_text(self):
        """Professional text should be categorized as PROFESSIONAL."""
        from app.models.sentiment import SentimentAnalyzer

        analyzer = SentimentAnalyzer()

        result = analyzer.analyze("Let me schedule a follow-up meeting for the project.")

        assert result.category == "PROFESSIONAL", "Expected PROFESSIONAL category"

    def test_neutral_text(self):
        """Neutral text should have neutral sentiment."""
        from app.models.sentiment import SentimentAnalyzer

        analyzer = SentimentAnalyzer()

        result = analyzer.analyze("The weather is nice today.")

        assert result.neutral > 0.5, "Expected high neutral score"


class TestClassifier:
    """Tests for the main classifier."""

    def test_empty_text_returns_standard(self):
        """Empty text should return STANDARD with high confidence."""
        from app.models.classifier import TierClassifier

        classifier = TierClassifier()
        classifier.load_models()

        tier, confidence, category, signals = classifier.classify("")

        assert tier.value == "STANDARD"
        assert confidence == 1.0

    def test_standard_content_classification(self):
        """Standard work content should be classified as STANDARD."""
        from app.models.classifier import TierClassifier

        classifier = TierClassifier()
        classifier.load_models()

        for segment in STANDARD_SEGMENTS:
            tier, confidence, category, signals = classifier.classify(
                segment["text"],
                speaker=segment["speaker"]
            )
            assert tier.value == "STANDARD", f"Expected STANDARD for: {segment['text']}"

    def test_redact_content_classification(self):
        """Personal content should be classified as REDACTED."""
        from app.models.classifier import TierClassifier

        classifier = TierClassifier()
        classifier.load_models()

        # Test personal struggles
        tier, confidence, category, signals = classifier.classify(
            REDACT_SEGMENTS[0]["text"],
            speaker=REDACT_SEGMENTS[0]["speaker"]
        )
        assert tier.value == "REDACTED", f"Expected REDACTED for: {REDACT_SEGMENTS[0]['text']}"

    def test_restrict_content_classification(self):
        """Sensitive business content should be classified as RESTRICTED."""
        from app.models.classifier import TierClassifier

        classifier = TierClassifier()
        classifier.load_models()

        # Test termination discussion
        tier, confidence, category, signals = classifier.classify(
            RESTRICT_SEGMENTS[0]["text"],
            speaker=RESTRICT_SEGMENTS[0]["speaker"]
        )
        assert tier.value == "RESTRICTED", f"Expected RESTRICTED for: {RESTRICT_SEGMENTS[0]['text']}"


# Integration tests (require running service)
@pytest.mark.skip(reason="Requires running service")
class TestClassifyEndpoint:
    """Integration tests for the /v1/classify endpoint."""

    def test_classify_empty_segments(self, client: TestClient):
        """Empty segments list should return empty results."""
        response = client.post("/v1/classify", json={
            "segments": [],
            "org_id": "test_org",
        })

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert len(data["segments"]) == 0
        assert data["overall_tier"] == "STANDARD"

    def test_classify_mixed_segments(self, client: TestClient):
        """Mixed content should identify REDACT content."""
        response = client.post("/v1/classify", json={
            "segments": [
                {"index": 0, "text": "Let me verify your address.", "speaker": "AGENT"},
                {"index": 1, "text": "My divorce is killing me.", "speaker": "CLIENT"},
            ],
            "org_id": "test_org",
            "call_id": "test_call"
        })

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert data["segments"][0]["tier"] == "STANDARD"
        assert data["segments"][1]["tier"] == "REDACTED"
        assert data["requires_review"] is True
