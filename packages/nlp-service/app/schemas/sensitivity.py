"""
Pydantic schemas for sensitivity classification API.
PX-878: Tiered Content Classifier
"""

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class SensitivityTier(str, Enum):
    """Content sensitivity tier."""
    STANDARD = "STANDARD"      # Normal work content
    RESTRICTED = "RESTRICTED"  # Sensitive business (HR, legal, M&A)
    REDACTED = "REDACTED"      # Personal/off-topic for removal


class SensitivityCategory(str, Enum):
    """Category of sensitive content."""
    PERSONAL_OFF_TOPIC = "PERSONAL_OFF_TOPIC"    # Gossip, personal struggles
    HR_SENSITIVE = "HR_SENSITIVE"                # Layoffs, terminations
    LEGAL_SENSITIVE = "LEGAL_SENSITIVE"          # Legal discussions
    HEALTH_SENSITIVE = "HEALTH_SENSITIVE"        # Medical info
    FINANCIAL_SENSITIVE = "FINANCIAL_SENSITIVE"  # Salary, M&A


class TranscriptSegment(BaseModel):
    """Input transcript segment."""
    index: int = Field(..., description="Segment index in transcript")
    start_time: float = Field(0.0, description="Start time in seconds")
    end_time: float = Field(0.0, description="End time in seconds")
    text: str = Field(..., description="Segment text content")
    speaker: Optional[str] = Field(None, description="Speaker label (AGENT/CLIENT)")


class EntitySignal(BaseModel):
    """Named entity detected in segment."""
    text: str = Field(..., description="Entity text")
    label: str = Field(..., description="Entity type (PERSON, ORG, DATE, etc.)")
    start: int = Field(..., description="Character start position")
    end: int = Field(..., description="Character end position")
    sensitivity: str = Field("LOW", description="Sensitivity level (HIGH/MEDIUM/LOW)")


class SentimentSignal(BaseModel):
    """Sentiment analysis result."""
    compound: float = Field(..., description="VADER compound score (-1 to 1)")
    positive: float = Field(..., description="Positive score (0 to 1)")
    negative: float = Field(..., description="Negative score (0 to 1)")
    neutral: float = Field(..., description="Neutral score (0 to 1)")
    category: str = Field("NEUTRAL", description="PERSONAL/PROFESSIONAL/NEUTRAL")


class TaxonomySignal(BaseModel):
    """Taxonomy pattern match."""
    pattern: str = Field(..., description="Matched pattern")
    category: str = Field(..., description="Pattern category")
    tier: SensitivityTier = Field(..., description="Suggested tier")
    score: float = Field(..., description="Match confidence (0 to 1)")


class SegmentSignals(BaseModel):
    """All signals extracted from a segment."""
    entities: list[EntitySignal] = Field(default_factory=list)
    sentiment: SentimentSignal
    taxonomy: list[TaxonomySignal] = Field(default_factory=list)


class SensitivitySegmentResult(BaseModel):
    """Classification result for a single segment."""
    segment_index: int = Field(..., description="Index of the segment")
    start_time: float = Field(0.0, description="Segment start time")
    end_time: float = Field(0.0, description="Segment end time")
    text: str = Field(..., description="Original segment text")
    tier: SensitivityTier = Field(..., description="Assigned tier")
    confidence: float = Field(..., description="Classification confidence (0 to 1)")
    category: Optional[SensitivityCategory] = Field(None, description="Category if sensitive")
    signals: SegmentSignals = Field(..., description="Extracted signals")
    needs_review: bool = Field(False, description="Flag for human review")
    review_reason: Optional[str] = Field(None, description="Why review is needed")


class ClassifyRequest(BaseModel):
    """Classification request payload."""
    segments: list[TranscriptSegment] = Field(..., description="Transcript segments")
    org_id: str = Field(..., description="Organization ID")
    call_id: Optional[str] = Field(None, description="Call ID for tracking")
    conversation_id: Optional[str] = Field(None, description="Conversation ID")


class ClassifyResponse(BaseModel):
    """Classification response payload."""
    success: bool = Field(True, description="Whether classification succeeded")
    segments: list[SensitivitySegmentResult] = Field(..., description="Results per segment")
    overall_tier: SensitivityTier = Field(..., description="Highest risk tier")
    confidence: float = Field(..., description="Lowest confidence across segments")
    model_version: str = Field(..., description="Model version used")
    requires_review: bool = Field(False, description="If any segment needs review")
    block_reason: Optional[str] = Field(None, description="Why pipeline should block")
    processing_time_ms: float = Field(..., description="Processing time in ms")


class ModelInfo(BaseModel):
    """Model version information."""
    version: str
    org_id: Optional[str] = None
    is_active: bool = True
    accuracy: Optional[float] = None
    precision: Optional[float] = None
    recall: Optional[float] = None
    f1_score: Optional[float] = None
    training_size: Optional[int] = None
    trained_at: Optional[str] = None


class ModelListResponse(BaseModel):
    """Response for listing models."""
    models: list[ModelInfo]


class TrainRequest(BaseModel):
    """Request to trigger retraining."""
    org_id: Optional[str] = Field(None, description="Org ID for private model (null for shared)")
    reason: str = Field("MANUAL", description="MANUAL | THRESHOLD_LABELS | SCHEDULED")


class TrainResponse(BaseModel):
    """Response for training request."""
    success: bool
    job_id: Optional[str] = None
    message: str


class RollbackRequest(BaseModel):
    """Request to rollback model version."""
    org_id: Optional[str] = Field(None, description="Org ID (null for shared model)")
    target_version: str = Field(..., description="Version to rollback to")


class RollbackResponse(BaseModel):
    """Response for rollback request."""
    success: bool
    previous_version: str
    new_active_version: str
    message: str


class HealthResponse(BaseModel):
    """Health check response."""
    status: str = "ok"
    version: str = "1.0.0"
    model_loaded: bool = False
    model_version: Optional[str] = None
