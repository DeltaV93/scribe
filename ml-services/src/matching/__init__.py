"""Form Auto-Detection & Matching Service (PX-887).

This module provides rule-based signal detection and confidence scoring
for matching transcripts to forms.

Phase 1: Signal detection, pattern matching, and segment detection.
Phase 2: NLP integration with spaCy tokenization, sentence embeddings,
         entity extraction, and intent classification.

NLP components are optional and use lazy loading. The rule-based system
always works as a fallback if NLP models are not installed.
"""

from src.matching.types import (
    Signal,
    Match,
    Segment,
    SegmentType,
    FormCandidate,
    MatchingContext,
    MatchResult,
    ConfidenceLevel,
)
from src.matching.signals import SignalDetector
from src.matching.confidence import ConfidenceScorer
from src.matching.segment_detector import MeetingSegmentDetector
from src.matching.matcher import FormMatcher

__all__ = [
    # Types
    "Signal",
    "Match",
    "Segment",
    "SegmentType",
    "FormCandidate",
    "MatchingContext",
    "MatchResult",
    "ConfidenceLevel",
    # Services
    "SignalDetector",
    "ConfidenceScorer",
    "MeetingSegmentDetector",
    "FormMatcher",
]


# NLP components are available via the nlp submodule
# Import with: from src.matching.nlp import SpaCyTokenizer, EmbeddingModel, etc.
