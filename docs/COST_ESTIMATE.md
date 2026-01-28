# Scrybe Monthly Cost Estimate at 100 Users

## Usage Assumptions

- **Organizations**: 10-20 orgs (avg ~6 users each)
- **Case Managers**: ~30 users making calls
- **Call Volume**: 3-5 calls/day per case manager = ~80 calls/CM/month
- **Call Duration**: 5-10 minutes average (use 7.5 min)
- **Total Calls**: 30 case managers × 80 calls = **2,400 calls/month**
- **Total Call Minutes**: 2,400 × 7.5 = **18,000 minutes/month**

---

## Cost Breakdown

### 1. Infrastructure (Fixed Costs)

| Service | Monthly Cost | Notes |
|---------|-------------|-------|
| **Railway (PostgreSQL)** | $20-30 | Database hosting |
| **Supabase Auth** | $25 | Pro plan for production |
| **AWS KMS** | $1 | Encryption key |
| **Hosting (Vercel/Railway)** | $20-50 | App hosting |
| **Subtotal** | **$66-106** | |

---

### 2. Twilio (Phone & Calling)

| Item | Calculation | Monthly Cost |
|------|-------------|--------------|
| **Phone Numbers** | 30 numbers × $1.15 | $34.50 |
| **Outbound Call Minutes** | 18,000 min × $0.013 | $234 |
| **Recording Storage** | Included | $0 |
| **Subtotal** | | **~$269** |

*Note: You charge users $5/number = $150 revenue, covering Twilio + margin*

---

### 3. Deepgram (Transcription)

| Item | Calculation | Monthly Cost |
|------|-------------|--------------|
| **Transcription** | 18,000 min × $0.0043 | $77.40 |
| **Diarization (+50%)** | 18,000 min × $0.0021 | $37.80 |
| **Subtotal** | | **~$115** |

---

### 4. Anthropic Claude (AI Extraction)

| Item | Calculation | Monthly Cost |
|------|-------------|--------------|
| **Extractions** | 2,400 calls × ~3,500 input tokens | 8.4M input tokens |
| **Responses** | 2,400 calls × ~600 output tokens | 1.4M output tokens |
| **Input Cost** | 8.4M × $3/1M | $25.20 |
| **Output Cost** | 1.4M × $15/1M | $21.00 |
| **Subtotal** | | **~$46** |

---

### 5. AWS S3 (Storage)

| Item | Calculation | Monthly Cost |
|------|-------------|--------------|
| **Recording Storage** | 2,400 calls × 1MB × 30 days retention | ~72 GB-days |
| **Average Storage** | ~2.4 GB | $0.06 |
| **PUT/GET Requests** | Minimal | $0.05 |
| **Subtotal** | | **~$0.11** |

*Negligible - call recordings are small at 5-10 min duration*

---

### 6. Stripe (Payment Processing)

| Item | Calculation | Monthly Cost |
|------|-------------|--------------|
| **Subscription Revenue** | See revenue section | ~$1,500-3,000 |
| **Stripe Fee (2.9% + $0.30)** | $1,500 × 3.2% | ~$48-96 |
| **Subtotal** | | **~$70** (avg) |

---

## Total Monthly Costs

| Category | Low | High |
|----------|-----|------|
| Infrastructure | $66 | $106 |
| Twilio | $250 | $290 |
| Deepgram | $100 | $130 |
| Anthropic | $40 | $55 |
| AWS S3 | $0 | $1 |
| Stripe Fees | $50 | $100 |
| **TOTAL** | **$506** | **$682** |

### Per-User Cost: $5.06 - $6.82/user/month

---

## Revenue Estimate

Assuming 10-20 orgs with mix of plans:

| Plan | Orgs | Monthly Revenue |
|------|------|-----------------|
| **Starter ($29)** | 8 | $232 |
| **Professional ($99)** | 8 | $792 |
| **Enterprise ($299)** | 2 | $598 |
| **Phone Numbers ($5)** | 30 | $150 |
| **Subtotal** | | **$1,772** |

---

## Profit Margin Analysis

```
┌─────────────────────────────────────────────────────────────┐
│              MONTHLY P&L AT 100 USERS                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Revenue:                                                   │
│    Subscriptions:           $1,622                          │
│    Phone Numbers:           $150                            │
│    ─────────────────────────────                            │
│    Total Revenue:           $1,772                          │
│                                                             │
│  Costs:                                                     │
│    Infrastructure:          $86                             │
│    Twilio:                  $269                            │
│    Deepgram:                $115                            │
│    Anthropic:               $46                             │
│    Stripe Fees:             $57                             │
│    ─────────────────────────────                            │
│    Total Costs:             $573                            │
│                                                             │
│  ════════════════════════════════════════                   │
│  GROSS PROFIT:              $1,199/month                    │
│  GROSS MARGIN:              67.6%                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Insights

### Cost Drivers (Highest to Lowest)
1. **Twilio** (~47% of costs) - Calling minutes are the biggest expense
2. **Deepgram** (~20% of costs) - Transcription scales with call volume
3. **Infrastructure** (~15% of costs) - Fixed regardless of usage
4. **Stripe Fees** (~10% of costs) - Scales with revenue
5. **Anthropic** (~8% of costs) - AI extraction is surprisingly cheap

### Phone Number Margin
- Twilio cost: $1.15/number/month
- You charge: $5.00/number/month
- **Margin: 77% ($3.85/number)**

### Cost Per Call
- Twilio minutes: $0.10 (7.5 min × $0.013)
- Deepgram: $0.048 (7.5 min × $0.0064)
- Anthropic: $0.019
- **Total per call: ~$0.17**

---

## Scaling Projections

| Users | Calls/mo | Monthly Cost | Revenue | Profit |
|-------|----------|--------------|---------|--------|
| 100 | 2,400 | $573 | $1,772 | $1,199 |
| 250 | 6,000 | $1,180 | $4,430 | $3,250 |
| 500 | 12,000 | $2,200 | $8,860 | $6,660 |
| 1,000 | 24,000 | $4,150 | $17,720 | $13,570 |

*Note: Infrastructure costs stay relatively flat; variable costs (Twilio, Deepgram, Anthropic) scale linearly*

---

## Cost Optimization Opportunities

1. **Twilio Volume Discount** - Negotiate rates at higher volumes
2. **Deepgram Annual Contract** - Can get 20-30% discount
3. **Anthropic Batch API** - 50% cheaper for non-real-time extraction
4. **Recording Retention** - Reduce from 30 to 7-14 days
5. **Phone Pooling** - Share numbers across case managers if feasible

---

## Break-Even Analysis

| Scenario | Break-Even Users |
|----------|------------------|
| Current pricing | ~32 users |
| All Starter plans | ~50 users |
| All Professional | ~18 users |

*With 100 users, you're well above break-even with healthy margins.*
