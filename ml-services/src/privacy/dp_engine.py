"""Differential Privacy Engine using OpenDP library.

Implements the core DP mechanisms for Inkra's privacy-preserving ML pipeline.
Uses OpenDP's Rust-backed implementations for academic rigor and performance.

References:
- OpenDP documentation: https://docs.opendp.org/
- Spec: docs/specs/PX-887-897-898-ml-foundation-spec.md
"""

from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, List, Optional, Sequence, Tuple, Union

import structlog

# OpenDP imports - gracefully handle if not installed
try:
    import opendp.prelude as dp

    OPENDP_AVAILABLE = True
    # Enable OpenDP features
    dp.enable_features("contrib", "floating-point")
except ImportError:
    OPENDP_AVAILABLE = False
    dp = None  # type: ignore

logger = structlog.get_logger()


class QueryType(str, Enum):
    """Supported differential privacy query types."""

    COUNT = "count"
    SUM = "sum"
    MEAN = "mean"
    HISTOGRAM = "histogram"


@dataclass
class DPQueryResult:
    """Result of a DP query with privacy metadata."""

    value: Any
    epsilon_consumed: float
    noise_scale: float
    query_type: QueryType
    sensitivity: float


@dataclass
class DPConfig:
    """Configuration for DP queries."""

    default_epsilon: float = 0.1
    default_delta: float = 1e-6
    max_epsilon_per_query: float = 1.0
    min_epsilon: float = 0.001


class DifferentialPrivacyEngine:
    """Engine for applying differential privacy to data queries.

    Implements DP mechanisms using OpenDP library with support for:
    - Count queries with Laplace mechanism
    - Sum queries with bounded sensitivity
    - Mean queries with bounded data
    - Histogram queries with DP noise per bin

    Example:
        engine = DifferentialPrivacyEngine()
        result = engine.apply_dp(
            data=[1, 2, 3, 4, 5],
            epsilon=0.1,
            sensitivity=1.0,
            query_type=QueryType.COUNT
        )
    """

    def __init__(self, config: Optional[DPConfig] = None) -> None:
        """Initialize the DP engine.

        Args:
            config: Optional DP configuration settings.

        Raises:
            ImportError: If OpenDP library is not installed.
        """
        if not OPENDP_AVAILABLE:
            raise ImportError(
                "OpenDP library not installed. "
                "Install with: pip install 'ml-services[privacy]'"
            )

        self.config = config or DPConfig()
        self._logger = logger.bind(component="dp_engine")

    def apply_dp(
        self,
        data: Union[List[float], List[int]],
        epsilon: float,
        sensitivity: float,
        query_type: QueryType = QueryType.COUNT,
        bounds: Optional[Tuple[float, float]] = None,
    ) -> DPQueryResult:
        """Apply differential privacy to data using specified query type.

        Args:
            data: Input data to query with DP.
            epsilon: Privacy budget to use for this query.
            sensitivity: Query sensitivity (depends on query type).
            query_type: Type of aggregation query to perform.
            bounds: Optional bounds (lower, upper) for bounded queries.

        Returns:
            DPQueryResult with noisy result and privacy metadata.

        Raises:
            ValueError: If epsilon or sensitivity is invalid.
        """
        self._validate_epsilon(epsilon)
        self._validate_sensitivity(sensitivity)

        self._logger.info(
            "applying_dp",
            query_type=query_type.value,
            epsilon=epsilon,
            sensitivity=sensitivity,
            data_size=len(data),
        )

        if query_type == QueryType.COUNT:
            return self._apply_count_dp(data, epsilon, sensitivity)
        elif query_type == QueryType.SUM:
            return self._apply_sum_dp(data, epsilon, sensitivity, bounds)
        elif query_type == QueryType.MEAN:
            return self._apply_mean_dp(data, epsilon, sensitivity, bounds)
        elif query_type == QueryType.HISTOGRAM:
            return self._apply_histogram_dp(data, epsilon, sensitivity, bounds)
        else:
            raise ValueError(f"Unsupported query type: {query_type}")

    def compute_required_epsilon(
        self,
        query_type: QueryType,
        sensitivity: float,
        target_noise: float = 1.0,
    ) -> float:
        """Compute required epsilon for a given noise level.

        The Laplace mechanism adds noise scaled to sensitivity/epsilon.
        For a target noise level, we need epsilon = sensitivity / target_noise.

        Args:
            query_type: Type of query to perform.
            sensitivity: Query sensitivity.
            target_noise: Desired noise scale (default 1.0 for standard noise).

        Returns:
            Required epsilon value to achieve target noise level.
        """
        if target_noise <= 0:
            raise ValueError("Target noise must be positive")

        # For Laplace mechanism: scale = sensitivity / epsilon
        # So epsilon = sensitivity / scale = sensitivity / target_noise
        epsilon = sensitivity / target_noise

        # Clamp to valid range
        epsilon = max(self.config.min_epsilon, min(epsilon, self.config.max_epsilon_per_query))

        self._logger.debug(
            "computed_epsilon",
            query_type=query_type.value,
            sensitivity=sensitivity,
            target_noise=target_noise,
            computed_epsilon=epsilon,
        )

        return epsilon

    def _apply_count_dp(
        self,
        data: Sequence[Union[float, int]],
        epsilon: float,
        sensitivity: float,
    ) -> DPQueryResult:
        """Apply DP to count query using Laplace mechanism."""
        # Sensitivity for counting query is typically 1 (adding/removing one record)
        true_count = len(data)
        noise_scale = sensitivity / epsilon

        # Create Laplace mechanism for count
        laplace_meas = dp.m.make_laplace(
            dp.atom_domain(T=float),
            dp.absolute_distance(T=float),
            scale=noise_scale,
        )

        # Apply noise
        noisy_count = laplace_meas(float(true_count))

        # Ensure non-negative count
        noisy_count = max(0, noisy_count)

        return DPQueryResult(
            value=noisy_count,
            epsilon_consumed=epsilon,
            noise_scale=noise_scale,
            query_type=QueryType.COUNT,
            sensitivity=sensitivity,
        )

    def _apply_sum_dp(
        self,
        data: Sequence[Union[float, int]],
        epsilon: float,
        sensitivity: float,
        bounds: Optional[Tuple[float, float]] = None,
    ) -> DPQueryResult:
        """Apply DP to sum query using Laplace mechanism with bounded sensitivity."""
        if not data:
            return DPQueryResult(
                value=0.0,
                epsilon_consumed=epsilon,
                noise_scale=0.0,
                query_type=QueryType.SUM,
                sensitivity=sensitivity,
            )

        # Compute true sum with optional clamping
        if bounds:
            lower, upper = bounds
            clamped_data = [max(lower, min(upper, x)) for x in data]
            true_sum = sum(clamped_data)
            # Sensitivity is bounded by the range
            effective_sensitivity = min(sensitivity, upper - lower)
        else:
            true_sum = sum(data)
            effective_sensitivity = sensitivity

        noise_scale = effective_sensitivity / epsilon

        # Create Laplace mechanism
        laplace_meas = dp.m.make_laplace(
            dp.atom_domain(T=float),
            dp.absolute_distance(T=float),
            scale=noise_scale,
        )

        noisy_sum = laplace_meas(float(true_sum))

        return DPQueryResult(
            value=noisy_sum,
            epsilon_consumed=epsilon,
            noise_scale=noise_scale,
            query_type=QueryType.SUM,
            sensitivity=effective_sensitivity,
        )

    def _apply_mean_dp(
        self,
        data: Sequence[Union[float, int]],
        epsilon: float,
        sensitivity: float,
        bounds: Optional[Tuple[float, float]] = None,
    ) -> DPQueryResult:
        """Apply DP to mean query.

        For mean = sum / count, we use the composition of DP sum and count.
        We split epsilon between the two queries.
        """
        if not data:
            return DPQueryResult(
                value=0.0,
                epsilon_consumed=epsilon,
                noise_scale=0.0,
                query_type=QueryType.MEAN,
                sensitivity=sensitivity,
            )

        n = len(data)

        # For mean, we can compute as noisy_sum / n (using public count)
        # or split epsilon between sum and count
        # Using public count is more accurate if count is not sensitive
        if bounds:
            lower, upper = bounds
            clamped_data = [max(lower, min(upper, x)) for x in data]
            true_sum = sum(clamped_data)
            effective_sensitivity = (upper - lower) / n
        else:
            true_sum = sum(data)
            effective_sensitivity = sensitivity / n

        noise_scale = effective_sensitivity / epsilon

        # Create Laplace mechanism for mean
        laplace_meas = dp.m.make_laplace(
            dp.atom_domain(T=float),
            dp.absolute_distance(T=float),
            scale=noise_scale,
        )

        true_mean = float(true_sum) / n
        noisy_mean = laplace_meas(true_mean)

        return DPQueryResult(
            value=noisy_mean,
            epsilon_consumed=epsilon,
            noise_scale=noise_scale,
            query_type=QueryType.MEAN,
            sensitivity=effective_sensitivity,
        )

    def _apply_histogram_dp(
        self,
        data: Sequence[Union[float, int]],
        epsilon: float,
        sensitivity: float,
        bounds: Optional[Tuple[float, float]] = None,
        num_bins: int = 10,
    ) -> DPQueryResult:
        """Apply DP to histogram query.

        Creates a histogram with DP noise added to each bin count.
        Uses parallel composition - epsilon is divided among bins.
        """
        if not data:
            return DPQueryResult(
                value={},
                epsilon_consumed=epsilon,
                noise_scale=0.0,
                query_type=QueryType.HISTOGRAM,
                sensitivity=sensitivity,
            )

        # Determine bounds
        if bounds:
            lower, upper = bounds
        else:
            lower, upper = min(data), max(data)  # type: ignore
            if lower == upper:
                upper = lower + 1

        # Create bin edges
        bin_width = (upper - lower) / num_bins
        bins: Dict[int, int] = {i: 0 for i in range(num_bins)}

        # Count data points in each bin
        for val in data:
            if val < lower or val > upper:  # type: ignore
                continue
            bin_idx = min(int((val - lower) / bin_width), num_bins - 1)  # type: ignore
            bins[bin_idx] += 1

        # Apply Laplace noise to each bin count
        # Sensitivity for each bin count is 1 (adding/removing one record affects one bin)
        noise_scale = sensitivity / epsilon

        laplace_meas = dp.m.make_laplace(
            dp.atom_domain(T=float),
            dp.absolute_distance(T=float),
            scale=noise_scale,
        )

        noisy_bins: Dict[int, float] = {}
        for bin_idx, count in bins.items():
            noisy_count = laplace_meas(float(count))
            noisy_bins[bin_idx] = max(0, noisy_count)  # Non-negative counts

        result = {
            "bins": noisy_bins,
            "bin_edges": [lower + i * bin_width for i in range(num_bins + 1)],
            "bin_width": bin_width,
        }

        return DPQueryResult(
            value=result,
            epsilon_consumed=epsilon,
            noise_scale=noise_scale,
            query_type=QueryType.HISTOGRAM,
            sensitivity=sensitivity,
        )

    def _validate_epsilon(self, epsilon: float) -> None:
        """Validate epsilon value."""
        if epsilon <= 0:
            raise ValueError(f"Epsilon must be positive, got {epsilon}")
        if epsilon > self.config.max_epsilon_per_query:
            raise ValueError(
                f"Epsilon {epsilon} exceeds maximum {self.config.max_epsilon_per_query}"
            )

    def _validate_sensitivity(self, sensitivity: float) -> None:
        """Validate sensitivity value."""
        if sensitivity <= 0:
            raise ValueError(f"Sensitivity must be positive, got {sensitivity}")


def check_opendp_available() -> bool:
    """Check if OpenDP is available."""
    return OPENDP_AVAILABLE
