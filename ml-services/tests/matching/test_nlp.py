"""Unit tests for NLP components (PX-887 Phase 2).

Tests for tokenization, embeddings, entity extraction, and intent classification.
Tests gracefully skip if spaCy or sentence-transformers are not installed.
"""

import pytest
from typing import Optional

# Check for NLP dependencies
try:
    import spacy

    SPACY_AVAILABLE = True
except ImportError:
    SPACY_AVAILABLE = False

try:
    from sentence_transformers import SentenceTransformer

    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMERS_AVAILABLE = False

# Try to load spaCy English model
SPACY_EN_MODEL_AVAILABLE = False
SPACY_ES_MODEL_AVAILABLE = False

if SPACY_AVAILABLE:
    try:
        spacy.load("en_core_web_sm")
        SPACY_EN_MODEL_AVAILABLE = True
    except OSError:
        pass

    try:
        spacy.load("es_core_news_sm")
        SPACY_ES_MODEL_AVAILABLE = True
    except OSError:
        pass


# Skip markers
requires_spacy = pytest.mark.skipif(
    not SPACY_AVAILABLE,
    reason="spaCy not installed",
)

requires_spacy_en = pytest.mark.skipif(
    not SPACY_EN_MODEL_AVAILABLE,
    reason="spaCy English model (en_core_web_sm) not installed",
)

requires_spacy_es = pytest.mark.skipif(
    not SPACY_ES_MODEL_AVAILABLE,
    reason="spaCy Spanish model (es_core_news_sm) not installed",
)

requires_sentence_transformers = pytest.mark.skipif(
    not SENTENCE_TRANSFORMERS_AVAILABLE,
    reason="sentence-transformers not installed",
)

requires_nlp = pytest.mark.skipif(
    not (SPACY_EN_MODEL_AVAILABLE and SENTENCE_TRANSFORMERS_AVAILABLE),
    reason="NLP dependencies not fully installed",
)


class TestSpaCyTokenizer:
    """Tests for the SpaCyTokenizer class."""

    def test_import_tokenizer(self):
        """Test that tokenizer can be imported."""
        from src.matching.nlp.tokenizer import SpaCyTokenizer, Token, Span, Doc

        assert SpaCyTokenizer is not None
        assert Token is not None
        assert Span is not None
        assert Doc is not None

    def test_tokenizer_init(self):
        """Test tokenizer initialization."""
        from src.matching.nlp.tokenizer import SpaCyTokenizer

        tokenizer = SpaCyTokenizer()
        assert tokenizer is not None
        assert tokenizer._models == {}

    def test_spacy_available_property(self):
        """Test spacy_available property."""
        from src.matching.nlp.tokenizer import SpaCyTokenizer

        tokenizer = SpaCyTokenizer()
        available = tokenizer.spacy_available

        assert available == SPACY_AVAILABLE

    @requires_spacy_en
    def test_tokenize_english(self):
        """Test tokenizing English text."""
        from src.matching.nlp.tokenizer import SpaCyTokenizer

        tokenizer = SpaCyTokenizer()
        doc = tokenizer.tokenize("The client arrived for their appointment.", "en")

        assert doc is not None
        assert len(doc.tokens) > 0
        assert doc.text == "The client arrived for their appointment."

        # Check token properties
        token = doc.tokens[0]
        assert token.text == "The"
        assert token.is_alpha
        assert not token.is_punct

    @requires_spacy_en
    def test_tokenize_extracts_entities(self):
        """Test that tokenization extracts named entities."""
        from src.matching.nlp.tokenizer import SpaCyTokenizer

        tokenizer = SpaCyTokenizer()
        doc = tokenizer.tokenize("John Smith visited New York on January 15th.", "en")

        assert doc is not None
        # Should have PERSON, GPE, and DATE entities
        entity_types = {e.label for e in doc.entities}
        # At minimum, should find some entities
        assert len(doc.entities) > 0

    @requires_spacy_en
    def test_tokenize_extracts_sentences(self):
        """Test sentence segmentation."""
        from src.matching.nlp.tokenizer import SpaCyTokenizer

        tokenizer = SpaCyTokenizer()
        doc = tokenizer.tokenize(
            "First sentence here. Second sentence here. Third one too.",
            "en",
        )

        assert doc is not None
        # Should have 3 sentences
        assert len(doc.sentences) == 3

    @requires_spacy_en
    def test_get_lemmas(self):
        """Test lemmatization."""
        from src.matching.nlp.tokenizer import SpaCyTokenizer

        tokenizer = SpaCyTokenizer()
        lemmas = tokenizer.get_lemmas("The clients were running quickly.", "en")

        assert len(lemmas) > 0
        # "clients" should lemmatize to "client"
        assert "client" in lemmas

    @requires_spacy_en
    def test_get_entities(self):
        """Test entity extraction convenience method."""
        from src.matching.nlp.tokenizer import SpaCyTokenizer

        tokenizer = SpaCyTokenizer()
        entities = tokenizer.get_entities("Apple Inc. is based in Cupertino.", "en")

        assert isinstance(entities, list)
        # Should find at least ORG and GPE
        if entities:
            entity_types = {e.label for e in entities}
            assert "ORG" in entity_types or "GPE" in entity_types

    @requires_spacy_en
    def test_tokenize_batch(self):
        """Test batch tokenization."""
        from src.matching.nlp.tokenizer import SpaCyTokenizer

        tokenizer = SpaCyTokenizer()
        texts = [
            "First document here.",
            "Second document here.",
            "Third document here.",
        ]
        docs = tokenizer.tokenize_batch(texts, "en")

        assert len(docs) == 3
        assert all(doc is not None for doc in docs)
        assert all(len(doc.tokens) > 0 for doc in docs)

    @requires_spacy_es
    def test_tokenize_spanish(self):
        """Test tokenizing Spanish text."""
        from src.matching.nlp.tokenizer import SpaCyTokenizer

        tokenizer = SpaCyTokenizer()
        doc = tokenizer.tokenize("El cliente llegó para su cita.", "es")

        assert doc is not None
        assert len(doc.tokens) > 0
        assert "cliente" in [t.text for t in doc.tokens]

    def test_tokenize_without_spacy(self):
        """Test that tokenize returns None when spaCy unavailable."""
        from src.matching.nlp.tokenizer import SpaCyTokenizer

        tokenizer = SpaCyTokenizer()
        tokenizer._spacy_available = False  # Force unavailable

        doc = tokenizer.tokenize("Some text here.", "en")
        assert doc is None

    @requires_spacy_en
    def test_model_loading_and_caching(self):
        """Test that models are cached after loading."""
        from src.matching.nlp.tokenizer import SpaCyTokenizer

        tokenizer = SpaCyTokenizer()

        # First tokenization loads the model
        doc1 = tokenizer.tokenize("First text.", "en")
        assert tokenizer.is_model_loaded("en")

        # Second tokenization uses cached model
        doc2 = tokenizer.tokenize("Second text.", "en")
        assert tokenizer.is_model_loaded("en")

    @requires_spacy_en
    def test_unload_model(self):
        """Test model unloading."""
        from src.matching.nlp.tokenizer import SpaCyTokenizer

        tokenizer = SpaCyTokenizer()
        tokenizer.tokenize("Load the model.", "en")
        assert tokenizer.is_model_loaded("en")

        tokenizer.unload_model("en")
        assert not tokenizer.is_model_loaded("en")

    @requires_spacy_en
    def test_doc_get_content_words(self):
        """Test getting content words from Doc."""
        from src.matching.nlp.tokenizer import SpaCyTokenizer

        tokenizer = SpaCyTokenizer()
        doc = tokenizer.tokenize("The quick brown fox jumps.", "en")

        content_words = doc.get_content_words()
        # Should filter out "The" (stop word) and "." (punct)
        assert len(content_words) < len(doc.tokens)
        assert all(t.is_alpha for t in content_words)
        assert all(not t.is_stop for t in content_words)


class TestEmbeddingModel:
    """Tests for the EmbeddingModel class."""

    def test_import_embedding_model(self):
        """Test that embedding model can be imported."""
        from src.matching.nlp.embeddings import EmbeddingModel, EmbeddingResult

        assert EmbeddingModel is not None
        assert EmbeddingResult is not None

    def test_embedding_model_init(self):
        """Test embedding model initialization."""
        from src.matching.nlp.embeddings import EmbeddingModel

        model = EmbeddingModel()
        assert model is not None
        assert model.model_name == "all-MiniLM-L6-v2"
        assert model._model is None  # Not loaded yet

    def test_available_property(self):
        """Test available property."""
        from src.matching.nlp.embeddings import EmbeddingModel

        model = EmbeddingModel()
        available = model.available

        assert available == SENTENCE_TRANSFORMERS_AVAILABLE

    @requires_sentence_transformers
    def test_embed_single_text(self):
        """Test embedding a single text."""
        from src.matching.nlp.embeddings import EmbeddingModel

        model = EmbeddingModel()
        result = model.embed("This is a test sentence.")

        assert result is not None
        assert len(result.embedding) > 0
        assert result.model_name == "all-MiniLM-L6-v2"
        assert result.processing_time_ms >= 0

    @requires_sentence_transformers
    def test_embed_caching(self):
        """Test that embeddings are cached."""
        from src.matching.nlp.embeddings import EmbeddingModel

        model = EmbeddingModel()
        text = "Cache this embedding."

        # First embedding
        result1 = model.embed(text)
        assert result1 is not None

        # Second embedding should be from cache (0ms processing)
        result2 = model.embed(text)
        assert result2 is not None
        assert result2.processing_time_ms == 0.0

        # Embeddings should be identical
        assert result1.embedding == result2.embedding

    @requires_sentence_transformers
    def test_embed_batch(self):
        """Test batch embedding."""
        from src.matching.nlp.embeddings import EmbeddingModel

        model = EmbeddingModel()
        texts = [
            "First sentence.",
            "Second sentence.",
            "Third sentence.",
        ]
        results = model.embed_batch(texts)

        assert len(results) == 3
        assert all(r is not None for r in results)
        assert all(len(r.embedding) > 0 for r in results)

    @requires_sentence_transformers
    def test_compute_similarity(self):
        """Test computing similarity between two texts."""
        from src.matching.nlp.embeddings import EmbeddingModel

        model = EmbeddingModel()

        # Similar texts should have high similarity
        result = model.compute_similarity(
            "The client arrived for their appointment.",
            "The patient came to their scheduled visit.",
        )

        assert result is not None
        assert -1.0 <= result.similarity <= 1.0
        assert result.similarity > 0.3  # Should be somewhat similar

        # Dissimilar texts should have lower similarity
        result2 = model.compute_similarity(
            "The client arrived for their appointment.",
            "The weather is nice today.",
        )

        assert result2 is not None
        assert result2.similarity < result.similarity  # Less similar

    @requires_sentence_transformers
    def test_compute_similarity_batch(self):
        """Test computing similarity to multiple candidates."""
        from src.matching.nlp.embeddings import EmbeddingModel

        model = EmbeddingModel()

        text = "intake assessment for new client"
        candidates = [
            "new client enrollment form",  # Most similar
            "case review notes",  # Somewhat similar
            "team standup meeting",  # Less similar
        ]

        results = model.compute_similarity_batch(text, candidates)

        assert len(results) == 3
        # Results should be sorted by similarity (descending)
        assert results[0][1] >= results[1][1] >= results[2][1]

    @requires_sentence_transformers
    def test_cache_field_descriptions(self):
        """Test pre-caching field descriptions."""
        from src.matching.nlp.embeddings import EmbeddingModel

        model = EmbeddingModel()
        descriptions = [
            "Client full name",
            "Date of birth",
            "Social security number",
        ]

        cached = model.cache_field_descriptions(descriptions)
        assert cached == 3
        assert model.cache_size_current >= 3

    @requires_sentence_transformers
    def test_clear_cache(self):
        """Test clearing the embedding cache."""
        from src.matching.nlp.embeddings import EmbeddingModel

        model = EmbeddingModel()
        model.embed("Cache this.")
        assert model.cache_size_current > 0

        model.clear_cache()
        assert model.cache_size_current == 0

    def test_embed_without_model(self):
        """Test that embed returns None when model unavailable."""
        from src.matching.nlp.embeddings import EmbeddingModel

        model = EmbeddingModel()
        model._available = False  # Force unavailable

        result = model.embed("Some text.")
        assert result is None


class TestEntityExtractor:
    """Tests for the EntityExtractor class."""

    def test_import_entity_extractor(self):
        """Test that entity extractor can be imported."""
        from src.matching.nlp.entity_extractor import EntityExtractor, EntityMatch

        assert EntityExtractor is not None
        assert EntityMatch is not None

    def test_entity_extractor_init(self):
        """Test entity extractor initialization."""
        from src.matching.nlp.entity_extractor import EntityExtractor

        extractor = EntityExtractor()
        assert extractor is not None
        assert len(extractor._compiled_patterns) > 0

    def test_extract_case_number_pattern(self):
        """Test extracting case numbers with patterns."""
        from src.matching.nlp.entity_extractor import EntityExtractor

        extractor = EntityExtractor()
        result = extractor.extract(
            "Reviewing case #12345 for the client.",
            include_spacy=False,
            include_patterns=True,
        )

        assert len(result.entities) > 0
        case_entities = [e for e in result.entities if e.type == "CASE_NUMBER"]
        assert len(case_entities) >= 1
        assert "12345" in case_entities[0].value

    def test_extract_mrn_pattern(self):
        """Test extracting MRN patterns."""
        from src.matching.nlp.entity_extractor import EntityExtractor

        extractor = EntityExtractor()
        result = extractor.extract(
            "Patient MRN: 987654321 admitted today.",
            include_spacy=False,
            include_patterns=True,
        )

        mrn_entities = [e for e in result.entities if e.type == "MRN"]
        assert len(mrn_entities) >= 1
        assert "987654321" in mrn_entities[0].value

    def test_extract_email_pattern(self):
        """Test extracting email patterns."""
        from src.matching.nlp.entity_extractor import EntityExtractor

        extractor = EntityExtractor()
        result = extractor.extract(
            "Contact us at support@example.com for help.",
            include_spacy=False,
            include_patterns=True,
        )

        email_entities = [e for e in result.entities if e.type == "EMAIL"]
        assert len(email_entities) >= 1
        assert "support@example.com" in email_entities[0].value

    def test_extract_phone_pattern(self):
        """Test extracting phone patterns."""
        from src.matching.nlp.entity_extractor import EntityExtractor

        extractor = EntityExtractor()
        result = extractor.extract(
            "Call us at 555-123-4567 for assistance.",
            include_spacy=False,
            include_patterns=True,
        )

        phone_entities = [e for e in result.entities if e.type == "PHONE"]
        assert len(phone_entities) >= 1

    def test_extract_ticket_id_pattern(self):
        """Test extracting ticket ID patterns (JIRA-style)."""
        from src.matching.nlp.entity_extractor import EntityExtractor

        extractor = EntityExtractor()
        result = extractor.extract(
            "Working on PROJ-123 and TEAM-456 today.",
            include_spacy=False,
            include_patterns=True,
        )

        ticket_entities = [e for e in result.entities if e.type == "TICKET_ID"]
        assert len(ticket_entities) >= 2

    @requires_spacy_en
    def test_extract_with_spacy(self):
        """Test extracting entities using spaCy NER."""
        from src.matching.nlp.entity_extractor import EntityExtractor

        extractor = EntityExtractor()
        result = extractor.extract(
            "John Smith from Apple Inc. visited New York.",
            include_spacy=True,
            include_patterns=True,
        )

        assert len(result.entities) > 0
        # Should find PERSON, ORG, or GPE entities
        spacy_entities = [e for e in result.entities if e.source == "spacy"]
        assert len(spacy_entities) > 0

    @requires_spacy_en
    def test_extract_deduplicates_overlapping(self):
        """Test that overlapping entities are deduplicated."""
        from src.matching.nlp.entity_extractor import EntityExtractor

        extractor = EntityExtractor()
        result = extractor.extract(
            "Client ID: 12345 for John Smith.",
            include_spacy=True,
            include_patterns=True,
        )

        # Should not have overlapping entities at same position
        positions = [(e.start_char, e.end_char) for e in result.entities]
        for i, (s1, e1) in enumerate(positions):
            for j, (s2, e2) in enumerate(positions):
                if i != j:
                    # No overlap (one ends before other starts)
                    assert e1 <= s2 or e2 <= s1

    def test_extract_by_type(self):
        """Test extracting only specific entity types."""
        from src.matching.nlp.entity_extractor import EntityExtractor

        extractor = EntityExtractor()
        entities = extractor.extract_by_type(
            "Case #123 and email test@example.com",
            entity_types={"EMAIL"},
        )

        assert all(e.type == "EMAIL" for e in entities)

    def test_extract_phi(self):
        """Test extracting potential PHI entities."""
        from src.matching.nlp.entity_extractor import EntityExtractor

        extractor = EntityExtractor()
        phi = extractor.extract_phi(
            "John called 555-123-4567 about MRN: 12345.",
        )

        phi_types = {e.type for e in phi}
        # Should include phone and MRN
        assert "PHONE" in phi_types or "MRN" in phi_types

    def test_has_sensitive_entities(self):
        """Test checking for sensitive entities."""
        from src.matching.nlp.entity_extractor import EntityExtractor

        extractor = EntityExtractor()

        assert extractor.has_sensitive_entities("Call 555-123-4567.")
        # Text without obvious sensitive data should return False or empty
        # (depends on spaCy availability)

    def test_add_custom_pattern(self):
        """Test adding custom patterns at runtime."""
        from src.matching.nlp.entity_extractor import EntityExtractor

        extractor = EntityExtractor()

        # Add custom pattern for internal IDs
        success = extractor.add_custom_pattern(
            "INTERNAL_ID",
            r"INT-\d{6}",
        )
        assert success

        result = extractor.extract(
            "Processing INT-123456 request.",
            include_spacy=False,
            include_patterns=True,
        )

        internal_ids = [e for e in result.entities if e.type == "INTERNAL_ID"]
        assert len(internal_ids) >= 1

    def test_entity_counts(self):
        """Test entity count tracking."""
        from src.matching.nlp.entity_extractor import EntityExtractor

        extractor = EntityExtractor()
        result = extractor.extract(
            "Case #123 and case #456 and email@test.com.",
            include_spacy=False,
            include_patterns=True,
        )

        assert "CASE_NUMBER" in result.entity_counts
        assert result.entity_counts["CASE_NUMBER"] >= 2


class TestIntentClassifier:
    """Tests for the IntentClassifier class."""

    def test_import_intent_classifier(self):
        """Test that intent classifier can be imported."""
        from src.matching.nlp.intent_classifier import (
            IntentClassifier,
            IntentResult,
            MeetingIntent,
        )

        assert IntentClassifier is not None
        assert IntentResult is not None
        assert MeetingIntent is not None

    def test_intent_classifier_init(self):
        """Test intent classifier initialization."""
        from src.matching.nlp.intent_classifier import IntentClassifier

        classifier = IntentClassifier()
        assert classifier is not None
        assert len(classifier._keyword_patterns) > 0

    def test_classify_intake_keywords(self):
        """Test classifying intake meeting with keywords."""
        from src.matching.nlp.intent_classifier import IntentClassifier, MeetingIntent

        classifier = IntentClassifier()
        result = classifier.classify(
            "New client intake meeting to complete enrollment paperwork.",
            use_embeddings=False,
        )

        assert result.intent == MeetingIntent.INTAKE
        assert result.confidence > 0

    def test_classify_standup_keywords(self):
        """Test classifying standup meeting with keywords."""
        from src.matching.nlp.intent_classifier import IntentClassifier, MeetingIntent

        classifier = IntentClassifier()
        result = classifier.classify(
            "Daily standup - what did you work on yesterday? Any blockers?",
            use_embeddings=False,
        )

        assert result.intent == MeetingIntent.STANDUP
        assert result.confidence > 0

    def test_classify_case_review_keywords(self):
        """Test classifying case review meeting."""
        from src.matching.nlp.intent_classifier import IntentClassifier, MeetingIntent

        classifier = IntentClassifier()
        result = classifier.classify(
            "Case review meeting to discuss client progress and barriers to goals.",
            use_embeddings=False,
        )

        assert result.intent == MeetingIntent.CASE_REVIEW
        assert result.confidence > 0

    def test_classify_retrospective_keywords(self):
        """Test classifying retrospective meeting."""
        from src.matching.nlp.intent_classifier import IntentClassifier, MeetingIntent

        classifier = IntentClassifier()
        result = classifier.classify(
            "Sprint retrospective - what went well and what can we improve?",
            use_embeddings=False,
        )

        assert result.intent == MeetingIntent.RETROSPECTIVE
        assert result.confidence > 0

    @requires_sentence_transformers
    def test_classify_with_embeddings(self):
        """Test classification with embedding similarity."""
        from src.matching.nlp.intent_classifier import IntentClassifier, MeetingIntent

        classifier = IntentClassifier()
        result = classifier.classify(
            "Let's review the progress on this case and discuss any barriers.",
            use_embeddings=True,
        )

        assert result.intent in [MeetingIntent.CASE_REVIEW, MeetingIntent.CLIENT_SESSION]
        assert result.confidence > 0

    def test_classify_unknown(self):
        """Test that unrecognizable text returns UNKNOWN."""
        from src.matching.nlp.intent_classifier import IntentClassifier, MeetingIntent

        classifier = IntentClassifier()
        result = classifier.classify(
            "Random text that doesn't match any meeting type.",
            use_embeddings=False,
        )

        # Should either be UNKNOWN or have low confidence
        assert result.intent == MeetingIntent.UNKNOWN or result.confidence < 0.3

    def test_classify_returns_supporting_signals(self):
        """Test that classification returns supporting signals."""
        from src.matching.nlp.intent_classifier import IntentClassifier

        classifier = IntentClassifier()
        result = classifier.classify(
            "New client intake meeting today.",
            use_embeddings=False,
        )

        assert len(result.supporting_signals) > 0
        assert any(s.signal_type == "keyword" for s in result.supporting_signals)

    def test_classify_returns_all_scores(self):
        """Test that classification returns scores for all intents."""
        from src.matching.nlp.intent_classifier import IntentClassifier

        classifier = IntentClassifier()
        result = classifier.classify(
            "Client check-in session.",
            use_embeddings=False,
        )

        assert len(result.all_scores) > 0

    def test_get_top_intents(self):
        """Test getting top N intents."""
        from src.matching.nlp.intent_classifier import IntentClassifier

        classifier = IntentClassifier()
        top = classifier.get_top_intents(
            "Team sync to discuss client cases and coverage.",
            n=3,
            use_embeddings=False,
        )

        assert len(top) <= 3
        # Should be sorted by score descending
        scores = [t[1] for t in top]
        assert scores == sorted(scores, reverse=True)

    def test_classify_batch(self):
        """Test batch classification."""
        from src.matching.nlp.intent_classifier import IntentClassifier

        classifier = IntentClassifier()
        texts = [
            "New client intake meeting.",
            "Daily standup.",
            "Sprint retrospective.",
        ]
        results = classifier.classify_batch(texts, use_embeddings=False)

        assert len(results) == 3
        assert all(r.confidence > 0 for r in results)

    def test_intent_result_to_segment_type(self):
        """Test converting IntentResult to SegmentType."""
        from src.matching.nlp.intent_classifier import IntentClassifier, MeetingIntent
        from src.matching.types import SegmentType

        classifier = IntentClassifier()
        result = classifier.classify(
            "New client intake meeting.",
            use_embeddings=False,
        )

        segment_type = result.to_segment_type()
        assert segment_type in [SegmentType.INTAKE, SegmentType.UNKNOWN]


class TestNLPModuleInit:
    """Tests for the NLP module initialization."""

    def test_import_nlp_module(self):
        """Test that NLP module can be imported."""
        from src.matching.nlp import (
            SpaCyTokenizer,
            Token,
            Span,
            Doc,
            EmbeddingModel,
            EntityExtractor,
            EntityMatch,
            IntentClassifier,
            IntentResult,
        )

        assert SpaCyTokenizer is not None
        assert EmbeddingModel is not None
        assert EntityExtractor is not None
        assert IntentClassifier is not None


class TestNLPIntegration:
    """Integration tests for NLP components working together."""

    @requires_nlp
    def test_full_pipeline(self):
        """Test full NLP pipeline on a transcript excerpt."""
        from src.matching.nlp import (
            SpaCyTokenizer,
            EmbeddingModel,
            EntityExtractor,
            IntentClassifier,
        )

        transcript = """
        Good morning, we're here for the intake assessment for our new client.
        Can you tell me your name and date of birth?
        My name is John Smith, born January 15, 1985.
        Great, I see you were referred by case #12345.
        Let me verify your eligibility for the program.
        """

        # Tokenize
        tokenizer = SpaCyTokenizer()
        doc = tokenizer.tokenize(transcript, "en")
        assert doc is not None
        assert len(doc.tokens) > 10

        # Extract entities
        extractor = EntityExtractor()
        entities = extractor.extract(transcript)
        assert len(entities.entities) > 0

        # Classify intent
        classifier = IntentClassifier()
        intent_result = classifier.classify(transcript)
        assert intent_result.confidence > 0

        # Compute similarity
        embeddings = EmbeddingModel()
        sim = embeddings.compute_similarity(
            transcript,
            "intake assessment enrollment eligibility",
        )
        assert sim is not None
        assert sim.similarity > 0

    @requires_nlp
    def test_graceful_degradation(self):
        """Test that system degrades gracefully when NLP unavailable."""
        from src.matching.nlp.embeddings import EmbeddingModel
        from src.matching.nlp.tokenizer import SpaCyTokenizer

        # Force unavailable state
        embeddings = EmbeddingModel()
        embeddings._available = False

        result = embeddings.embed("Some text.")
        assert result is None

        sim = embeddings.compute_similarity("text1", "text2")
        assert sim is None

        # Tokenizer with forced unavailable
        tokenizer = SpaCyTokenizer()
        tokenizer._spacy_available = False

        doc = tokenizer.tokenize("Some text.", "en")
        assert doc is None

        lemmas = tokenizer.get_lemmas("Some text.", "en")
        assert lemmas == []
