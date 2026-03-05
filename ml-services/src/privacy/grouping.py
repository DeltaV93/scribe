"""Multi-dimensional grouping for privacy-preserving correction aggregation.

Implements grouping key generation for synthesizing corrections across organizations.
Groups corrections by form_id, action_type, meeting_type, and industry to preserve
signal quality while providing k-anonymity guarantees.

References:
- Spec: docs/specs/PX-887-897-898-ml-foundation-spec.md (Section 3.4)
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Sequence
from uuid import UUID

import structlog

logger = structlog.get_logger()


# Minimum number of corrections required to synthesize a group
# This provides k-anonymity guarantees
MINIMUM_CORRECTIONS_THRESHOLD = 50


class ActionType(str, Enum):
    """Types of user correction actions."""

    FIELD_EDIT = "field_edit"
    FIELD_ADD = "field_add"
    FIELD_DELETE = "field_delete"
    VALUE_CORRECT = "value_correct"
    STRUCTURE_CHANGE = "structure_change"
    APPROVAL = "approval"
    REJECTION = "rejection"


class MeetingType(str, Enum):
    """Types of meetings that generate corrections."""

    CLIENT_INTAKE = "client_intake"
    CASE_REVIEW = "case_review"
    SUPERVISION = "supervision"
    TEAM_STANDUP = "team_standup"
    CLIENT_CHECKIN = "client_checkin"
    PATIENT_VISIT = "patient_visit"
    SALES_CALL = "sales_call"
    USER_INTERVIEW = "user_interview"
    OTHER = "other"


class Industry(str, Enum):
    """Industry classifications for grouping."""

    NONPROFIT = "nonprofit"
    HEALTHCARE = "healthcare"
    TECH = "tech"
    LEGAL = "legal"
    SALES = "sales"
    UX_RESEARCH = "ux_research"
    EDUCATION = "education"
    GOVERNMENT = "government"
    OTHER = "other"


@dataclass(frozen=True)
class GroupingKey:
    """Multi-dimensional grouping key for correction aggregation.

    Corrections are grouped by these dimensions to:
    1. Preserve domain-specific signal quality
    2. Enable meaningful pattern extraction
    3. Provide k-anonymity (min 50 corrections per group)

    Attributes:
        form_id: Optional form ID (None for cross-form patterns)
        action_type: Type of correction action
        meeting_type: Type of meeting that generated the correction
        industry: Industry classification

    Example:
        key = GroupingKey(
            form_id=UUID("..."),
            action_type=ActionType.FIELD_EDIT,
            meeting_type=MeetingType.CLIENT_INTAKE,
            industry=Industry.NONPROFIT,
        )
    """

    form_id: Optional[UUID] = None
    action_type: Optional[ActionType] = None
    meeting_type: Optional[MeetingType] = None
    industry: Optional[Industry] = None

    def to_string(self) -> str:
        """Convert to string representation for database storage."""
        parts = []
        if self.form_id:
            parts.append(f"form:{self.form_id}")
        if self.action_type:
            parts.append(f"action:{self.action_type.value}")
        if self.meeting_type:
            parts.append(f"meeting:{self.meeting_type.value}")
        if self.industry:
            parts.append(f"industry:{self.industry.value}")
        return "|".join(parts) if parts else "global"

    @classmethod
    def from_string(cls, key_string: str) -> "GroupingKey":
        """Parse from string representation.

        Args:
            key_string: String representation of grouping key.

        Returns:
            Parsed GroupingKey instance.
        """
        if key_string == "global":
            return cls()

        parts = key_string.split("|")
        kwargs: Dict[str, Any] = {}

        for part in parts:
            if ":" not in part:
                continue
            key, value = part.split(":", 1)
            if key == "form":
                kwargs["form_id"] = UUID(value)
            elif key == "action":
                kwargs["action_type"] = ActionType(value)
            elif key == "meeting":
                kwargs["meeting_type"] = MeetingType(value)
            elif key == "industry":
                kwargs["industry"] = Industry(value)

        return cls(**kwargs)

    def generalize(self) -> "GroupingKey":
        """Return a more general grouping key by removing most specific dimension.

        Used when a specific group doesn't meet the threshold.
        Generalization order: form_id -> meeting_type -> action_type -> industry

        Returns:
            New GroupingKey with one fewer dimension.
        """
        if self.form_id:
            return GroupingKey(
                action_type=self.action_type,
                meeting_type=self.meeting_type,
                industry=self.industry,
            )
        elif self.meeting_type:
            return GroupingKey(
                action_type=self.action_type,
                industry=self.industry,
            )
        elif self.action_type:
            return GroupingKey(industry=self.industry)
        else:
            return GroupingKey()

    @property
    def specificity(self) -> int:
        """Return the specificity level (number of defined dimensions)."""
        count = 0
        if self.form_id:
            count += 1
        if self.action_type:
            count += 1
        if self.meeting_type:
            count += 1
        if self.industry:
            count += 1
        return count


@dataclass
class GroupStats:
    """Statistics for a correction group."""

    grouping_key: GroupingKey
    correction_count: int
    org_count: int
    form_ids: List[UUID]
    meets_threshold: bool = field(init=False)

    def __post_init__(self) -> None:
        """Calculate whether group meets minimum threshold."""
        self.meets_threshold = self.correction_count >= MINIMUM_CORRECTIONS_THRESHOLD


@dataclass
class CorrectionRecord:
    """A single correction record for grouping."""

    id: UUID
    org_id: UUID
    form_id: UUID
    action_type: ActionType
    meeting_type: Optional[MeetingType]
    industry: Optional[Industry]
    correction_data: dict
    created_at: Any  # datetime


class GroupingService:
    """Service for grouping corrections by multi-dimensional keys.

    Implements the grouping logic from the spec:
    1. Group by (form_id, action_type, meeting_type, industry)
    2. Check if group meets minimum threshold (50 corrections)
    3. If not, generalize the key and try again
    4. Track org count per group for privacy metrics

    Example:
        service = GroupingService()
        groups = service.group_corrections(corrections)
        for key, group in groups.items():
            if group.meets_threshold:
                # Ready for synthesis
    """

    def __init__(self, min_threshold: int = MINIMUM_CORRECTIONS_THRESHOLD) -> None:
        """Initialize the grouping service.

        Args:
            min_threshold: Minimum corrections required per group.
        """
        self.min_threshold = min_threshold
        self._logger = logger.bind(component="grouping_service")

    def create_grouping_key(
        self,
        correction: CorrectionRecord,
        include_form: bool = True,
    ) -> GroupingKey:
        """Create a grouping key from a correction record.

        Args:
            correction: The correction record to create a key for.
            include_form: Whether to include form_id in the key.

        Returns:
            GroupingKey for the correction.
        """
        return GroupingKey(
            form_id=correction.form_id if include_form else None,
            action_type=correction.action_type,
            meeting_type=correction.meeting_type,
            industry=correction.industry,
        )

    def group_corrections(
        self,
        corrections: Sequence[CorrectionRecord],
    ) -> Dict[GroupingKey, GroupStats]:
        """Group corrections by multi-dimensional keys.

        Args:
            corrections: List of correction records to group.

        Returns:
            Dictionary mapping GroupingKey to GroupStats.
        """
        # First pass: create fully-specified groups
        groups: Dict[GroupingKey, List[CorrectionRecord]] = {}

        for correction in corrections:
            key = self.create_grouping_key(correction)
            if key not in groups:
                groups[key] = []
            groups[key].append(correction)

        # Convert to GroupStats
        result: Dict[GroupingKey, GroupStats] = {}
        for key, group_corrections in groups.items():
            org_ids = set(c.org_id for c in group_corrections)
            form_ids = list(set(c.form_id for c in group_corrections))
            result[key] = GroupStats(
                grouping_key=key,
                correction_count=len(group_corrections),
                org_count=len(org_ids),
                form_ids=form_ids,
            )

        self._logger.info(
            "grouped_corrections",
            total_corrections=len(corrections),
            groups_created=len(result),
            groups_meeting_threshold=sum(1 for g in result.values() if g.meets_threshold),
        )

        return result

    def get_group_size(self, grouping_key: GroupingKey, corrections: Sequence[CorrectionRecord]) -> int:
        """Get the number of corrections matching a grouping key.

        Args:
            grouping_key: The key to match against.
            corrections: List of corrections to search.

        Returns:
            Number of corrections matching the key.
        """
        count = 0
        for correction in corrections:
            key = self.create_grouping_key(correction)
            if self._key_matches(key, grouping_key):
                count += 1
        return count

    def find_viable_groupings(
        self,
        corrections: Sequence[CorrectionRecord],
        max_generalization_levels: int = 4,
    ) -> Dict[GroupingKey, GroupStats]:
        """Find groupings that meet the minimum threshold.

        For groups that don't meet threshold, attempts to generalize
        until a viable grouping is found or max levels reached.

        Args:
            corrections: List of correction records.
            max_generalization_levels: Maximum times to generalize a key.

        Returns:
            Dictionary of viable groupings that meet threshold.
        """
        # Start with fully-specified groups
        groups = self.group_corrections(corrections)
        viable: Dict[GroupingKey, GroupStats] = {}
        pending: Dict[GroupingKey, List[CorrectionRecord]] = {}

        # Separate viable from non-viable
        for key, stats in groups.items():
            if stats.meets_threshold:
                viable[key] = stats
            else:
                # Need to generalize
                pending[key] = [
                    c for c in corrections
                    if self.create_grouping_key(c) == key
                ]

        # Try to generalize non-viable groups
        for _ in range(max_generalization_levels):
            if not pending:
                break

            new_pending: Dict[GroupingKey, List[CorrectionRecord]] = {}

            for key, group_corrections in pending.items():
                generalized_key = key.generalize()

                if generalized_key == key:
                    # Can't generalize further
                    self._logger.warning(
                        "cannot_generalize_further",
                        key=key.to_string(),
                        correction_count=len(group_corrections),
                    )
                    continue

                # Check if generalized key already exists
                if generalized_key in viable:
                    # Merge into existing viable group
                    existing = viable[generalized_key]
                    all_corrections = group_corrections + [
                        c for c in corrections
                        if self.create_grouping_key(c) == generalized_key
                    ]
                    org_ids = set(c.org_id for c in all_corrections)
                    form_ids = list(set(c.form_id for c in all_corrections))
                    viable[generalized_key] = GroupStats(
                        grouping_key=generalized_key,
                        correction_count=len(all_corrections),
                        org_count=len(org_ids),
                        form_ids=form_ids,
                    )
                else:
                    # Create new generalized group
                    if generalized_key not in new_pending:
                        new_pending[generalized_key] = []
                    new_pending[generalized_key].extend(group_corrections)

            # Check which new pending groups are now viable
            still_pending: Dict[GroupingKey, List[CorrectionRecord]] = {}
            for key, group_corrections in new_pending.items():
                if len(group_corrections) >= self.min_threshold:
                    org_ids = set(c.org_id for c in group_corrections)
                    form_ids = list(set(c.form_id for c in group_corrections))
                    viable[key] = GroupStats(
                        grouping_key=key,
                        correction_count=len(group_corrections),
                        org_count=len(org_ids),
                        form_ids=form_ids,
                    )
                else:
                    still_pending[key] = group_corrections

            pending = still_pending

        self._logger.info(
            "viable_groupings_found",
            viable_groups=len(viable),
            pending_groups=len(pending),
            pending_corrections=sum(len(v) for v in pending.values()),
        )

        return viable

    def _key_matches(self, specific: GroupingKey, general: GroupingKey) -> bool:
        """Check if a specific key matches a more general key.

        Args:
            specific: The more specific key.
            general: The more general key to match against.

        Returns:
            True if specific matches general (general dimensions are subset).
        """
        if general.form_id and specific.form_id != general.form_id:
            return False
        if general.action_type and specific.action_type != general.action_type:
            return False
        if general.meeting_type and specific.meeting_type != general.meeting_type:
            return False
        if general.industry and specific.industry != general.industry:
            return False
        return True
