"""Form matching feedback signals (PX-887 Phase 3).

Defines form-matching-specific feedback types and integrates with
the generic feedback service. Tracks:
- Form overrides (user selects different form than suggested)
- Form confirmations (user accepts auto-suggested form)
- Content edits (user modifies extracted data)
- Edit magnitude (significant vs minor edits using 20% threshold)
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from uuid import UUID

import structlog

logger = structlog.get_logger()


class FormMatchingFeedbackType(str, Enum):
    """Types of feedback specific to form matching."""

    # User accepted the auto-suggested form
    FORM_CONFIRMED = "form_confirmed"

    # User selected a different form from suggestions
    FORM_OVERRIDE_FROM_SUGGESTIONS = "form_override_suggestions"

    # User selected a form not in the suggestions
    FORM_OVERRIDE_MANUAL = "form_override_manual"

    # User selected "None of these"
    NO_FORM_MATCHED = "no_form_matched"

    # User made minor edits (<20% content change)
    MINOR_EDIT = "minor_edit"

    # User made significant edits (>=20% content change)
    SIGNIFICANT_EDIT = "significant_edit"


class FeedbackSignal(str, Enum):
    """Signal strength of the feedback."""

    STRONG_POSITIVE = "strong_positive"  # Confirmation without edits
    POSITIVE = "positive"  # Confirmation with minor edits
    NEUTRAL = "neutral"  # Selection from suggestions
    NEGATIVE = "negative"  # Override to different form
    STRONG_NEGATIVE = "strong_negative"  # Manual override or no match


# Content change threshold from PRD
SIGNIFICANT_EDIT_THRESHOLD = 0.20  # 20% content change


@dataclass
class FormMatchingFeedback:
    """A form matching feedback event.

    Captures the context of a form matching decision and the user's
    response, which will be used to improve the matching model.
    """

    # Identifiers
    org_id: UUID
    call_id: UUID
    user_id: UUID
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    # Form matching context
    suggested_form_id: Optional[UUID] = None
    suggested_form_name: Optional[str] = None
    suggested_confidence: Optional[float] = None
    suggested_rank: Optional[int] = None

    # All suggestions provided
    all_suggestions: list[dict] = field(default_factory=list)

    # User action
    selected_form_id: Optional[UUID] = None
    selected_form_name: Optional[str] = None
    feedback_type: Optional[FormMatchingFeedbackType] = None

    # Edit metrics (if applicable)
    edit_distance: Optional[float] = None
    content_change_ratio: Optional[float] = None
    fields_changed: int = 0
    total_fields: int = 0

    # Computed signal
    signal: Optional[FeedbackSignal] = None
    signal_weight: float = 1.0

    # Context
    meeting_type: Optional[str] = None
    industry: Optional[str] = None
    transcript_length: int = 0
    processing_time_ms: float = 0.0

    # Quality scoring (filled in by CorrectionScorer)
    quality_score: Optional[float] = None
    quality_flags: list[str] = field(default_factory=list)

    def __post_init__(self):
        """Compute signal from feedback type if not set."""
        if self.signal is None and self.feedback_type is not None:
            self.signal = self._compute_signal()

    def _compute_signal(self) -> FeedbackSignal:
        """Compute feedback signal from type and edit metrics."""
        if self.feedback_type == FormMatchingFeedbackType.FORM_CONFIRMED:
            if self.content_change_ratio is None or self.content_change_ratio < 0.05:
                return FeedbackSignal.STRONG_POSITIVE
            elif self.content_change_ratio < SIGNIFICANT_EDIT_THRESHOLD:
                return FeedbackSignal.POSITIVE
            else:
                return FeedbackSignal.NEUTRAL

        elif self.feedback_type == FormMatchingFeedbackType.FORM_OVERRIDE_FROM_SUGGESTIONS:
            return FeedbackSignal.NEUTRAL

        elif self.feedback_type in (
            FormMatchingFeedbackType.FORM_OVERRIDE_MANUAL,
            FormMatchingFeedbackType.NO_FORM_MATCHED,
        ):
            return FeedbackSignal.STRONG_NEGATIVE

        elif self.feedback_type == FormMatchingFeedbackType.MINOR_EDIT:
            return FeedbackSignal.POSITIVE

        elif self.feedback_type == FormMatchingFeedbackType.SIGNIFICANT_EDIT:
            return FeedbackSignal.NEGATIVE

        return FeedbackSignal.NEUTRAL


@dataclass
class EditAnalysis:
    """Analysis of content edits for feedback signals."""

    # Change metrics
    edit_distance: float  # Normalized Levenshtein distance
    content_change_ratio: float  # Ratio of changed content
    is_significant: bool  # Above 20% threshold

    # Field-level details
    fields_changed: int
    total_fields: int
    changed_field_names: list[str] = field(default_factory=list)

    # Character-level stats
    characters_added: int = 0
    characters_removed: int = 0
    characters_total: int = 0


def analyze_edits(
    original_output: dict,
    edited_output: dict,
    threshold: float = SIGNIFICANT_EDIT_THRESHOLD,
) -> EditAnalysis:
    """Analyze the magnitude of content edits.

    Compares original ML-extracted output to user-edited version
    to determine if changes are significant (>20% by default).

    Args:
        original_output: Original extracted field values
        edited_output: User-edited field values
        threshold: Significance threshold (default 0.20)

    Returns:
        EditAnalysis with change metrics
    """
    fields_changed = 0
    changed_fields = []
    total_fields = 0

    chars_added = 0
    chars_removed = 0
    chars_total = 0

    # Compare each field
    all_keys = set(original_output.keys()) | set(edited_output.keys())

    for key in all_keys:
        original_value = original_output.get(key, "")
        edited_value = edited_output.get(key, "")

        # Convert to strings for comparison
        orig_str = str(original_value) if original_value else ""
        edit_str = str(edited_value) if edited_value else ""

        total_fields += 1
        chars_total += max(len(orig_str), len(edit_str))

        if orig_str != edit_str:
            fields_changed += 1
            changed_fields.append(key)

            # Character-level changes
            if len(edit_str) > len(orig_str):
                chars_added += len(edit_str) - len(orig_str)
            else:
                chars_removed += len(orig_str) - len(edit_str)

    # Calculate overall change ratio
    if chars_total > 0:
        content_change_ratio = (chars_added + chars_removed) / chars_total
    else:
        content_change_ratio = 0.0

    # Calculate edit distance (normalized)
    edit_distance = _calculate_edit_distance(original_output, edited_output)

    return EditAnalysis(
        edit_distance=edit_distance,
        content_change_ratio=content_change_ratio,
        is_significant=content_change_ratio >= threshold,
        fields_changed=fields_changed,
        total_fields=total_fields,
        changed_field_names=changed_fields,
        characters_added=chars_added,
        characters_removed=chars_removed,
        characters_total=chars_total,
    )


def _calculate_edit_distance(original: dict, edited: dict) -> float:
    """Calculate normalized edit distance between two dictionaries.

    Uses a simplified approach that compares serialized JSON strings.
    """
    import json

    orig_str = json.dumps(original, sort_keys=True, default=str)
    edit_str = json.dumps(edited, sort_keys=True, default=str)

    # Use Levenshtein distance
    distance = _levenshtein_distance(orig_str, edit_str)

    # Normalize by max length
    max_len = max(len(orig_str), len(edit_str))
    if max_len == 0:
        return 0.0

    return distance / max_len


def _levenshtein_distance(s1: str, s2: str) -> int:
    """Compute Levenshtein distance between two strings."""
    if len(s1) < len(s2):
        return _levenshtein_distance(s2, s1)

    if len(s2) == 0:
        return len(s1)

    previous_row = range(len(s2) + 1)

    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            # Cost is 0 if chars match, 1 otherwise
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row

    return previous_row[-1]


class FormMatchingFeedbackCollector:
    """Collects and processes form matching feedback.

    This is the main entry point for recording user interactions
    with form matching suggestions.
    """

    def __init__(self):
        self._pending_feedback: list[FormMatchingFeedback] = []

    def record_confirmation(
        self,
        org_id: UUID,
        call_id: UUID,
        user_id: UUID,
        suggested_form_id: UUID,
        suggested_form_name: str,
        suggested_confidence: float,
        all_suggestions: list[dict],
        industry: Optional[str] = None,
        meeting_type: Optional[str] = None,
    ) -> FormMatchingFeedback:
        """Record that user confirmed the auto-suggested form.

        This is a positive signal - the model got it right.
        """
        feedback = FormMatchingFeedback(
            org_id=org_id,
            call_id=call_id,
            user_id=user_id,
            suggested_form_id=suggested_form_id,
            suggested_form_name=suggested_form_name,
            suggested_confidence=suggested_confidence,
            suggested_rank=1,
            all_suggestions=all_suggestions,
            selected_form_id=suggested_form_id,
            selected_form_name=suggested_form_name,
            feedback_type=FormMatchingFeedbackType.FORM_CONFIRMED,
            industry=industry,
            meeting_type=meeting_type,
        )

        self._pending_feedback.append(feedback)

        logger.info(
            "Form confirmation recorded",
            org_id=str(org_id),
            call_id=str(call_id),
            form_id=str(suggested_form_id),
            confidence=suggested_confidence,
        )

        return feedback

    def record_override(
        self,
        org_id: UUID,
        call_id: UUID,
        user_id: UUID,
        suggested_form_id: Optional[UUID],
        suggested_form_name: Optional[str],
        suggested_confidence: Optional[float],
        selected_form_id: UUID,
        selected_form_name: str,
        all_suggestions: list[dict],
        was_in_suggestions: bool,
        industry: Optional[str] = None,
        meeting_type: Optional[str] = None,
    ) -> FormMatchingFeedback:
        """Record that user selected a different form than suggested.

        This is a negative signal - the model got it wrong.
        """
        # Determine rank of selected form if it was in suggestions
        selected_rank = None
        if was_in_suggestions:
            for i, suggestion in enumerate(all_suggestions):
                if str(suggestion.get("form_id")) == str(selected_form_id):
                    selected_rank = i + 1
                    break

        feedback_type = (
            FormMatchingFeedbackType.FORM_OVERRIDE_FROM_SUGGESTIONS
            if was_in_suggestions
            else FormMatchingFeedbackType.FORM_OVERRIDE_MANUAL
        )

        feedback = FormMatchingFeedback(
            org_id=org_id,
            call_id=call_id,
            user_id=user_id,
            suggested_form_id=suggested_form_id,
            suggested_form_name=suggested_form_name,
            suggested_confidence=suggested_confidence,
            suggested_rank=1 if suggested_form_id else None,
            all_suggestions=all_suggestions,
            selected_form_id=selected_form_id,
            selected_form_name=selected_form_name,
            feedback_type=feedback_type,
            industry=industry,
            meeting_type=meeting_type,
        )

        self._pending_feedback.append(feedback)

        logger.info(
            "Form override recorded",
            org_id=str(org_id),
            call_id=str(call_id),
            suggested_form_id=str(suggested_form_id) if suggested_form_id else None,
            selected_form_id=str(selected_form_id),
            was_in_suggestions=was_in_suggestions,
            selected_rank=selected_rank,
        )

        return feedback

    def record_no_match(
        self,
        org_id: UUID,
        call_id: UUID,
        user_id: UUID,
        all_suggestions: list[dict],
        industry: Optional[str] = None,
        meeting_type: Optional[str] = None,
    ) -> FormMatchingFeedback:
        """Record that user selected 'None of these' for all suggestions.

        Strong negative signal - none of the suggestions were appropriate.
        """
        top_suggestion = all_suggestions[0] if all_suggestions else {}

        feedback = FormMatchingFeedback(
            org_id=org_id,
            call_id=call_id,
            user_id=user_id,
            suggested_form_id=(
                UUID(top_suggestion["form_id"])
                if top_suggestion.get("form_id")
                else None
            ),
            suggested_form_name=top_suggestion.get("form_name"),
            suggested_confidence=top_suggestion.get("confidence"),
            suggested_rank=1 if all_suggestions else None,
            all_suggestions=all_suggestions,
            selected_form_id=None,
            selected_form_name=None,
            feedback_type=FormMatchingFeedbackType.NO_FORM_MATCHED,
            industry=industry,
            meeting_type=meeting_type,
        )

        self._pending_feedback.append(feedback)

        logger.info(
            "No form match recorded",
            org_id=str(org_id),
            call_id=str(call_id),
            suggestion_count=len(all_suggestions),
        )

        return feedback

    def record_content_edit(
        self,
        org_id: UUID,
        call_id: UUID,
        user_id: UUID,
        form_id: UUID,
        form_name: str,
        original_output: dict,
        edited_output: dict,
        confidence: Optional[float] = None,
        industry: Optional[str] = None,
    ) -> FormMatchingFeedback:
        """Record content edits to extracted data.

        Analyzes the magnitude of edits to determine signal strength.
        """
        # Analyze edits
        analysis = analyze_edits(original_output, edited_output)

        feedback_type = (
            FormMatchingFeedbackType.SIGNIFICANT_EDIT
            if analysis.is_significant
            else FormMatchingFeedbackType.MINOR_EDIT
        )

        feedback = FormMatchingFeedback(
            org_id=org_id,
            call_id=call_id,
            user_id=user_id,
            selected_form_id=form_id,
            selected_form_name=form_name,
            suggested_confidence=confidence,
            feedback_type=feedback_type,
            edit_distance=analysis.edit_distance,
            content_change_ratio=analysis.content_change_ratio,
            fields_changed=analysis.fields_changed,
            total_fields=analysis.total_fields,
            industry=industry,
        )

        self._pending_feedback.append(feedback)

        logger.info(
            "Content edit recorded",
            org_id=str(org_id),
            call_id=str(call_id),
            form_id=str(form_id),
            is_significant=analysis.is_significant,
            content_change_ratio=analysis.content_change_ratio,
            fields_changed=analysis.fields_changed,
        )

        return feedback

    def get_pending_feedback(self) -> list[FormMatchingFeedback]:
        """Get all pending feedback events."""
        return list(self._pending_feedback)

    def clear_pending(self) -> int:
        """Clear pending feedback after processing."""
        count = len(self._pending_feedback)
        self._pending_feedback.clear()
        return count


# Global collector instance
_collector: Optional[FormMatchingFeedbackCollector] = None


def get_feedback_collector() -> FormMatchingFeedbackCollector:
    """Get the global feedback collector instance."""
    global _collector
    if _collector is None:
        _collector = FormMatchingFeedbackCollector()
    return _collector
