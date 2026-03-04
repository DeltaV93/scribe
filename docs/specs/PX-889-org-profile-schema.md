# PX-889: Org Profile Schema & Admin Configuration

## Status: Implemented

**Implementation Date:** 2026-03-04
**Related Tickets:** PX-887 (Form Matching), PX-896 (Research), PX-897 (Differential Privacy), PX-898 (Audit Oracle)

---

## Overview

This ticket completes the Org Profile foundational service that powers context-aware decisions across form matching (PX-887), audit routing (PX-898), differential privacy (PX-897), and model training (PX-895). It adds missing schema fields, industry default libraries, admin configuration UI, and cache invalidation events.

---

## What Was Implemented

### Phase 1: Schema Extensions (FastAPI)

**New file:** `ml-services/src/org_profile/enums.py`
- `Industry` enum: nonprofit, healthcare, tech, legal, sales, education, government, finance, other
- `CompanyType` enum: startup, enterprise, nonprofit, government, agency, consulting
- `ModelTier` enum: shared, private

**Modified:** `ml-services/src/org_profile/models.py`

New columns added to `OrgProfile`:

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `industry` | String(50) | null | Primary industry classification |
| `secondary_industry` | String(50) | null | Secondary industry for hybrid orgs |
| `company_type` | String(50) | null | Organization type |
| `team_roles` | JSON | [] | Team roles configured for org |
| `model_tier` | String(20) | "shared" | Model training tier |
| `data_sharing_consent` | Boolean | false | Explicit consent for global training |
| `custom_signals` | JSON | {} | Detection signals config |
| `matching_rules` | JSON | {} | Form matching rule config |
| `risk_overrides` | JSON | {} | Per-model risk tier overrides |

**Migration:** `ml-services/alembic/versions/20260304_add_org_profile_fields.py`
- All columns have server defaults for backwards compatibility
- Indexes on `industry` and `model_tier` columns

---

### Phase 2: Industry Default Libraries

**New file:** `ml-services/config/industry_defaults.yaml`

Six industries with complete configurations:

| Industry | Keywords | Spanish Support | Compliance Suggestions |
|----------|----------|-----------------|----------------------|
| nonprofit | client, participant, intake, caso, referido... | Yes | HIPAA, WIOA, 42CFR |
| healthcare | patient, diagnosis, paciente, cita... | Yes | HIPAA |
| tech | user, customer, feedback, feature... | No | SOC2, GDPR |
| legal | client, matter, case, hearing... | No | SOC2 |
| sales | prospect, deal, pipeline... | No | SOC2, GDPR |
| education | student, enrollment, course... | No | FERPA |

Each industry includes:
- Keywords (English + Spanish where applicable)
- Regex patterns for structured data (case#, MRN, ticket#)
- Weight multipliers for important terms
- Team role suggestions
- Meeting signal types

**New file:** `ml-services/src/org_profile/industry_defaults.py`

Loader service with functions:
- `load_industry_defaults()` - Cached YAML loader
- `get_industry(id)` - Get specific industry config
- `list_industries()` - List all industries
- `merge_industry_signals()` - Merge primary + secondary industry signals
- `get_suggested_team_roles()` - Get roles for industry combo
- `get_suggested_compliance()` - Get compliance suggestions

---

### Phase 3: Cache Invalidation Events

**New file:** `ml-services/src/org_profile/cache_events.py`

Redis pub/sub implementation for downstream cache invalidation:

**Channels:**
- `org_profile:invalidate` - General profile changes
- `compliance:invalidate` - Compliance-specific changes

**Event Types:**
- `profile.updated` - General update
- `compliance.changed` - Compliance frameworks changed
- `model_tier.changed` - Model tier or consent changed
- `signals.updated` - Custom signals changed
- `matching_rules.updated` - Matching rules changed
- `industry.changed` - Industry selection changed

**Usage:**
```python
from src.org_profile.cache_events import emit_profile_updated

await emit_profile_updated(
    org_id=org_id,
    changed_fields=["industry", "custom_signals"],
    old_values={"industry": None},
    new_values={"industry": "nonprofit"},
)
```

---

### Phase 4: Router Updates

**Modified:** `ml-services/src/org_profile/router.py`

New endpoints:
- `GET /v1/industries` - List all industry configurations
- `GET /v1/industries/{industry_id}` - Get specific industry config

Updates:
- POST/PUT handlers now set all new fields
- PUT handler emits cache invalidation events with changed field list
- All GET endpoints return `Cache-Control` and `ETag` headers

---

### Phase 5: Next.js Integration

**Modified:** `src/lib/ml-services/types.ts`

New types:
```typescript
type Industry = "nonprofit" | "healthcare" | "tech" | "legal" | "sales" | "education" | "government" | "finance" | "other";
type CompanyType = "startup" | "enterprise" | "nonprofit" | "government" | "agency" | "consulting";
type ModelTier = "shared" | "private";

interface CustomSignals {
  keywords: string[];
  patterns: string[];
  weights: Record<string, number>;
}

interface MatchingRules {
  overrides: Record<string, unknown>[];
  weights: Record<string, number>;
  disabled_rules: string[];
}

interface IndustryDefault {
  id: Industry;
  name: string;
  description: string;
  suggested_compliance: string[];
  team_roles: string[];
  custom_signals: CustomSignals;
  meeting_signals: string[];
}
```

**Modified:** `src/lib/ml-services/client.ts`

New methods:
- `mlServices.industries.list()` - List industries
- `mlServices.industries.get(id)` - Get industry by ID

**New file:** `src/app/api/ml/industries/route.ts`
- Proxies to ml-services with caching headers

**Modified:** `src/app/api/ml/org/profile/route.ts`
- Updated Zod validation schema with all new fields

---

### Phase 6: Admin UI

**New file:** `src/components/admin/ml-settings-tab.tsx`

Main settings tab with sections:
1. **Industry Selection** - Primary + secondary dropdown with "Preview Defaults" button
2. **Company Type** - Dropdown selection
3. **Model Tier** - Radio cards (Shared vs Private) with confirmation modal
4. **Compliance Requirements** - Multi-select checkboxes (HIPAA, SOC2, GDPR, FERPA, WIOA, 42CFR)
5. **Custom Signals** - Accordion with keywords, patterns, weights editors
6. **Matching Rules** - Enable/disable rules, weight adjustments
7. **Privacy Budget** - Read-only display of epsilon consumed/remaining

**New file:** `src/components/admin/custom-signals-editor.tsx`

Accordion-based editor for:
- Keywords (tag input with add/remove)
- Regex patterns (with validation)
- Keyword weights (numeric input)

**New file:** `src/components/admin/matching-rules-editor.tsx`

Editor for:
- Enable/disable individual matching rules via switches
- Weight adjustments for rules

**New file:** `src/components/admin/model-tier-modal.tsx`

Confirmation modal when switching between shared/private tiers. Explains:
- Data handling implications
- Consent revocation (when going to private)
- Performance trade-offs

**Modified:** `src/app/(dashboard)/admin/page.tsx`
- Added "ML Settings" tab with Brain icon

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Industry defaults | Suggest only, apply via button | Hybrid/minority orgs need customization |
| Model tier switching | Confirmation modal | Explicit consent for data handling changes |
| Custom signals format | Keywords + regex patterns | Matches PX-896 patterns, powerful for structured IDs |
| Industry selection | Primary + secondary | Supports hybrid orgs (FQHC, Legal Aid NP) |
| Spanish keywords | Included in defaults | 71.4% of LEP population per PX-896 research |
| Cache invalidation | Redis pub/sub | Fast, reliable for PX-898 oracle layer |

---

## PX-896 Research Alignment

| Research Finding | Implementation | Status |
|-----------------|----------------|--------|
| 47 Meeting Types (nonprofit/tech/healthcare) | Industry defaults YAML includes meeting signals | Done |
| 21 Mapped Roles | `team_roles` field from industry defaults | Done |
| Three-Layer Signal Detection | `custom_signals` with keywords + patterns + weights | Done |
| Regex patterns (case#, MRN) | `patterns` array in custom_signals | Done |
| Hybrid Orgs (FQHC, Legal Aid NP) | Primary + secondary industry | Done |
| Modular Compliance Packs | `compliance_frameworks` array | Done |
| Accuracy Threshold Tiers | `risk_overrides` per model | Done |
| Code-switching (formal/informal) | Deferred to PX-887 NLP pipeline | Deferred |
| Multilingual (Spanish) | Spanish keywords in nonprofit/healthcare defaults | Done |

---

## File Manifest

### New Files

| Path | Description |
|------|-------------|
| `ml-services/src/org_profile/enums.py` | Industry, CompanyType, ModelTier enums |
| `ml-services/src/org_profile/industry_defaults.py` | Industry config loader service |
| `ml-services/src/org_profile/cache_events.py` | Redis pub/sub cache invalidation |
| `ml-services/config/industry_defaults.yaml` | Industry default signal libraries |
| `ml-services/alembic/versions/20260304_add_org_profile_fields.py` | Database migration |
| `src/app/api/ml/industries/route.ts` | Industries API route |
| `src/components/admin/ml-settings-tab.tsx` | Main ML Settings admin tab |
| `src/components/admin/custom-signals-editor.tsx` | Signals editor component |
| `src/components/admin/matching-rules-editor.tsx` | Rules editor component |
| `src/components/admin/model-tier-modal.tsx` | Tier change confirmation modal |

### Modified Files

| Path | Changes |
|------|---------|
| `ml-services/src/org_profile/models.py` | Added 9 new columns |
| `ml-services/src/org_profile/schemas.py` | Updated Pydantic schemas |
| `ml-services/src/org_profile/router.py` | Added endpoints, cache events, ETag |
| `src/lib/ml-services/types.ts` | Added new TypeScript types |
| `src/lib/ml-services/client.ts` | Added industries client methods |
| `src/app/api/ml/org/profile/route.ts` | Updated Zod validation |
| `src/app/(dashboard)/admin/page.tsx` | Added ML Settings tab |
| `src/test-utils/ml-mocks.ts` | Updated mock with new fields |

---

## Verification Checklist

- [ ] Run `alembic upgrade head` - verify columns exist
- [ ] `curl /v1/industries` returns 6 industries
- [ ] Create/update profile with new fields
- [ ] Subscribe to Redis channels, verify events on update
- [ ] Navigate to Admin > ML Settings, configure all options
- [ ] Profile endpoint responds in <100ms
- [ ] Existing profiles load without errors

---

## Dependencies

**Upstream (required before this):**
- PX-896 Research (completed)

**Downstream (uses this):**
- PX-887 Form Matching NLP
- PX-897 Differential Privacy
- PX-898 Audit Oracle Layer
- PX-895 Model Training
