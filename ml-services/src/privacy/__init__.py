"""Differential Privacy & Data Synthesis Layer (PX-897).

This module implements differential privacy guarantees for global model training:
- DifferentialPrivacyEngine: Applies DP noise using OpenDP library
- PrivacyBudgetTracker: Tracks epsilon consumption per organization
- DataSynthesizer: Generates synthetic correction patterns
- GroupingKey: Multi-dimensional grouping for correction aggregation

Security guarantees:
- All corrections synthesized before entering global training pipeline
- Org identifiers stripped, composite examples created from multi-org patterns
- Epsilon budget tracked per data cohort with alerts at 80% consumption
- Minimum 50 corrections threshold per grouping key
"""

from src.privacy.dp_engine import DifferentialPrivacyEngine, QueryType
from src.privacy.budget_tracker import PrivacyBudgetTracker
from src.privacy.grouping import GroupingKey, GroupingService, GroupStats, MINIMUM_CORRECTIONS_THRESHOLD
from src.privacy.synthesis import DataSynthesizer

__all__ = [
    "DifferentialPrivacyEngine",
    "QueryType",
    "PrivacyBudgetTracker",
    "GroupingKey",
    "GroupingService",
    "GroupStats",
    "MINIMUM_CORRECTIONS_THRESHOLD",
    "DataSynthesizer",
]
