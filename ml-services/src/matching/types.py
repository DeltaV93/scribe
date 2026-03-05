"""Type definitions for the Form Matching service (PX-887).

Provides dataclasses and enums for signal detection, matching context,
and form candidates.
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Optional
from uuid import UUID


class ConfidenceLevel(str, Enum):
    """Confidence level for form matching.

    Thresholds per PX-887 spec:
    - HIGH: >= 90% - Auto-apply form
    - MEDIUM: 60-89% - Show top 3 suggestions
    - LOW: 40-59% - Flag for manual review with weak suggestions
    - INSUFFICIENT: < 40% - Flag for manual review, no suggestions
    """

    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INSUFFICIENT = "insufficient"

    @classmethod
    def from_score(cls, score: float) -> "ConfidenceLevel":
        """Convert a confidence score to a level."""
        if score >= 0.90:
            return cls.HIGH
        elif score >= 0.60:
            return cls.MEDIUM
        elif score >= 0.40:
            return cls.LOW
        else:
            return cls.INSUFFICIENT


class SegmentType(str, Enum):
    """Types of meeting segments based on vocabulary analysis."""

    INTAKE = "intake"
    CASE_REVIEW = "case_review"
    CLIENT_SESSION = "client_session"
    TEAM_SYNC = "team_sync"
    ADMIN = "admin"
    STANDUP = "standup"
    RETROSPECTIVE = "retrospective"
    USER_INTERVIEW = "user_interview"
    CUSTOMER_CALL = "customer_call"
    PATIENT_VISIT = "patient_visit"
    CARE_HUDDLE = "care_huddle"
    UNKNOWN = "unknown"


@dataclass
class Signal:
    """A detected signal from text.

    Signals are the building blocks of form matching - they represent
    keywords, patterns, or other indicators that suggest a particular
    form type or meeting context.
    """

    type: str  # "keyword", "pattern", "meeting_signal"
    value: str  # The actual matched text
    normalized_value: str  # Lowercase/normalized version
    weight: float = 1.0  # Weight multiplier from config
    position: int = 0  # Character position in text
    length: int = 0  # Length of matched text
    language: str = "en"  # Detected language (en, es)
    metadata: dict = field(default_factory=dict)

    def __post_init__(self) -> None:
        """Set length if not provided."""
        if self.length == 0:
            self.length = len(self.value)


@dataclass
class Match:
    """A matched signal with its scoring contribution.

    Represents a single signal match and its contribution to the
    overall confidence score for a form candidate.
    """

    signal: Signal
    matched_form_id: Optional[UUID] = None
    matched_form_name: Optional[str] = None
    score_contribution: float = 0.0  # How much this match contributed to the score
    is_primary: bool = False  # Is this a primary signal for the form?


@dataclass
class Segment:
    """A detected segment within a meeting transcript.

    Segments represent distinct parts of a meeting that may need
    different forms. For example, a team sync followed by case reviews.
    """

    segment_index: int
    start_time: float  # Seconds from start
    end_time: float  # Seconds from start
    segment_type: SegmentType
    confidence: float  # Confidence in segment classification
    text: str = ""  # The text content of this segment
    signals: list[Signal] = field(default_factory=list)
    metadata: dict = field(default_factory=dict)

    @property
    def duration(self) -> float:
        """Duration of the segment in seconds."""
        return self.end_time - self.start_time


@dataclass
class FormCandidate:
    """A candidate form that could match a transcript segment.

    Represents a form in the org's catalog with its associated
    signals and matching context.
    """

    form_id: UUID
    form_name: str
    form_type: str  # "intake", "case_note", "assessment", etc.
    keywords: list[str] = field(default_factory=list)
    patterns: list[str] = field(default_factory=list)
    weights: dict[str, float] = field(default_factory=dict)
    required_signals: list[str] = field(default_factory=list)  # Must match to be considered
    priority: int = 0  # Higher = preferred when scores are equal


@dataclass
class MatchingContext:
    """Context for a form matching operation.

    Contains all the configuration and state needed to perform
    signal detection and form matching.
    """

    org_id: UUID
    industry: Optional[str] = None
    secondary_industry: Optional[str] = None

    # Merged signals from industry defaults + org customizations
    keywords: list[str] = field(default_factory=list)
    patterns: list[str] = field(default_factory=list)
    weights: dict[str, float] = field(default_factory=dict)

    # Form candidates to match against
    form_candidates: list[FormCandidate] = field(default_factory=list)

    # Meeting metadata for additional context
    meeting_title: Optional[str] = None
    attendees: list[str] = field(default_factory=list)
    calendar_metadata: dict = field(default_factory=dict)

    # Risk tier overrides from org profile (PX-896)
    risk_overrides: dict[str, str] = field(default_factory=dict)

    # Matching configuration
    min_confidence_threshold: float = 0.4
    max_suggestions: int = 3
    enable_segmentation: bool = True

    # Timestamps for correlation
    session_id: Optional[UUID] = None
    correlation_id: Optional[UUID] = None


@dataclass
class MatchResult:
    """Result of matching a form to a transcript or segment.

    Contains the matched form, confidence score, and the signals
    that contributed to the match.
    """

    form_id: UUID
    form_name: str
    confidence: float
    confidence_level: ConfidenceLevel
    matched_signals: list[Match] = field(default_factory=list)
    rank: int = 0  # Position in suggestion list (1 = top suggestion)

    # Segment info if this is a segment-level match
    segment_index: Optional[int] = None
    segment_type: Optional[SegmentType] = None

    # Audit/debugging info
    scoring_breakdown: dict = field(default_factory=dict)
    processing_time_ms: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for API response."""
        return {
            "form_id": str(self.form_id),
            "form_name": self.form_name,
            "confidence": self.confidence,
            "confidence_level": self.confidence_level.value,
            "matched_signals": [
                {
                    "signal_type": m.signal.type,
                    "signal_value": m.signal.value,
                    "weight": m.signal.weight,
                    "score_contribution": m.score_contribution,
                }
                for m in self.matched_signals
            ],
            "rank": self.rank,
            "segment_index": self.segment_index,
            "segment_type": self.segment_type.value if self.segment_type else None,
        }


@dataclass
class DetectionResult:
    """Result of signal detection operation."""

    signals: list[Signal]
    total_weight: float
    keyword_count: int
    pattern_count: int
    processing_time_ms: float
    text_length: int


@dataclass
class SegmentationResult:
    """Result of transcript segmentation."""

    segments: list[Segment]
    total_segments: int
    industry_behavior: str  # "segment" or "single_encounter"
    processing_time_ms: float
