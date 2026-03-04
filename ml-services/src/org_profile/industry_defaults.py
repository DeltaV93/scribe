"""Industry defaults loader service.

Loads and provides access to industry-specific default configurations
from the industry_defaults.yaml file.
"""

import logging
from functools import lru_cache
from pathlib import Path
from typing import Any, Optional

import yaml
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# Path to the industry defaults config file
CONFIG_PATH = Path(__file__).parent.parent.parent / "config" / "industry_defaults.yaml"


class CustomSignalsConfig(BaseModel):
    """Custom signals configuration for an industry."""

    keywords: list[str] = Field(default_factory=list)
    patterns: list[str] = Field(default_factory=list)
    weights: dict[str, float] = Field(default_factory=dict)


class IndustryDefault(BaseModel):
    """Default configuration for an industry."""

    id: str
    name: str
    description: str
    suggested_compliance: list[str] = Field(default_factory=list)
    team_roles: list[str] = Field(default_factory=list)
    custom_signals: CustomSignalsConfig = Field(default_factory=CustomSignalsConfig)
    meeting_signals: list[str] = Field(default_factory=list)


class HybridMapping(BaseModel):
    """Mapping for hybrid organizations spanning multiple industries."""

    primary: str
    secondary: str
    description: str


class IndustryDefaultsConfig(BaseModel):
    """Root configuration containing all industry defaults."""

    industries: dict[str, IndustryDefault] = Field(default_factory=dict)
    hybrid_mappings: dict[str, HybridMapping] = Field(default_factory=dict)


@lru_cache(maxsize=1)
def load_industry_defaults() -> IndustryDefaultsConfig:
    """
    Load industry defaults from YAML config file.

    Returns cached result after first load.
    """
    try:
        with open(CONFIG_PATH, "r") as f:
            raw_config = yaml.safe_load(f)

        # Parse industries
        industries = {}
        for industry_id, industry_data in raw_config.get("industries", {}).items():
            # Ensure custom_signals is properly structured
            signals_data = industry_data.get("custom_signals", {})
            custom_signals = CustomSignalsConfig(
                keywords=signals_data.get("keywords", []),
                patterns=signals_data.get("patterns", []),
                weights=signals_data.get("weights", {}),
            )

            industries[industry_id] = IndustryDefault(
                id=industry_id,
                name=industry_data.get("name", industry_id),
                description=industry_data.get("description", ""),
                suggested_compliance=industry_data.get("suggested_compliance", []),
                team_roles=industry_data.get("team_roles", []),
                custom_signals=custom_signals,
                meeting_signals=industry_data.get("meeting_signals", []),
            )

        # Parse hybrid mappings
        hybrid_mappings = {}
        for mapping_id, mapping_data in raw_config.get("hybrid_mappings", {}).items():
            hybrid_mappings[mapping_id] = HybridMapping(
                primary=mapping_data.get("primary", ""),
                secondary=mapping_data.get("secondary", ""),
                description=mapping_data.get("description", ""),
            )

        logger.info(
            f"Loaded {len(industries)} industry defaults and {len(hybrid_mappings)} hybrid mappings"
        )

        return IndustryDefaultsConfig(
            industries=industries,
            hybrid_mappings=hybrid_mappings,
        )

    except FileNotFoundError:
        logger.warning(f"Industry defaults config not found at {CONFIG_PATH}")
        return IndustryDefaultsConfig()
    except Exception as e:
        logger.error(f"Error loading industry defaults: {e}", exc_info=True)
        return IndustryDefaultsConfig()


def get_industry(industry_id: str) -> Optional[IndustryDefault]:
    """
    Get default configuration for a specific industry.

    Args:
        industry_id: Industry identifier (e.g., "nonprofit", "healthcare")

    Returns:
        IndustryDefault if found, None otherwise
    """
    config = load_industry_defaults()
    return config.industries.get(industry_id)


def list_industries() -> list[IndustryDefault]:
    """
    List all available industry configurations.

    Returns:
        List of all industry defaults
    """
    config = load_industry_defaults()
    return list(config.industries.values())


def get_hybrid_mapping(mapping_id: str) -> Optional[HybridMapping]:
    """
    Get hybrid organization mapping by ID.

    Args:
        mapping_id: Hybrid mapping identifier (e.g., "fqhc", "legal_aid")

    Returns:
        HybridMapping if found, None otherwise
    """
    config = load_industry_defaults()
    return config.hybrid_mappings.get(mapping_id)


def merge_industry_signals(
    primary_industry: str,
    secondary_industry: Optional[str] = None,
    custom_overrides: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """
    Merge signals from primary and optional secondary industry.

    Primary industry signals take precedence. Custom overrides
    are applied on top.

    Args:
        primary_industry: Primary industry ID
        secondary_industry: Optional secondary industry ID
        custom_overrides: Optional custom signal overrides

    Returns:
        Merged custom signals dict
    """
    result: dict[str, Any] = {
        "keywords": [],
        "patterns": [],
        "weights": {},
    }

    # Start with secondary industry if present
    if secondary_industry:
        secondary = get_industry(secondary_industry)
        if secondary:
            result["keywords"].extend(secondary.custom_signals.keywords)
            result["patterns"].extend(secondary.custom_signals.patterns)
            result["weights"].update(secondary.custom_signals.weights)

    # Overlay primary industry (takes precedence)
    primary = get_industry(primary_industry)
    if primary:
        # Add primary keywords (avoiding duplicates)
        existing_keywords = set(result["keywords"])
        for kw in primary.custom_signals.keywords:
            if kw not in existing_keywords:
                result["keywords"].append(kw)

        # Add primary patterns (avoiding duplicates)
        existing_patterns = set(result["patterns"])
        for pattern in primary.custom_signals.patterns:
            if pattern not in existing_patterns:
                result["patterns"].append(pattern)

        # Primary weights override secondary
        result["weights"].update(primary.custom_signals.weights)

    # Apply custom overrides last
    if custom_overrides:
        if "keywords" in custom_overrides:
            existing_keywords = set(result["keywords"])
            for kw in custom_overrides["keywords"]:
                if kw not in existing_keywords:
                    result["keywords"].append(kw)

        if "patterns" in custom_overrides:
            existing_patterns = set(result["patterns"])
            for pattern in custom_overrides["patterns"]:
                if pattern not in existing_patterns:
                    result["patterns"].append(pattern)

        if "weights" in custom_overrides:
            result["weights"].update(custom_overrides["weights"])

    return result


def get_suggested_team_roles(
    primary_industry: str,
    secondary_industry: Optional[str] = None,
) -> list[str]:
    """
    Get suggested team roles for an industry combination.

    Args:
        primary_industry: Primary industry ID
        secondary_industry: Optional secondary industry ID

    Returns:
        List of suggested team role identifiers
    """
    roles = set()

    primary = get_industry(primary_industry)
    if primary:
        roles.update(primary.team_roles)

    if secondary_industry:
        secondary = get_industry(secondary_industry)
        if secondary:
            roles.update(secondary.team_roles)

    return sorted(list(roles))


def get_suggested_compliance(
    primary_industry: str,
    secondary_industry: Optional[str] = None,
) -> list[str]:
    """
    Get suggested compliance frameworks for an industry combination.

    Args:
        primary_industry: Primary industry ID
        secondary_industry: Optional secondary industry ID

    Returns:
        List of suggested compliance framework names
    """
    frameworks = set()

    primary = get_industry(primary_industry)
    if primary:
        frameworks.update(primary.suggested_compliance)

    if secondary_industry:
        secondary = get_industry(secondary_industry)
        if secondary:
            frameworks.update(secondary.suggested_compliance)

    return sorted(list(frameworks))
