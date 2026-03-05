"""NLP components for form matching (PX-887 Phase 2).

This module provides NLP-enhanced signal detection and semantic matching:
- Tokenization with spaCy for English and Spanish
- Sentence embeddings for semantic similarity
- Named entity extraction
- Intent classification for meeting segments

All components use lazy loading so the system works without NLP models installed.
The rule-based system (Phase 1) remains the fallback.
"""

from src.matching.nlp.tokenizer import SpaCyTokenizer, Token, Span, Doc
from src.matching.nlp.embeddings import EmbeddingModel
from src.matching.nlp.entity_extractor import EntityExtractor, EntityMatch
from src.matching.nlp.intent_classifier import IntentClassifier, IntentResult

__all__ = [
    # Tokenizer
    "SpaCyTokenizer",
    "Token",
    "Span",
    "Doc",
    # Embeddings
    "EmbeddingModel",
    # Entity extraction
    "EntityExtractor",
    "EntityMatch",
    # Intent classification
    "IntentClassifier",
    "IntentResult",
]
