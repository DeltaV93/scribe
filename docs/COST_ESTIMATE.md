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
| **Railway (Redis)** | $10-20 | BullMQ job queue + Socket.io adapter |
| **Supabase Auth** | $25 | Pro plan for production |
| **AWS KMS** | $1 | Encryption key |
| **Hosting (Railway)** | $20-50 | App hosting |
| **Sentry** | $26-50 | Error tracking, performance monitoring, session replay |
| **Fathom Analytics** | $14-25 | Privacy-friendly usage analytics |
| **Subtotal** | **$116-201** | |

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

Uses **Nova-2** model with diarization enabled. The app supports both batch (post-call) and live streaming (during calls) transcription.

| Item | Calculation | Monthly Cost |
|------|-------------|--------------|
| **Batch Transcription (post-call)** | 18,000 min × $0.0043 | $77.40 |
| **Live Streaming (during calls)** | 18,000 min × $0.0077 | $138.60 |
| **Subtotal (batch only)** | | **~$77** |
| **Subtotal (batch + live)** | | **~$216** |

*Note: If live transcription is enabled during calls, Deepgram costs nearly triple. Batch-only mode uses prerecorded transcription after call ends. Diarization (speaker identification) is included with Nova-2 prerecorded at no extra charge.*

---

### 4. Anthropic Claude (AI Operations)

Uses **Claude Sonnet 4** (`claude-sonnet-4-20250514`) at $3/1M input tokens, $15/1M output tokens.

#### Call Extraction (primary cost driver)

| Item | Calculation | Monthly Cost |
|------|-------------|--------------|
| **Input Tokens** | 2,400 calls × ~3,500 tokens | 8.4M tokens × $3/1M = $25.20 |
| **Output Tokens** | 2,400 calls × ~600 tokens | 1.4M tokens × $15/1M = $21.00 |
| **Subtotal** | | **~$46** |

#### Additional AI Operations (estimated)

| Operation | Est. Monthly Calls | Max Tokens | Est. Monthly Cost |
|-----------|-------------------|------------|-------------------|
| **Form Generation** | ~50 | 6,000 output | ~$5 |
| **Call Action Items** | ~2,400 | 2,000 output | ~$8 |
| **Meeting Summaries** | ~200 | 2,048 output | ~$3 |
| **Syllabus Extraction** | ~20 | 4,096 output | ~$1 |
| **Goal Parsing** | ~100 | 4,096 output | ~$2 |
| **Subtotal** | | | **~$19** |

#### Total Anthropic

| Scenario | Monthly Cost |
|----------|-------------|
| **Call extraction only** | ~$46 |
| **All AI operations** | **~$65** |

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

### Scenario A: Batch Transcription Only

| Category | Low | High |
|----------|-----|------|
| Infrastructure (incl. Redis, Sentry, Fathom) | $116 | $201 |
| Twilio | $250 | $290 |
| Deepgram (batch only) | $70 | $85 |
| Anthropic (all AI operations) | $55 | $75 |
| AWS S3 | $0 | $1 |
| Stripe Fees | $50 | $100 |
| **TOTAL** | **$541** | **$752** |

**Per-User Cost: $5.41 - $7.52/user/month**

### Scenario B: Batch + Live Streaming Transcription

| Category | Low | High |
|----------|-----|------|
| Infrastructure (incl. Redis, Sentry, Fathom) | $116 | $201 |
| Twilio | $250 | $290 |
| Deepgram (batch + live) | $200 | $230 |
| Anthropic (all AI operations) | $55 | $75 |
| AWS S3 | $0 | $1 |
| Stripe Fees | $50 | $100 |
| **TOTAL** | **$671** | **$897** |

**Per-User Cost: $6.71 - $8.97/user/month**

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

### Scenario A: Batch Transcription Only

```
┌─────────────────────────────────────────────────────────────┐
│              MONTHLY P&L AT 100 USERS (BATCH ONLY)          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Revenue:                                                   │
│    Subscriptions:           $1,622                          │
│    Phone Numbers:           $150                            │
│    ─────────────────────────────                            │
│    Total Revenue:           $1,772                          │
│                                                             │
│  Costs:                                                     │
│    Infrastructure:          $159                            │
│    Twilio:                  $269                            │
│    Deepgram:                $77                             │
│    Anthropic:               $65                             │
│    Stripe Fees:             $57                             │
│    ─────────────────────────────                            │
│    Total Costs:             $627                            │
│                                                             │
│  ════════════════════════════════════════                   │
│  GROSS PROFIT:              $1,145/month                    │
│  GROSS MARGIN:              64.6%                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Scenario B: Batch + Live Streaming Transcription

```
┌─────────────────────────────────────────────────────────────┐
│              MONTHLY P&L AT 100 USERS (BATCH + LIVE)        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Revenue:                                                   │
│    Subscriptions:           $1,622                          │
│    Phone Numbers:           $150                            │
│    ─────────────────────────────                            │
│    Total Revenue:           $1,772                          │
│                                                             │
│  Costs:                                                     │
│    Infrastructure:          $159                            │
│    Twilio:                  $269                            │
│    Deepgram:                $216                            │
│    Anthropic:               $65                             │
│    Stripe Fees:             $57                             │
│    ─────────────────────────────                            │
│    Total Costs:             $766                            │
│                                                             │
│  ════════════════════════════════════════                   │
│  GROSS PROFIT:              $1,006/month                    │
│  GROSS MARGIN:              56.8%                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Insights

### Cost Drivers (Highest to Lowest) — Scenario B

1. **Twilio** (~35% of costs) - Calling minutes are the biggest expense
2. **Deepgram** (~28% of costs) - Live + batch transcription scales with call volume
3. **Infrastructure** (~21% of costs) - Fixed costs including Redis, Sentry, Fathom
4. **Anthropic** (~8% of costs) - AI extraction and other operations
5. **Stripe Fees** (~7% of costs) - Scales with revenue

### Phone Number Margin
- Twilio cost: $1.15/number/month
- You charge: $5.00/number/month
- **Margin: 77% ($3.85/number)**

### Cost Per Call

| Service | Per Call (batch only) | Per Call (batch + live) |
|---------|----------------------|------------------------|
| Twilio minutes | $0.10 | $0.10 |
| Deepgram | $0.032 | $0.090 |
| Anthropic (extraction + action items) | $0.027 | $0.027 |
| **Total** | **~$0.16** | **~$0.22** |

---

## Scaling Projections

### Scenario A: Batch Only

| Users | Calls/mo | Monthly Cost | Revenue | Profit | Margin |
|-------|----------|--------------|---------|--------|--------|
| 100 | 2,400 | $627 | $1,772 | $1,145 | 64.6% |
| 250 | 6,000 | $1,280 | $4,430 | $3,150 | 71.1% |
| 500 | 12,000 | $2,400 | $8,860 | $6,460 | 72.9% |
| 1,000 | 24,000 | $4,600 | $17,720 | $13,120 | 74.0% |

### Scenario B: Batch + Live

| Users | Calls/mo | Monthly Cost | Revenue | Profit | Margin |
|-------|----------|--------------|---------|--------|--------|
| 100 | 2,400 | $766 | $1,772 | $1,006 | 56.8% |
| 250 | 6,000 | $1,620 | $4,430 | $2,810 | 63.4% |
| 500 | 12,000 | $3,080 | $8,860 | $5,780 | 65.2% |
| 1,000 | 24,000 | $5,960 | $17,720 | $11,760 | 66.4% |

*Note: Infrastructure costs stay relatively flat; variable costs (Twilio, Deepgram, Anthropic) scale linearly. Margins improve at scale as fixed costs are spread across more users.*

---

## Cost Optimization Opportunities

1. **Twilio Volume Discount** - Negotiate rates at higher volumes
2. **Deepgram Annual Contract** - Can get 20-30% discount
3. **Disable Live Transcription** - Use batch-only to cut Deepgram costs by ~64%
4. **Anthropic Batch API** - 50% cheaper for non-real-time extraction
5. **Anthropic Prompt Caching** - Cache reads cost 90% less than fresh input tokens
6. **Recording Retention** - Reduce from 30 to 7-14 days
7. **Phone Pooling** - Share numbers across case managers if feasible
8. **Sentry Sampling** - Reduce session replay and performance sample rates in production

---

## Break-Even Analysis

| Scenario | Break-Even Users (Batch) | Break-Even Users (Batch + Live) |
|----------|--------------------------|--------------------------------|
| Current pricing mix | ~35 users | ~43 users |
| All Starter plans | ~55 users | ~68 users |
| All Professional | ~20 users | ~24 users |

*With 100 users, you're well above break-even with healthy margins in either scenario.*
