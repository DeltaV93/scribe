"""Form matching API endpoints (PX-887 Phase 1-3).

Provides endpoints for:
- Signal detection
- Confidence scoring
- Segment detection
- Full form matching
- Feedback collection (Phase 3)
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
from src.matching.feedback import (
    FormMatchingFeedbackType,
    FeedbackSignal,
    get_feedback_collector,
    analyze_edits,
)
from src.matching.correction_scorer import (
    CorrectionScorer,
    QualityTier,
    create_training_dataset,
)
from src.matching.goal_embeddings import (
    GoalEmbeddingService,
    get_goal_embedding_service,
)


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


# --- Phase 3: Feedback Endpoints ---


class FeedbackConfirmationRequest(BaseModel):
    """Request to record form confirmation."""

    org_id: UUID
    call_id: UUID
    user_id: UUID
    suggested_form_id: UUID
    suggested_form_name: str
    suggested_confidence: float = Field(..., ge=0.0, le=1.0)
    all_suggestions: list[dict] = Field(default_factory=list)
    industry: Optional[str] = None
    meeting_type: Optional[str] = None


class FeedbackOverrideRequest(BaseModel):
    """Request to record form override."""

    org_id: UUID
    call_id: UUID
    user_id: UUID
    suggested_form_id: Optional[UUID] = None
    suggested_form_name: Optional[str] = None
    suggested_confidence: Optional[float] = Field(None, ge=0.0, le=1.0)
    selected_form_id: UUID
    selected_form_name: str
    all_suggestions: list[dict] = Field(default_factory=list)
    was_in_suggestions: bool = False
    industry: Optional[str] = None
    meeting_type: Optional[str] = None


class FeedbackEditRequest(BaseModel):
    """Request to record content edits."""

    org_id: UUID
    call_id: UUID
    user_id: UUID
    form_id: UUID
    form_name: str
    original_output: dict
    edited_output: dict
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0)
    industry: Optional[str] = None


class FeedbackResponse(BaseModel):
    """Response from feedback recording."""

    feedback_type: str
    signal: str
    signal_weight: float
    quality_score: Optional[float] = None
    is_significant_edit: Optional[bool] = None


class EditAnalysisResponse(BaseModel):
    """Response from edit analysis."""

    edit_distance: float
    content_change_ratio: float
    is_significant: bool
    fields_changed: int
    total_fields: int
    changed_field_names: list[str]


class FeedbackStatsResponse(BaseModel):
    """Statistics about collected feedback."""

    pending_count: int
    by_type: dict[str, int]
    by_signal: dict[str, int]
    avg_quality_score: Optional[float] = None


@router.post("/feedback/confirmation", response_model=FeedbackResponse)
async def record_confirmation(
    request: FeedbackConfirmationRequest,
) -> FeedbackResponse:
    """Record that user confirmed an auto-suggested form.

    This is a positive feedback signal indicating the model
    correctly matched the form.
    """
    collector = get_feedback_collector()

    feedback = collector.record_confirmation(
        org_id=request.org_id,
        call_id=request.call_id,
        user_id=request.user_id,
        suggested_form_id=request.suggested_form_id,
        suggested_form_name=request.suggested_form_name,
        suggested_confidence=request.suggested_confidence,
        all_suggestions=request.all_suggestions,
        industry=request.industry,
        meeting_type=request.meeting_type,
    )

    return FeedbackResponse(
        feedback_type=feedback.feedback_type.value if feedback.feedback_type else "unknown",
        signal=feedback.signal.value if feedback.signal else "neutral",
        signal_weight=feedback.signal_weight,
        quality_score=feedback.quality_score,
    )


@router.post("/feedback/override", response_model=FeedbackResponse)
async def record_override(
    request: FeedbackOverrideRequest,
) -> FeedbackResponse:
    """Record that user selected a different form than suggested.

    This is a negative feedback signal indicating the model's
    suggestion was incorrect.
    """
    collector = get_feedback_collector()

    feedback = collector.record_override(
        org_id=request.org_id,
        call_id=request.call_id,
        user_id=request.user_id,
        suggested_form_id=request.suggested_form_id,
        suggested_form_name=request.suggested_form_name,
        suggested_confidence=request.suggested_confidence,
        selected_form_id=request.selected_form_id,
        selected_form_name=request.selected_form_name,
        all_suggestions=request.all_suggestions,
        was_in_suggestions=request.was_in_suggestions,
        industry=request.industry,
        meeting_type=request.meeting_type,
    )

    return FeedbackResponse(
        feedback_type=feedback.feedback_type.value if feedback.feedback_type else "unknown",
        signal=feedback.signal.value if feedback.signal else "neutral",
        signal_weight=feedback.signal_weight,
        quality_score=feedback.quality_score,
    )


@router.post("/feedback/no-match", response_model=FeedbackResponse)
async def record_no_match(
    org_id: UUID,
    call_id: UUID,
    user_id: UUID,
    all_suggestions: list[dict] = [],
    industry: Optional[str] = None,
    meeting_type: Optional[str] = None,
) -> FeedbackResponse:
    """Record that user selected 'None of these' for all suggestions.

    Strong negative signal indicating none of the suggestions
    were appropriate.
    """
    collector = get_feedback_collector()

    feedback = collector.record_no_match(
        org_id=org_id,
        call_id=call_id,
        user_id=user_id,
        all_suggestions=all_suggestions,
        industry=industry,
        meeting_type=meeting_type,
    )

    return FeedbackResponse(
        feedback_type=feedback.feedback_type.value if feedback.feedback_type else "unknown",
        signal=feedback.signal.value if feedback.signal else "neutral",
        signal_weight=feedback.signal_weight,
        quality_score=feedback.quality_score,
    )


@router.post("/feedback/edit", response_model=FeedbackResponse)
async def record_edit(
    request: FeedbackEditRequest,
) -> FeedbackResponse:
    """Record content edits to extracted data.

    Analyzes the magnitude of edits to determine signal strength.
    Minor edits (<20% change) are positive signals.
    Significant edits (>=20% change) are negative signals.
    """
    collector = get_feedback_collector()

    feedback = collector.record_content_edit(
        org_id=request.org_id,
        call_id=request.call_id,
        user_id=request.user_id,
        form_id=request.form_id,
        form_name=request.form_name,
        original_output=request.original_output,
        edited_output=request.edited_output,
        confidence=request.confidence,
        industry=request.industry,
    )

    return FeedbackResponse(
        feedback_type=feedback.feedback_type.value if feedback.feedback_type else "unknown",
        signal=feedback.signal.value if feedback.signal else "neutral",
        signal_weight=feedback.signal_weight,
        quality_score=feedback.quality_score,
        is_significant_edit=feedback.content_change_ratio >= 0.20 if feedback.content_change_ratio else None,
    )


@router.post("/feedback/analyze-edit", response_model=EditAnalysisResponse)
async def analyze_edit(
    original_output: dict,
    edited_output: dict,
    threshold: float = 0.20,
) -> EditAnalysisResponse:
    """Analyze the magnitude of content edits.

    Compares original ML-extracted output to user-edited version
    to determine if changes are significant (>20% by default).
    """
    analysis = analyze_edits(original_output, edited_output, threshold)

    return EditAnalysisResponse(
        edit_distance=analysis.edit_distance,
        content_change_ratio=analysis.content_change_ratio,
        is_significant=analysis.is_significant,
        fields_changed=analysis.fields_changed,
        total_fields=analysis.total_fields,
        changed_field_names=analysis.changed_field_names,
    )


@router.get("/feedback/stats", response_model=FeedbackStatsResponse)
async def get_feedback_stats() -> FeedbackStatsResponse:
    """Get statistics about pending feedback.

    Returns counts by type and signal strength.
    """
    collector = get_feedback_collector()
    pending = collector.get_pending_feedback()

    by_type: dict[str, int] = {}
    by_signal: dict[str, int] = {}
    total_quality = 0.0
    quality_count = 0

    for fb in pending:
        if fb.feedback_type:
            type_name = fb.feedback_type.value
            by_type[type_name] = by_type.get(type_name, 0) + 1

        if fb.signal:
            signal_name = fb.signal.value
            by_signal[signal_name] = by_signal.get(signal_name, 0) + 1

        if fb.quality_score is not None:
            total_quality += fb.quality_score
            quality_count += 1

    avg_quality = total_quality / quality_count if quality_count > 0 else None

    return FeedbackStatsResponse(
        pending_count=len(pending),
        by_type=by_type,
        by_signal=by_signal,
        avg_quality_score=avg_quality,
    )


@router.post("/feedback/process")
async def process_pending_feedback(
    min_quality_tier: str = "medium",
) -> dict:
    """Process pending feedback and create training dataset.

    Scores corrections and filters for training quality.
    Returns statistics about the resulting dataset.
    """
    collector = get_feedback_collector()
    pending = collector.get_pending_feedback()

    if not pending:
        return {
            "processed": 0,
            "training_samples": 0,
            "rejected": 0,
        }

    # Create training dataset
    tier = QualityTier(min_quality_tier)
    dataset = create_training_dataset(pending, min_tier=tier)

    # Clear processed feedback
    collector.clear_pending()

    return {
        "processed": dataset.total_processed,
        "training_samples": len(dataset.corrections),
        "rejected": dataset.total_rejected,
        "high_quality": dataset.high_quality_count,
        "medium_quality": dataset.medium_quality_count,
        "low_quality": dataset.low_quality_count,
        "total_weight": dataset.total_weight,
        "positive_weight": dataset.positive_signal_weight,
        "negative_weight": dataset.negative_signal_weight,
    }


# --- Goal Embedding Endpoints ---


class GenerateGoalEmbeddingRequest(BaseModel):
    """Request to generate goal embedding."""

    name: str = Field(..., min_length=1, description="Goal name")
    description: Optional[str] = Field(None, description="Optional goal description")


class GoalEmbeddingResponse(BaseModel):
    """Response with goal embedding."""

    embedding: list[float]
    model_name: str
    dimension: int
    processing_time_ms: float


class GoalCandidateInput(BaseModel):
    """A goal candidate for similarity search."""

    id: str = Field(..., description="Goal ID")
    name: str = Field(..., description="Goal name")
    description: Optional[str] = Field(None, description="Goal description")
    embedding: list[float] = Field(..., description="Pre-computed embedding")


class FindSimilarGoalsRequest(BaseModel):
    """Request to find similar goals."""

    query_text: str = Field(..., min_length=1, description="Text to find similar goals for")
    candidates: list[GoalCandidateInput] = Field(..., description="Goal candidates with embeddings")
    threshold: float = Field(default=0.5, ge=0.0, le=1.0, description="Minimum similarity threshold")
    top_k: int = Field(default=5, ge=1, le=20, description="Maximum results to return")


class SimilarGoalResponse(BaseModel):
    """A similar goal match."""

    goal_id: str
    goal_name: str
    similarity: float


class FindSimilarGoalsResponse(BaseModel):
    """Response from similarity search."""

    matches: list[SimilarGoalResponse]
    processing_time_ms: float


class BatchGoalInput(BaseModel):
    """A goal for batch embedding."""

    id: str = Field(..., description="Goal ID")
    name: str = Field(..., description="Goal name")
    description: Optional[str] = Field(None, description="Goal description")


class BatchEmbeddingRequest(BaseModel):
    """Request to batch generate embeddings."""

    goals: list[BatchGoalInput] = Field(..., description="Goals to generate embeddings for")


class BatchEmbeddingResultItem(BaseModel):
    """Result for a single goal in batch."""

    id: str
    embedding: Optional[list[float]] = None
    success: bool
    error: Optional[str] = None


class BatchEmbeddingResponse(BaseModel):
    """Response with batch embeddings."""

    results: list[BatchEmbeddingResultItem]
    processed: int
    failed: int
    processing_time_ms: float


@router.post("/goals/embed", response_model=GoalEmbeddingResponse)
async def generate_goal_embedding(
    request: GenerateGoalEmbeddingRequest,
    service: GoalEmbeddingService = Depends(get_goal_embedding_service),
) -> GoalEmbeddingResponse:
    """Generate embedding for a single goal.

    Combines goal name and description into a semantic embedding vector.
    The resulting 384-dimensional vector can be stored and used for
    similarity matching.
    """
    result = service.generate_goal_embedding(
        name=request.name,
        description=request.description,
    )

    if result is None:
        raise HTTPException(
            status_code=500,
            detail="Failed to generate embedding. Ensure sentence-transformers is installed.",
        )

    return GoalEmbeddingResponse(
        embedding=result.embedding,
        model_name=result.model_name,
        dimension=result.dimension,
        processing_time_ms=result.processing_time_ms,
    )


@router.post("/goals/similar", response_model=FindSimilarGoalsResponse)
async def find_similar_goals(
    request: FindSimilarGoalsRequest,
    service: GoalEmbeddingService = Depends(get_goal_embedding_service),
) -> FindSimilarGoalsResponse:
    """Find similar goals from candidates.

    Computes cosine similarity between query text and each candidate's
    embedding. Returns matches above the threshold, sorted by similarity.
    """
    import time

    start_time = time.perf_counter()

    candidates = [
        {
            "id": c.id,
            "name": c.name,
            "description": c.description,
            "embedding": c.embedding,
        }
        for c in request.candidates
    ]

    matches = service.find_similar_goals(
        query_text=request.query_text,
        goal_candidates=candidates,
        threshold=request.threshold,
        top_k=request.top_k,
    )

    elapsed_ms = (time.perf_counter() - start_time) * 1000

    return FindSimilarGoalsResponse(
        matches=[
            SimilarGoalResponse(
                goal_id=m.goal_id,
                goal_name=m.goal_name,
                similarity=m.similarity,
            )
            for m in matches
        ],
        processing_time_ms=elapsed_ms,
    )


@router.post("/goals/embed-batch", response_model=BatchEmbeddingResponse)
async def batch_generate_embeddings(
    request: BatchEmbeddingRequest,
    service: GoalEmbeddingService = Depends(get_goal_embedding_service),
) -> BatchEmbeddingResponse:
    """Batch generate embeddings for multiple goals.

    Efficiently generates embeddings for many goals at once.
    Useful for backfilling embeddings for existing goals.
    """
    goals = [
        {
            "id": g.id,
            "name": g.name,
            "description": g.description,
        }
        for g in request.goals
    ]

    result = service.batch_generate_embeddings(goals)

    return BatchEmbeddingResponse(
        results=[
            BatchEmbeddingResultItem(
                id=r["id"],
                embedding=r.get("embedding"),
                success=r["success"],
                error=r.get("error"),
            )
            for r in result.results
        ],
        processed=result.processed,
        failed=result.failed,
        processing_time_ms=result.processing_time_ms,
    )
