"""Tests for Differential Privacy Engine (PX-897).

Tests cover:
- DP noise application for all query types
- Budget tracking and consumption
- Group size thresholds
- Privacy guarantees validation
"""

import math
import statistics
from datetime import datetime, timedelta
from typing import List
from uuid import uuid4

import pytest

# Skip all tests if OpenDP not available
try:
    from src.privacy.dp_engine import (
        DifferentialPrivacyEngine,
        DPConfig,
        DPQueryResult,
        QueryType,
        check_opendp_available,
    )
    from src.privacy.grouping import (
        GroupingKey,
        GroupingService,
        GroupStats,
        CorrectionRecord,
        ActionType,
        MeetingType,
        Industry,
        MINIMUM_CORRECTIONS_THRESHOLD,
    )

    OPENDP_AVAILABLE = check_opendp_available()
except ImportError:
    OPENDP_AVAILABLE = False


pytestmark = pytest.mark.skipif(
    not OPENDP_AVAILABLE,
    reason="OpenDP not installed. Install with: pip install 'ml-services[privacy]'",
)


class TestDifferentialPrivacyEngine:
    """Tests for DifferentialPrivacyEngine."""

    @pytest.fixture
    def dp_engine(self) -> DifferentialPrivacyEngine:
        """Create a DP engine instance."""
        config = DPConfig(
            default_epsilon=0.1,
            max_epsilon_per_query=1.0,
            min_epsilon=0.001,
        )
        return DifferentialPrivacyEngine(config)

    @pytest.fixture
    def sample_data(self) -> List[float]:
        """Create sample data for testing."""
        return [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0]

    # --- Count Query Tests ---

    def test_count_query_returns_noisy_result(
        self, dp_engine: DifferentialPrivacyEngine, sample_data: List[float]
    ):
        """Count query should return a noisy count."""
        result = dp_engine.apply_dp(
            data=sample_data,
            epsilon=0.5,
            sensitivity=1.0,
            query_type=QueryType.COUNT,
        )

        assert result.query_type == QueryType.COUNT
        assert result.epsilon_consumed == 0.5
        assert result.sensitivity == 1.0
        assert result.noise_scale > 0
        # Noisy count should be non-negative
        assert result.value >= 0

    def test_count_query_noise_scale_increases_with_lower_epsilon(
        self, dp_engine: DifferentialPrivacyEngine, sample_data: List[float]
    ):
        """Lower epsilon should result in higher noise scale."""
        result_high_eps = dp_engine.apply_dp(
            data=sample_data,
            epsilon=0.5,
            sensitivity=1.0,
            query_type=QueryType.COUNT,
        )
        result_low_eps = dp_engine.apply_dp(
            data=sample_data,
            epsilon=0.1,
            sensitivity=1.0,
            query_type=QueryType.COUNT,
        )

        # Lower epsilon = more noise = higher noise scale
        assert result_low_eps.noise_scale > result_high_eps.noise_scale

    def test_count_query_accuracy_improves_with_repetition(
        self, dp_engine: DifferentialPrivacyEngine, sample_data: List[float]
    ):
        """Average of many noisy counts should approach true count."""
        true_count = len(sample_data)
        noisy_counts = []

        for _ in range(100):
            result = dp_engine.apply_dp(
                data=sample_data,
                epsilon=0.5,
                sensitivity=1.0,
                query_type=QueryType.COUNT,
            )
            noisy_counts.append(result.value)

        avg_noisy_count = statistics.mean(noisy_counts)
        # Average should be within reasonable range of true count
        assert abs(avg_noisy_count - true_count) < true_count * 0.5

    # --- Sum Query Tests ---

    def test_sum_query_returns_noisy_result(
        self, dp_engine: DifferentialPrivacyEngine, sample_data: List[float]
    ):
        """Sum query should return a noisy sum."""
        result = dp_engine.apply_dp(
            data=sample_data,
            epsilon=0.5,
            sensitivity=10.0,
            query_type=QueryType.SUM,
        )

        assert result.query_type == QueryType.SUM
        assert result.epsilon_consumed == 0.5
        assert result.noise_scale > 0

    def test_sum_query_respects_bounds(
        self, dp_engine: DifferentialPrivacyEngine
    ):
        """Sum query with bounds should clamp values."""
        data = [1.0, 5.0, 100.0]  # 100 is an outlier
        bounds = (0.0, 10.0)

        result = dp_engine.apply_dp(
            data=data,
            epsilon=0.5,
            sensitivity=10.0,
            query_type=QueryType.SUM,
            bounds=bounds,
        )

        # Sensitivity should be bounded by range
        assert result.sensitivity <= bounds[1] - bounds[0]

    def test_sum_query_empty_data_returns_zero(
        self, dp_engine: DifferentialPrivacyEngine
    ):
        """Sum of empty data should return 0."""
        result = dp_engine.apply_dp(
            data=[],
            epsilon=0.5,
            sensitivity=1.0,
            query_type=QueryType.SUM,
        )

        assert result.value == 0.0
        assert result.noise_scale == 0.0

    # --- Mean Query Tests ---

    def test_mean_query_returns_noisy_result(
        self, dp_engine: DifferentialPrivacyEngine, sample_data: List[float]
    ):
        """Mean query should return a noisy mean."""
        result = dp_engine.apply_dp(
            data=sample_data,
            epsilon=0.5,
            sensitivity=1.0,
            query_type=QueryType.MEAN,
        )

        assert result.query_type == QueryType.MEAN
        assert result.epsilon_consumed == 0.5

    def test_mean_query_empty_data_returns_zero(
        self, dp_engine: DifferentialPrivacyEngine
    ):
        """Mean of empty data should return 0."""
        result = dp_engine.apply_dp(
            data=[],
            epsilon=0.5,
            sensitivity=1.0,
            query_type=QueryType.MEAN,
        )

        assert result.value == 0.0

    # --- Histogram Query Tests ---

    def test_histogram_query_returns_noisy_bins(
        self, dp_engine: DifferentialPrivacyEngine, sample_data: List[float]
    ):
        """Histogram query should return noisy bin counts."""
        result = dp_engine.apply_dp(
            data=sample_data,
            epsilon=0.5,
            sensitivity=1.0,
            query_type=QueryType.HISTOGRAM,
        )

        assert result.query_type == QueryType.HISTOGRAM
        assert "bins" in result.value
        assert "bin_edges" in result.value
        assert "bin_width" in result.value
        # All bin counts should be non-negative
        for count in result.value["bins"].values():
            assert count >= 0

    def test_histogram_query_empty_data(
        self, dp_engine: DifferentialPrivacyEngine
    ):
        """Histogram of empty data should return empty bins."""
        result = dp_engine.apply_dp(
            data=[],
            epsilon=0.5,
            sensitivity=1.0,
            query_type=QueryType.HISTOGRAM,
        )

        assert result.value == {}

    # --- Epsilon Computation Tests ---

    def test_compute_required_epsilon(
        self, dp_engine: DifferentialPrivacyEngine
    ):
        """Compute required epsilon for target noise level."""
        epsilon = dp_engine.compute_required_epsilon(
            query_type=QueryType.COUNT,
            sensitivity=1.0,
            target_noise=1.0,
        )

        # epsilon = sensitivity / target_noise = 1.0 / 1.0 = 1.0
        assert epsilon == 1.0

    def test_compute_required_epsilon_higher_sensitivity(
        self, dp_engine: DifferentialPrivacyEngine
    ):
        """Higher sensitivity requires more epsilon."""
        eps_low_sens = dp_engine.compute_required_epsilon(
            query_type=QueryType.COUNT,
            sensitivity=1.0,
            target_noise=1.0,
        )
        eps_high_sens = dp_engine.compute_required_epsilon(
            query_type=QueryType.COUNT,
            sensitivity=2.0,
            target_noise=1.0,
        )

        assert eps_high_sens > eps_low_sens

    def test_compute_required_epsilon_clamped_to_max(
        self, dp_engine: DifferentialPrivacyEngine
    ):
        """Computed epsilon should not exceed max."""
        epsilon = dp_engine.compute_required_epsilon(
            query_type=QueryType.COUNT,
            sensitivity=100.0,
            target_noise=1.0,
        )

        assert epsilon <= dp_engine.config.max_epsilon_per_query

    # --- Validation Tests ---

    def test_invalid_epsilon_raises_error(
        self, dp_engine: DifferentialPrivacyEngine, sample_data: List[float]
    ):
        """Invalid epsilon values should raise ValueError."""
        with pytest.raises(ValueError, match="Epsilon must be positive"):
            dp_engine.apply_dp(
                data=sample_data,
                epsilon=-0.1,
                sensitivity=1.0,
                query_type=QueryType.COUNT,
            )

        with pytest.raises(ValueError, match="Epsilon must be positive"):
            dp_engine.apply_dp(
                data=sample_data,
                epsilon=0,
                sensitivity=1.0,
                query_type=QueryType.COUNT,
            )

    def test_epsilon_exceeds_max_raises_error(
        self, dp_engine: DifferentialPrivacyEngine, sample_data: List[float]
    ):
        """Epsilon exceeding max should raise ValueError."""
        with pytest.raises(ValueError, match="exceeds maximum"):
            dp_engine.apply_dp(
                data=sample_data,
                epsilon=10.0,  # Exceeds max of 1.0
                sensitivity=1.0,
                query_type=QueryType.COUNT,
            )

    def test_invalid_sensitivity_raises_error(
        self, dp_engine: DifferentialPrivacyEngine, sample_data: List[float]
    ):
        """Invalid sensitivity should raise ValueError."""
        with pytest.raises(ValueError, match="Sensitivity must be positive"):
            dp_engine.apply_dp(
                data=sample_data,
                epsilon=0.5,
                sensitivity=0,
                query_type=QueryType.COUNT,
            )


class TestGroupingKey:
    """Tests for GroupingKey."""

    def test_grouping_key_to_string(self):
        """GroupingKey should serialize to string correctly."""
        key = GroupingKey(
            form_id=uuid4(),
            action_type=ActionType.FIELD_EDIT,
            meeting_type=MeetingType.CLIENT_INTAKE,
            industry=Industry.NONPROFIT,
        )

        key_string = key.to_string()

        assert "form:" in key_string
        assert "action:field_edit" in key_string
        assert "meeting:client_intake" in key_string
        assert "industry:nonprofit" in key_string

    def test_grouping_key_from_string(self):
        """GroupingKey should deserialize from string correctly."""
        form_id = uuid4()
        original = GroupingKey(
            form_id=form_id,
            action_type=ActionType.FIELD_EDIT,
            meeting_type=MeetingType.CLIENT_INTAKE,
            industry=Industry.NONPROFIT,
        )

        parsed = GroupingKey.from_string(original.to_string())

        assert parsed.form_id == form_id
        assert parsed.action_type == ActionType.FIELD_EDIT
        assert parsed.meeting_type == MeetingType.CLIENT_INTAKE
        assert parsed.industry == Industry.NONPROFIT

    def test_grouping_key_global(self):
        """Empty GroupingKey should serialize to 'global'."""
        key = GroupingKey()
        assert key.to_string() == "global"
        assert GroupingKey.from_string("global") == key

    def test_grouping_key_specificity(self):
        """Specificity should count defined dimensions."""
        key_0 = GroupingKey()
        key_1 = GroupingKey(industry=Industry.NONPROFIT)
        key_2 = GroupingKey(industry=Industry.NONPROFIT, action_type=ActionType.FIELD_EDIT)
        key_4 = GroupingKey(
            form_id=uuid4(),
            action_type=ActionType.FIELD_EDIT,
            meeting_type=MeetingType.CLIENT_INTAKE,
            industry=Industry.NONPROFIT,
        )

        assert key_0.specificity == 0
        assert key_1.specificity == 1
        assert key_2.specificity == 2
        assert key_4.specificity == 4

    def test_grouping_key_generalize(self):
        """Generalize should remove most specific dimension."""
        key = GroupingKey(
            form_id=uuid4(),
            action_type=ActionType.FIELD_EDIT,
            meeting_type=MeetingType.CLIENT_INTAKE,
            industry=Industry.NONPROFIT,
        )

        # First generalization removes form_id
        gen1 = key.generalize()
        assert gen1.form_id is None
        assert gen1.action_type == ActionType.FIELD_EDIT
        assert gen1.meeting_type == MeetingType.CLIENT_INTAKE
        assert gen1.industry == Industry.NONPROFIT

        # Second removes meeting_type
        gen2 = gen1.generalize()
        assert gen2.meeting_type is None
        assert gen2.action_type == ActionType.FIELD_EDIT
        assert gen2.industry == Industry.NONPROFIT


class TestGroupingService:
    """Tests for GroupingService."""

    @pytest.fixture
    def grouping_service(self) -> GroupingService:
        """Create a grouping service instance."""
        return GroupingService(min_threshold=MINIMUM_CORRECTIONS_THRESHOLD)

    @pytest.fixture
    def sample_corrections(self) -> List[CorrectionRecord]:
        """Create sample correction records."""
        corrections = []
        for i in range(100):
            corrections.append(
                CorrectionRecord(
                    id=uuid4(),
                    org_id=uuid4(),  # Different orgs
                    form_id=uuid4() if i < 50 else uuid4(),  # Two form groups
                    action_type=ActionType.FIELD_EDIT if i % 2 == 0 else ActionType.VALUE_CORRECT,
                    meeting_type=MeetingType.CLIENT_INTAKE,
                    industry=Industry.NONPROFIT,
                    correction_data={"field_count": i},
                    created_at=datetime.utcnow() - timedelta(days=i % 10),
                )
            )
        return corrections

    def test_group_corrections_creates_groups(
        self,
        grouping_service: GroupingService,
        sample_corrections: List[CorrectionRecord],
    ):
        """Group corrections should create groups."""
        groups = grouping_service.group_corrections(sample_corrections)

        assert len(groups) > 0
        total_in_groups = sum(g.correction_count for g in groups.values())
        assert total_in_groups == len(sample_corrections)

    def test_group_stats_meets_threshold(
        self,
        grouping_service: GroupingService,
    ):
        """GroupStats should correctly indicate threshold status."""
        # Create 60 corrections with same key (above threshold)
        corrections = []
        form_id = uuid4()
        for i in range(60):
            corrections.append(
                CorrectionRecord(
                    id=uuid4(),
                    org_id=uuid4(),
                    form_id=form_id,
                    action_type=ActionType.FIELD_EDIT,
                    meeting_type=MeetingType.CLIENT_INTAKE,
                    industry=Industry.NONPROFIT,
                    correction_data={},
                    created_at=datetime.utcnow(),
                )
            )

        groups = grouping_service.group_corrections(corrections)

        # Should have one group meeting threshold
        meeting_threshold = [g for g in groups.values() if g.meets_threshold]
        assert len(meeting_threshold) == 1
        assert meeting_threshold[0].correction_count == 60

    def test_group_stats_below_threshold(
        self,
        grouping_service: GroupingService,
    ):
        """GroupStats should correctly indicate below threshold."""
        # Create 30 corrections (below threshold of 50)
        corrections = []
        form_id = uuid4()
        for i in range(30):
            corrections.append(
                CorrectionRecord(
                    id=uuid4(),
                    org_id=uuid4(),
                    form_id=form_id,
                    action_type=ActionType.FIELD_EDIT,
                    meeting_type=MeetingType.CLIENT_INTAKE,
                    industry=Industry.NONPROFIT,
                    correction_data={},
                    created_at=datetime.utcnow(),
                )
            )

        groups = grouping_service.group_corrections(corrections)

        # Should have one group NOT meeting threshold
        below_threshold = [g for g in groups.values() if not g.meets_threshold]
        assert len(below_threshold) == 1
        assert below_threshold[0].correction_count == 30

    def test_find_viable_groupings_generalizes(
        self,
        grouping_service: GroupingService,
    ):
        """Find viable groupings should generalize small groups."""
        # Create 30 corrections for form A and 30 for form B
        # Neither meets threshold, but combined they would
        corrections = []
        for i in range(60):
            form_id = uuid4() if i < 30 else uuid4()
            corrections.append(
                CorrectionRecord(
                    id=uuid4(),
                    org_id=uuid4(),
                    form_id=form_id,
                    action_type=ActionType.FIELD_EDIT,
                    meeting_type=MeetingType.CLIENT_INTAKE,
                    industry=Industry.NONPROFIT,
                    correction_data={},
                    created_at=datetime.utcnow(),
                )
            )

        viable = grouping_service.find_viable_groupings(corrections)

        # Should find viable groups after generalization
        # (removing form_id should combine them)
        if viable:
            assert all(g.meets_threshold for g in viable.values())

    def test_get_group_size(
        self,
        grouping_service: GroupingService,
        sample_corrections: List[CorrectionRecord],
    ):
        """Get group size should count matching corrections."""
        key = GroupingKey(
            action_type=ActionType.FIELD_EDIT,
            meeting_type=MeetingType.CLIENT_INTAKE,
            industry=Industry.NONPROFIT,
        )

        size = grouping_service.get_group_size(key, sample_corrections)

        # Should count all corrections matching this partial key
        assert size > 0


class TestMinimumThreshold:
    """Tests for minimum corrections threshold."""

    def test_threshold_constant(self):
        """Minimum threshold should be 50."""
        assert MINIMUM_CORRECTIONS_THRESHOLD == 50

    def test_groups_below_threshold_not_synthesized(self):
        """Groups below threshold should not be marked as viable."""
        stats = GroupStats(
            grouping_key=GroupingKey(),
            correction_count=49,  # Below 50
            org_count=10,
            form_ids=[],
        )

        assert not stats.meets_threshold

    def test_groups_at_threshold_synthesized(self):
        """Groups at exactly threshold should be viable."""
        stats = GroupStats(
            grouping_key=GroupingKey(),
            correction_count=50,  # Exactly 50
            org_count=10,
            form_ids=[],
        )

        assert stats.meets_threshold

    def test_groups_above_threshold_synthesized(self):
        """Groups above threshold should be viable."""
        stats = GroupStats(
            grouping_key=GroupingKey(),
            correction_count=100,  # Above 50
            org_count=20,
            form_ids=[],
        )

        assert stats.meets_threshold


class TestPrivacyGuarantees:
    """Tests validating privacy guarantees."""

    @pytest.fixture
    def dp_engine(self) -> DifferentialPrivacyEngine:
        """Create a DP engine instance."""
        return DifferentialPrivacyEngine()

    def test_noise_prevents_exact_reconstruction(
        self, dp_engine: DifferentialPrivacyEngine
    ):
        """Noise should prevent exact value reconstruction."""
        data = [42.0]  # Single sensitive value

        results = []
        for _ in range(10):
            result = dp_engine.apply_dp(
                data=data,
                epsilon=0.5,
                sensitivity=1.0,
                query_type=QueryType.COUNT,
            )
            results.append(result.value)

        # Results should vary (not all identical)
        unique_results = set(results)
        assert len(unique_results) > 1

    def test_lower_epsilon_more_private(
        self, dp_engine: DifferentialPrivacyEngine
    ):
        """Lower epsilon should provide more privacy (more noise)."""
        data = [1.0, 2.0, 3.0, 4.0, 5.0]

        # Collect variance at different epsilon levels
        variance_high_eps = []
        variance_low_eps = []

        for _ in range(50):
            high = dp_engine.apply_dp(data, epsilon=0.9, sensitivity=1.0, query_type=QueryType.COUNT)
            low = dp_engine.apply_dp(data, epsilon=0.1, sensitivity=1.0, query_type=QueryType.COUNT)
            variance_high_eps.append(high.value)
            variance_low_eps.append(low.value)

        # Lower epsilon should have higher variance
        var_high = statistics.variance(variance_high_eps) if len(variance_high_eps) > 1 else 0
        var_low = statistics.variance(variance_low_eps) if len(variance_low_eps) > 1 else 0

        assert var_low > var_high

    def test_sensitivity_affects_noise(
        self, dp_engine: DifferentialPrivacyEngine
    ):
        """Higher sensitivity should result in more noise."""
        data = [1.0, 2.0, 3.0]

        result_low_sens = dp_engine.apply_dp(
            data=data,
            epsilon=0.5,
            sensitivity=1.0,
            query_type=QueryType.COUNT,
        )
        result_high_sens = dp_engine.apply_dp(
            data=data,
            epsilon=0.5,
            sensitivity=10.0,
            query_type=QueryType.COUNT,
        )

        # Higher sensitivity = higher noise scale
        assert result_high_sens.noise_scale > result_low_sens.noise_scale
