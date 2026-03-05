"""Form Auto-Detection & Matching Service (PX-887).

This module provides rule-based signal detection and confidence scoring
for matching transcripts to forms. Phase 1 focuses on signal detection,
pattern matching, and segment detection without NLP model integration.
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
