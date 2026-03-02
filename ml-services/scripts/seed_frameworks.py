#!/usr/bin/env python3
"""Seed compliance frameworks from YAML config."""

import asyncio
import yaml
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.common.db.session import AsyncSessionLocal
from src.org_profile.models import ComplianceFramework


async def seed_frameworks():
    """Load compliance frameworks from config into database."""
    config_path = Path(__file__).parent.parent / "config" / "compliance_frameworks.yaml"

    with open(config_path) as f:
        config = yaml.safe_load(f)

    async with AsyncSessionLocal() as session:
        for key, framework_data in config["frameworks"].items():
            # Check if already exists
            result = await session.execute(
                select(ComplianceFramework).where(
                    ComplianceFramework.name == framework_data["name"]
                )
            )
            existing = result.scalar_one_or_none()

            if existing:
                print(f"Framework '{key}' already exists, skipping")
                continue

            framework = ComplianceFramework(
                name=framework_data["name"],
                default_retention=framework_data.get("default_retention", {}),
                required_audit_events=framework_data.get("required_audit_events", []),
                data_handling_rules=framework_data.get("data_handling_rules", {}),
            )
            session.add(framework)
            print(f"Created framework: {key}")

        await session.commit()
        print("Done!")


if __name__ == "__main__":
    asyncio.run(seed_frameworks())
