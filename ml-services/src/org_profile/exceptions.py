"""Org Profile domain exceptions."""

from datetime import datetime
from typing import Optional
from uuid import UUID


class PrivacyBudgetExhausted(Exception):
    """Raised when an org's privacy budget is exhausted."""

    def __init__(
        self,
        org_id: UUID,
        consumed: float,
        budget: float,
        resets_at: Optional[datetime] = None,
    ):
        self.org_id = org_id
        self.consumed = consumed
        self.budget = budget
        self.resets_at = resets_at
        super().__init__(
            f"Privacy budget exhausted for org {org_id}: "
            f"{consumed}/{budget} consumed"
        )

    def to_dict(self) -> dict:
        """Convert to API error response format."""
        return {
            "code": "PRIVACY_BUDGET_EXHAUSTED",
            "message": "Organization privacy budget exhausted",
            "details": {
                "org_id": str(self.org_id),
                "consumed": self.consumed,
                "budget": self.budget,
                "resets_at": self.resets_at.isoformat() if self.resets_at else None,
            },
        }
