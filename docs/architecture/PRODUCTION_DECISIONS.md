# Production Architecture Decisions

This document captures the architecture decisions made for the Inkra production deployment.

## Decision 1: WebSocket Architecture

**Date**: March 2026
**Status**: Decided - Defer

### Context

Inkra needs real-time capabilities for:
- Live transcription streaming during calls
- Real-time form field updates during extraction
- Collaborative editing notifications

### Options Considered

| Option | Pros | Cons |
|--------|------|------|
| **A: Defer (post-call only)** | Fastest to launch, simplest architecture, no additional infrastructure | No real-time transcription display |
| **B: Pusher/Ably (managed)** | Quick integration (~1-2 days), auto-scales, no infrastructure | Monthly cost ($49-499/mo), vendor lock-in |
| **C: Socket.io on ECS** | Full control, no vendor dependency, one-time cost | Additional ECS task, sticky sessions complexity, more operational burden |

### Decision

**Option A: Defer real-time features for initial launch**

### Rationale

1. **MVP Focus**: Initial customers need accurate extraction, not real-time transcription display
2. **Reduced Complexity**: Fewer moving parts for launch means fewer failure modes
3. **Cost Efficiency**: No additional infrastructure or vendor costs
4. **Future Flexibility**: Can add Pusher/Ably later without architectural changes

### Consequences

- Users see transcription only after call ends
- Form extraction happens post-call, not in real-time
- Future: Revisit for Q2 2026 when customer feedback indicates demand

---

## Decision 2: ClamAV Hosting

**Date**: March 2026
**Status**: Decided - Split by Environment

### Context

HIPAA compliance requires virus scanning of all uploaded files before processing. ClamAV is the industry-standard open-source solution.

### Options Considered

| Option | Pros | Cons |
|--------|------|------|
| **A: ClamAV on Railway (demo only)** | Free, simple setup, included in Railway resources | Not HIPAA-compliant, shared infrastructure |
| **B: ClamAV on ECS (production)** | HIPAA-compliant, isolated, controlled updates | ECS task cost (~$15-30/mo), requires health monitoring |
| **C: VirusTotal API** | No hosting, enterprise-grade detection | Per-scan cost, external dependency, potential PHI exposure |

### Decision

**Split approach:**
- **Demo**: No ClamAV (synthetic data only, no PHI)
- **Production**: ClamAV on ECS Fargate

### Rationale

1. **Compliance**: Production PHI requires in-VPC scanning without external data exposure
2. **Cost Efficiency**: Demo doesn't need scanning (no real files)
3. **Isolation**: ECS task runs in private subnet, no external network calls

### Implementation

Production ClamAV ECS Task Definition:
```yaml
Family: inkra-clamav-prod
Container:
  Image: clamav/clamav:latest
  CPU: 512
  Memory: 1024
  PortMappings: 3310:3310
  HealthCheck:
    Command: ["CMD", "clamdscan", "--ping", "3"]
    Interval: 30
    Timeout: 10
    Retries: 3
```

### Consequences

- Production has ~$15-30/mo additional cost
- Need to monitor ClamAV signature updates (automated via container)
- Demo environment cannot process real user uploads

---

## Decision 3: Compute Platform

**Date**: March 2026
**Status**: Decided - Vercel + ECS

### Context

The application has two components:
1. **Next.js Frontend/API**: SSR, API routes, static assets
2. **ML Services**: Python, GPU-optional, background workers

### Decision

- **Next.js**: Deploy to **Vercel** (optimized for Next.js, global CDN, zero-config)
- **ML Services**: Deploy to **ECS Fargate** (custom Docker, long-running workers)

### Rationale

1. **Vercel**: Native Next.js support, automatic optimization, no infrastructure management
2. **ECS**: Full control for Python services, GPU support when needed, cost-effective for workers
3. **Separation**: Frontend can deploy independently of ML services

### Consequences

- Two deployment pipelines (Vercel + ECS)
- ML services accessed via internal ALB, not exposed to internet
- Vercel handles SSL, CDN, edge functions automatically

---

## Decision 4: Database Architecture

**Date**: March 2026
**Status**: Decided - Aurora PostgreSQL

### Decision

**RDS Aurora PostgreSQL 16** with:
- Multi-AZ deployment
- pgvector extension for embeddings
- 7-day automated backups
- Performance Insights enabled

### Rationale

1. **Aurora**: Automatic failover, better performance than standard RDS
2. **pgvector**: Required for ML embedding storage
3. **Multi-AZ**: HIPAA requires high availability

---

## Decision 5: Cache Architecture

**Date**: March 2026
**Status**: Decided - ElastiCache Redis

### Decision

**ElastiCache Redis 7** cluster mode with:
- 2-node cluster (primary + replica)
- Encryption in transit (TLS)
- Auth token required

### Rationale

1. **BullMQ**: Requires Redis for job queue
2. **Session Cache**: Reduces database load
3. **Cluster Mode**: Allows horizontal scaling when needed

---

## Environment Isolation Summary

| Component | Demo (Railway) | Production (AWS) |
|-----------|----------------|------------------|
| **Compute** | Railway | Vercel + ECS |
| **Database** | Railway PostgreSQL | Aurora PostgreSQL |
| **Cache** | Railway Redis | ElastiCache Redis |
| **Storage** | S3 demo bucket | S3 prod buckets (KMS) |
| **Auth** | Supabase (demo project) | Supabase (prod project) |
| **Twilio** | Demo subaccount | Prod subaccount |
| **Stripe** | Test mode | Live mode |
| **ClamAV** | None | ECS Fargate |
| **PHI Allowed** | No | Yes |

---

## Future Considerations

### Q2 2026: Real-time Features
- Evaluate Pusher vs Ably based on pricing
- Consider Socket.io if we need custom protocols

### Q3 2026: GPU Inference
- Evaluate ECS GPU instances vs SageMaker
- Consider Bedrock for managed model hosting

### Q4 2026: Multi-region
- Active-active deployment if customer demand requires
- Currently: active-passive with cross-region replication
