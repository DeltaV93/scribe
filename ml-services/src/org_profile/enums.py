"""Org Profile enums for industry, company type, and model tier."""

from enum import Enum


class Industry(str, Enum):
    """Primary industry classifications for organizations."""

    NONPROFIT = "nonprofit"
    HEALTHCARE = "healthcare"
    TECH = "tech"
    LEGAL = "legal"
    SALES = "sales"
    EDUCATION = "education"
    GOVERNMENT = "government"
    FINANCE = "finance"
    OTHER = "other"


class CompanyType(str, Enum):
    """Organization type classifications."""

    STARTUP = "startup"
    ENTERPRISE = "enterprise"
    NONPROFIT = "nonprofit"
    GOVERNMENT = "government"
    AGENCY = "agency"
    CONSULTING = "consulting"


class ModelTier(str, Enum):
    """Model training tier - determines data sharing and model access."""

    SHARED = "shared"  # Org data contributes to global model training
    PRIVATE = "private"  # Org data only used for org-specific models
