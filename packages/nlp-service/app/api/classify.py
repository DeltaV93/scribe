"""
Classification API endpoint.
PX-878: Tiered Content Classifier
"""

import time
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Header

from app.schemas.sensitivity import (
    ClassifyRequest,
    ClassifyResponse,
    SensitivitySegmentResult,
    SensitivityTier,
    SegmentSignals,
    SentimentSignal,
)
from app.main import get_classifier, CLASSIFICATION_COUNT


router = APIRouter()
logger = logging.getLogger(__name__)

# Confidence threshold for human review
REVIEW_CONFIDENCE_THRESHOLD = float(__import__("os").getenv("SENSITIVITY_CONFIDENCE_THRESHOLD", "0.70"))


@router.post("/classify", response_model=ClassifyResponse)
async def classify_segments(
    request: ClassifyRequest,
    x_request_id: Optional[str] = Header(None, alias="X-Request-ID"),
    x_org_id: Optional[str] = Header(None, alias="X-Org-ID"),
):
    """
    Classify transcript segments into sensitivity tiers.

    Returns classification results for each segment with confidence scores
    and signals. If any segment is classified as REDACTED or has low
    confidence, the response will indicate review is required.
    """
    start_time = time.time()

    # Validate input
    if not request.segments:
        return ClassifyResponse(
            success=True,
            segments=[],
            overall_tier=SensitivityTier.STANDARD,
            confidence=1.0,
            model_version="v1.0.0",
            requires_review=False,
            processing_time_ms=0,
        )

    # Get classifier
    classifier = get_classifier()

    # Classify each segment
    results: list[SensitivitySegmentResult] = []
    overall_tier = SensitivityTier.STANDARD
    min_confidence = 1.0
    requires_review = False
    review_reasons: list[str] = []

    for segment in request.segments:
        try:
            # Get classification
            tier, confidence, category, signals = classifier.classify(
                text=segment.text,
                speaker=segment.speaker,
            )

            # Determine if review is needed
            needs_review = False
            review_reason = None

            if confidence < REVIEW_CONFIDENCE_THRESHOLD:
                needs_review = True
                review_reason = f"Low confidence ({confidence:.0%})"
                review_reasons.append(review_reason)

            if tier == SensitivityTier.REDACTED:
                needs_review = True
                review_reason = "REDACTED content requires confirmation"
                if review_reason not in review_reasons:
                    review_reasons.append(review_reason)

            # Track metrics
            CLASSIFICATION_COUNT.labels(tier=tier.value).inc()

            # Build result
            result = SensitivitySegmentResult(
                segment_index=segment.index,
                start_time=segment.start_time,
                end_time=segment.end_time,
                text=segment.text,
                tier=tier,
                confidence=confidence,
                category=category,
                signals=signals,
                needs_review=needs_review,
                review_reason=review_reason,
            )
            results.append(result)

            # Update overall metrics
            if needs_review:
                requires_review = True

            if confidence < min_confidence:
                min_confidence = confidence

            # Determine highest risk tier
            if tier == SensitivityTier.REDACTED:
                overall_tier = SensitivityTier.REDACTED
            elif tier == SensitivityTier.RESTRICTED and overall_tier != SensitivityTier.REDACTED:
                overall_tier = SensitivityTier.RESTRICTED

        except Exception as e:
            logger.error(f"Error classifying segment {segment.index}: {e}")
            # Default to STANDARD with low confidence on error
            results.append(SensitivitySegmentResult(
                segment_index=segment.index,
                start_time=segment.start_time,
                end_time=segment.end_time,
                text=segment.text,
                tier=SensitivityTier.STANDARD,
                confidence=0.5,
                category=None,
                signals=SegmentSignals(
                    entities=[],
                    sentiment=SentimentSignal(
                        compound=0.0,
                        positive=0.0,
                        negative=0.0,
                        neutral=1.0,
                        category="NEUTRAL"
                    ),
                    taxonomy=[],
                ),
                needs_review=True,
                review_reason="Classification error - manual review required",
            ))
            requires_review = True
            min_confidence = min(min_confidence, 0.5)

    # Calculate processing time
    processing_time_ms = (time.time() - start_time) * 1000

    # Build block reason if needed
    block_reason = None
    if requires_review:
        if overall_tier == SensitivityTier.REDACTED:
            block_reason = f"REDACTED content detected with {min_confidence:.0%} confidence"
        elif min_confidence < REVIEW_CONFIDENCE_THRESHOLD:
            block_reason = f"Low confidence classification ({min_confidence:.0%})"

    logger.info(
        f"Classified {len(results)} segments: "
        f"overall_tier={overall_tier.value}, "
        f"confidence={min_confidence:.2f}, "
        f"requires_review={requires_review}, "
        f"duration={processing_time_ms:.0f}ms"
    )

    return ClassifyResponse(
        success=True,
        segments=results,
        overall_tier=overall_tier,
        confidence=min_confidence,
        model_version=classifier.version,
        requires_review=requires_review,
        block_reason=block_reason,
        processing_time_ms=processing_time_ms,
    )
