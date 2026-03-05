"""Form matching API endpoints (PX-887 Phase 1).

Provides endpoints for:
- Signal detection
- Confidence scoring
- Segment detection
- Full form matching
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.common.db import get_session
from src.matching.types import (
    ConfidenceLevel,
    FormCandidate,
    MatchingContext,
    SegmentType,
)
from src.matching.signals import SignalDetector, SignalsConfig
from src.matching.confidence import ConfidenceScorer
from src.matching.segment_detector import MeetingSegmentDetector
from src.matching.matcher import FormMatcher


router = APIRouter(prefix="/matching")


# --- Request/Response Schemas ---


class DetectSignalsRequest(BaseModel):
    """Request to detect signals in text."""

    text: str = Field(..., description="Text to analyze", min_length=1)
    keywords: list[str] = Field(default_factory=list, description="Keywords to detect")
    patterns: list[str] = Field(default_factory=list, description="Regex patterns to detect")
    weights: dict[str, float] = Field(default_factory=dict, description="Weight multipliers")
    include_spanish: bool = Field(default=True, description="Include Spanish keyword detection")


class SignalResponse(BaseModel):
    """A detected signal."""

    type: str
    value: str
    normalized_value: str
    weight: float
    position: int
    length: int
    language: str


class DetectSignalsResponse(BaseModel):
    """Response from signal detection."""

    signals: list[SignalResponse]
    total_weight: float
    keyword_count: int
    pattern_count: int
    processing_time_ms: float
    text_length: int


class ScoreConfidenceRequest(BaseModel):
    """Request to calculate confidence score."""

    text: str = Field(..., description="Text to analyze", min_length=1)
    keywords: list[str] = Field(default_factory=list, description="Keywords to detect")
    patterns: list[str] = Field(default_factory=list, description="Regex patterns to detect")
    weights: dict[str, float] = Field(default_factory=dict, description="Weight multipliers")
    org_id: Optional[UUID] = Field(None, description="Organization ID for tier lookup")
    risk_tier: Optional[str] = Field(None, description="Risk tier override (low, medium, high, critical)")


class ScoreConfidenceResponse(BaseModel):
    """Response from confidence scoring."""

    confidence: float = Field(..., ge=0.0, le=1.0)
    confidence_level: str
    threshold_tier: str
    auto_apply_threshold: float
    suggest_threshold: float
    signal_count: int
    would_auto_apply: bool
    would_suggest: bool


class DetectSegmentsRequest(BaseModel):
    """Request to detect meeting segments."""

    transcript: str = Field(..., description="Full transcript text", min_length=1)
    industry: Optional[str] = Field(None, description="Industry for behavior (healthcare = single encounter)")
    timestamps: Optional[list[tuple[float, float, str]]] = Field(
        None,
        description="Optional list of (start_time, end_time, text) tuples",
    )


class SegmentResponse(BaseModel):
    """A detected segment."""

    segment_index: int
    start_time: float
    end_time: float
    segment_type: str
    confidence: float
    text: str
    signal_count: int


class DetectSegmentsResponse(BaseModel):
    """Response from segment detection."""

    segments: list[SegmentResponse]
    total_segments: int
    industry_behavior: str
    processing_time_ms: float


class FormCandidateInput(BaseModel):
    """A form candidate for matching."""

    form_id: UUID
    form_name: str
    form_type: str
    keywords: list[str] = Field(default_factory=list)
    patterns: list[str] = Field(default_factory=list)
    weights: dict[str, float] = Field(default_factory=dict)
    required_signals: list[str] = Field(default_factory=list)
    priority: int = 0


class MatchFormsRequest(BaseModel):
    """Request for full form matching."""

    transcript: str = Field(..., description="Transcript text to match", min_length=1)
    org_id: UUID = Field(..., description="Organization ID")
    industry: Optional[str] = Field(None, description="Primary industry")
    secondary_industry: Optional[str] = Field(None, description="Secondary industry")
    form_candidates: list[FormCandidateInput] = Field(
        ...,
        description="Forms to match against",
        min_length=1,
    )

    # Optional context
    keywords: list[str] = Field(default_factory=list, description="Additional keywords")
    patterns: list[str] = Field(default_factory=list, description="Additional patterns")
    weights: dict[str, float] = Field(default_factory=dict, description="Weight overrides")
    risk_overrides: dict[str, str] = Field(default_factory=dict, description="Risk tier overrides")

    # Metadata for pre-transcript matching
    meeting_title: Optional[str] = Field(None, description="Meeting title")
    attendees: list[str] = Field(default_factory=list, description="Attendee names")
    calendar_metadata: dict = Field(default_factory=dict, description="Calendar event metadata")

    # Options
    enable_segmentation: bool = Field(default=True, description="Enable segment detection")
    min_confidence_threshold: float = Field(default=0.4, ge=0.0, le=1.0)
    max_suggestions: int = Field(default=3, ge=1, le=10)

    # Timestamps for accurate segmentation
    timestamps: Optional[list[tuple[float, float, str]]] = Field(
        None,
        description="Optional timestamps (start, end, text)",
    )


class MatchedSignalResponse(BaseModel):
    """A signal that matched a form."""

    signal_type: str
    signal_value: str
    weight: float
    score_contribution: float
    is_primary: bool


class MatchResultResponse(BaseModel):
    """A form match result."""

    form_id: str
    form_name: str
    confidence: float
    confidence_level: str
    matched_signals: list[MatchedSignalResponse]
    rank: int
    segment_index: Optional[int] = None
    segment_type: Optional[str] = None
    scoring_breakdown: dict


class MatchFormsResponse(BaseModel):
    """Response from form matching."""

    results: list[MatchResultResponse]
    total_results: int
    top_confidence: float
    top_form_id: Optional[str] = None
    top_form_name: Optional[str] = None
    would_auto_apply: bool
    processing_time_ms: float


# --- Dependencies ---


def get_signal_detector() -> SignalDetector:
    """Get signal detector instance."""
    return SignalDetector()


def get_confidence_scorer() -> ConfidenceScorer:
    """Get confidence scorer instance."""
    return ConfidenceScorer()


def get_segment_detector() -> MeetingSegmentDetector:
    """Get segment detector instance."""
    return MeetingSegmentDetector()


def get_form_matcher(
    signal_detector: SignalDetector = Depends(get_signal_detector),
    confidence_scorer: ConfidenceScorer = Depends(get_confidence_scorer),
    segment_detector: MeetingSegmentDetector = Depends(get_segment_detector),
) -> FormMatcher:
    """Get form matcher instance."""
    return FormMatcher(
        signal_detector=signal_detector,
        confidence_scorer=confidence_scorer,
        segment_detector=segment_detector,
    )


# --- Endpoints ---


@router.post("/detect", response_model=DetectSignalsResponse)
async def detect_signals(
    request: DetectSignalsRequest,
    detector: SignalDetector = Depends(get_signal_detector),
) -> DetectSignalsResponse:
    """Detect signals (keywords and patterns) in text.

    This endpoint detects keywords and regex patterns in the provided text,
    returning all matches with their positions and weights.
    """
    # Build config
    spanish_keywords = None
    if request.include_spanish:
        # Known Spanish keywords
        spanish_keywords = [
            kw for kw in request.keywords
            if any(c in kw.lower() for c in "áéíóúñü")
        ]

    config = SignalsConfig(
        keywords=request.keywords,
        patterns=request.patterns,
        weights=request.weights,
        spanish_keywords=spanish_keywords,
    )

    result = detector.detect_all(request.text, config)

    return DetectSignalsResponse(
        signals=[
            SignalResponse(
                type=s.type,
                value=s.value,
                normalized_value=s.normalized_value,
                weight=s.weight,
                position=s.position,
                length=s.length,
                language=s.language,
            )
            for s in result.signals
        ],
        total_weight=result.total_weight,
        keyword_count=result.keyword_count,
        pattern_count=result.pattern_count,
        processing_time_ms=result.processing_time_ms,
        text_length=result.text_length,
    )


@router.post("/score", response_model=ScoreConfidenceResponse)
async def score_confidence(
    request: ScoreConfidenceRequest,
    detector: SignalDetector = Depends(get_signal_detector),
    scorer: ConfidenceScorer = Depends(get_confidence_scorer),
) -> ScoreConfidenceResponse:
    """Calculate confidence score for form matching.

    Detects signals in the text and calculates a confidence score,
    applying threshold tiers based on risk level.
    """
    # Detect signals
    config = SignalsConfig(
        keywords=request.keywords,
        patterns=request.patterns,
        weights=request.weights,
    )
    detection_result = detector.detect_all(request.text, config)

    # Calculate confidence
    confidence = scorer.calculate_confidence(detection_result.signals)

    # Get threshold tier
    tier = scorer.get_threshold_tier(
        org_id=request.org_id,
        risk_overrides={} if not request.risk_tier else {"default": request.risk_tier},
    )

    # Override tier if specified directly
    if request.risk_tier:
        from src.matching.confidence import ThresholdTier
        tier_map = {
            "low": ThresholdTier.standard(),
            "medium": ThresholdTier.elevated(),
            "high": ThresholdTier.strict(),
            "critical": ThresholdTier.strict(),
        }
        tier = tier_map.get(request.risk_tier.lower(), tier)

    confidence_level = scorer.get_confidence_level(confidence, tier)

    return ScoreConfidenceResponse(
        confidence=confidence,
        confidence_level=confidence_level.value,
        threshold_tier=tier.risk_tier,
        auto_apply_threshold=tier.auto_apply_threshold,
        suggest_threshold=tier.suggest_threshold,
        signal_count=len(detection_result.signals),
        would_auto_apply=confidence >= tier.auto_apply_threshold,
        would_suggest=confidence >= tier.suggest_threshold,
    )


@router.post("/segments", response_model=DetectSegmentsResponse)
async def detect_segments(
    request: DetectSegmentsRequest,
    segment_detector: MeetingSegmentDetector = Depends(get_segment_detector),
) -> DetectSegmentsResponse:
    """Detect meeting segments in a transcript.

    Analyzes vocabulary patterns to detect boundaries between different
    parts of a meeting. Industry-aware: healthcare uses single-encounter mode.
    """
    result = segment_detector.detect_segments(
        transcript=request.transcript,
        industry=request.industry,
        timestamps=request.timestamps,
    )

    return DetectSegmentsResponse(
        segments=[
            SegmentResponse(
                segment_index=s.segment_index,
                start_time=s.start_time,
                end_time=s.end_time,
                segment_type=s.segment_type.value,
                confidence=s.confidence,
                text=s.text[:500] + "..." if len(s.text) > 500 else s.text,
                signal_count=len(s.signals),
            )
            for s in result.segments
        ],
        total_segments=result.total_segments,
        industry_behavior=result.industry_behavior,
        processing_time_ms=result.processing_time_ms,
    )


@router.post("/match", response_model=MatchFormsResponse)
async def match_forms(
    request: MatchFormsRequest,
    matcher: FormMatcher = Depends(get_form_matcher),
) -> MatchFormsResponse:
    """Match a transcript to forms.

    Full form matching pipeline:
    1. Load signals from industry defaults and request
    2. Detect segments if enabled
    3. Score each form candidate
    4. Return ranked results with confidence levels
    """
    import time
    start_time = time.perf_counter()

    # Build context
    context = MatchingContext(
        org_id=request.org_id,
        industry=request.industry,
        secondary_industry=request.secondary_industry,
        keywords=request.keywords,
        patterns=request.patterns,
        weights=request.weights,
        form_candidates=[
            FormCandidate(
                form_id=f.form_id,
                form_name=f.form_name,
                form_type=f.form_type,
                keywords=f.keywords,
                patterns=f.patterns,
                weights=f.weights,
                required_signals=f.required_signals,
                priority=f.priority,
            )
            for f in request.form_candidates
        ],
        meeting_title=request.meeting_title,
        attendees=request.attendees,
        calendar_metadata=request.calendar_metadata,
        risk_overrides=request.risk_overrides,
        min_confidence_threshold=request.min_confidence_threshold,
        max_suggestions=request.max_suggestions,
        enable_segmentation=request.enable_segmentation,
    )

    # Run matching
    results = matcher.match_forms(
        transcript=request.transcript,
        context=context,
        timestamps=request.timestamps,
    )

    elapsed_ms = (time.perf_counter() - start_time) * 1000

    # Build response
    response_results = [
        MatchResultResponse(
            form_id=str(r.form_id),
            form_name=r.form_name,
            confidence=r.confidence,
            confidence_level=r.confidence_level.value,
            matched_signals=[
                MatchedSignalResponse(
                    signal_type=m.signal.type,
                    signal_value=m.signal.value,
                    weight=m.signal.weight,
                    score_contribution=m.score_contribution,
                    is_primary=m.is_primary,
                )
                for m in r.matched_signals[:10]  # Limit signals in response
            ],
            rank=r.rank,
            segment_index=r.segment_index,
            segment_type=r.segment_type.value if r.segment_type else None,
            scoring_breakdown=r.scoring_breakdown,
        )
        for r in results
    ]

    top_result = results[0] if results else None

    return MatchFormsResponse(
        results=response_results,
        total_results=len(results),
        top_confidence=top_result.confidence if top_result else 0.0,
        top_form_id=str(top_result.form_id) if top_result else None,
        top_form_name=top_result.form_name if top_result else None,
        would_auto_apply=(
            top_result.confidence_level == ConfidenceLevel.HIGH
            if top_result else False
        ),
        processing_time_ms=elapsed_ms,
    )
