# API Rate Limiting - Technical Design

**Status:** Implemented
**Linear Issue:** PX-670
**Date:** January 31, 2026

## Overview

Distributed API rate limiting using Redis with sliding window algorithm. Provides abuse prevention, brute force protection, and SOC 2 compliance through violation logging.

## Architecture

### Component Diagram

```mermaid
graph TB
    subgraph "Client"
        Browser[Browser/App]
        API[API Client]
    end

    subgraph "Edge Layer"
        MW[Next.js Middleware]
    end

    subgraph "Rate Limit Layer"
        RL[Rate Limiter]
        Config[Config]
        Audit[Audit Logger]
    end

    subgraph "Storage Layer"
        Redis[(Redis)]
        Memory[In-Memory Fallback]
        DB[(PostgreSQL)]
    end

    Browser --> MW
    API --> MW
    MW --> RL
    RL --> Config
    RL --> Redis
    RL -.->|Fallback| Memory
    RL --> Audit
    Audit --> DB
```

## Rate Limit Configuration

### Endpoint Categories

| Category | Limit | Window | Purpose |
|----------|-------|--------|---------|
| Authentication | 10 requests | 15 minutes | Brute force protection |
| API (authenticated) | 1000 requests | 1 minute | General API usage |
| File uploads | 10 uploads | 1 hour | Storage abuse prevention |
| Webhooks | 100 requests | 1 minute | Integration limits |
| Public endpoints | 100 requests | 1 minute | Unauthenticated access |
| Health checks | 1000 requests | 1 minute | Monitoring systems |

### Route Matching

```mermaid
flowchart TD
    A[Incoming Request] --> B{Match Route Pattern}
    B -->|/api/auth/*| C[AUTH: 10/15min]
    B -->|/api/webhooks/*| D[WEBHOOK: 100/1min]
    B -->|/api/uploads/*| E[UPLOAD: 10/1hr]
    B -->|/api/health| F[HEALTH: 1000/1min]
    B -->|/api/* authenticated| G[API: 1000/1min]
    B -->|Other /api/*| H[PUBLIC: 100/1min]
```

## Request Flow

### Rate Limit Check Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant MW as Middleware
    participant RL as Rate Limiter
    participant R as Redis
    participant API as API Route

    C->>MW: HTTP Request
    MW->>MW: Extract IP + User ID
    MW->>RL: checkRateLimit(key, config)

    RL->>R: ZREMRANGEBYSCORE (cleanup old)
    RL->>R: ZADD (add current request)
    RL->>R: ZCARD (count requests)
    R-->>RL: count

    alt Under Limit
        RL-->>MW: {allowed: true, remaining: N}
        MW->>MW: Add rate limit headers
        MW->>API: Continue to route
        API-->>C: 200 Response + Headers
    else Over Limit
        RL-->>MW: {allowed: false, retryAfter: Xs}
        MW->>MW: Log violation
        MW-->>C: 429 Too Many Requests
    end
```

### Sliding Window Algorithm

```mermaid
graph LR
    subgraph "Redis Sorted Set"
        T1[Request @ t1]
        T2[Request @ t2]
        T3[Request @ t3]
        TN[Request @ tN]
    end

    subgraph "Window"
        W[Current Window: now - windowMs]
    end

    W -->|ZREMRANGEBYSCORE| T1
    W -->|Keep| T2
    W -->|Keep| T3
    W -->|Keep| TN
```

## Response Headers

### Standard Rate Limit Headers

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1706698200
```

### 429 Response

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1706698260
Content-Type: application/json

{
  "error": "Too many requests",
  "message": "Rate limit exceeded. Please try again later.",
  "retryAfter": 60
}
```

## Tracking Strategy

### Dual Tracking

```mermaid
graph TD
    A[Request] --> B{Has User ID?}
    B -->|Yes| C[Track by User ID]
    B -->|No| D[Track by IP only]
    C --> E{IP Tracking Enabled?}
    E -->|Yes| F[Also Track by IP]
    E -->|No| G[User ID only]
    F --> H[Both limits apply]
```

### Key Format

```
rate_limit:{category}:{identifier}:{window_start}

Examples:
- rate_limit:auth:192.168.1.1:1706698200
- rate_limit:api:user_abc123:1706698200
- rate_limit:upload:user_xyz789:1706694600
```

## Graceful Degradation

### Redis Unavailable

```mermaid
flowchart TD
    A[Check Rate Limit] --> B{Redis Available?}
    B -->|Yes| C[Use Redis]
    B -->|No| D[Use In-Memory Map]
    D --> E{Memory Limit?}
    E -->|Under| F[Allow with warning]
    E -->|Over| G[Fail open or closed]
    C --> H[Return result]
    F --> H
    G --> H
```

## Audit Logging

### Violation Tracking

```mermaid
sequenceDiagram
    participant RL as Rate Limiter
    participant Buf as Violation Buffer
    participant Cron as Cron Job
    participant Audit as Audit Log

    RL->>Buf: Record violation
    Note over Buf: Buffer violations
    Cron->>Buf: Flush violations
    Buf->>Audit: Batch insert
    Note over Audit: Log with severity
```

### Severity Classification

| Overage | Severity | Description |
|---------|----------|-------------|
| 1-5x | LOW | Normal traffic spike |
| 5-10x | MEDIUM | Unusual activity |
| >10x | HIGH | Potential abuse |

## File Structure

```
src/lib/rate-limit/
├── redis.ts       # Redis client singleton
├── config.ts      # Rate limit configurations
├── limiter.ts     # Sliding window algorithm
├── middleware.ts  # Next.js middleware integration
├── audit.ts       # Violation logging
└── index.ts       # Exports

src/app/api/cron/
└── flush-rate-limit-violations/
    └── route.ts   # Periodic audit flush

middleware.ts      # Main middleware (updated)
```

## Configuration

### Environment Variables

```bash
# Redis connection (shared with BullMQ)
REDIS_URL=redis://localhost:6379

# Optional: Cron job protection
CRON_SECRET=your-secret-here
```

### Customizing Limits

```typescript
// src/lib/rate-limit/config.ts
export const RATE_LIMIT_CONFIGS: Record<RateLimitCategory, RateLimitConfig> = {
  auth: {
    limit: 10,
    windowMs: 15 * 60 * 1000, // 15 minutes
    keyPrefix: "auth",
    trackBy: ["ip"],
  },
  api: {
    limit: 1000,
    windowMs: 60 * 1000, // 1 minute
    keyPrefix: "api",
    trackBy: ["userId", "ip"],
  },
  // ... other categories
};
```

## API Usage

### Manual Rate Limit Check

```typescript
import { checkRateLimit, getRateLimitStatus } from "@/lib/rate-limit";

// Check if request is allowed
const result = await checkRateLimit(
  `api:${userId}`,
  { limit: 100, windowMs: 60000 }
);

if (!result.allowed) {
  return new Response("Too many requests", { status: 429 });
}

// Get current status without incrementing
const status = await getRateLimitStatus(
  `api:${userId}`,
  { limit: 100, windowMs: 60000 }
);
console.log(`${status.remaining} requests remaining`);
```

### Reset Rate Limit (Admin)

```typescript
import { resetRateLimit } from "@/lib/rate-limit";

// Reset a specific user's limit
await resetRateLimit(`api:${userId}`);
```

## Testing Checklist

- [ ] Auth endpoints limited to 10/15min
- [ ] API endpoints limited to 1000/min
- [ ] Upload endpoints limited to 10/hour
- [ ] Rate limit headers in all responses
- [ ] 429 response with Retry-After header
- [ ] Violations logged to audit trail
- [ ] Redis fallback to in-memory works
- [ ] Per-user and per-IP tracking works
- [ ] Middleware integration working

## SOC 2 Compliance

| Control | Implementation |
|---------|----------------|
| CC6.1 | Logical access controls via rate limiting |
| CC7.2 | Violation monitoring and logging |
| A1.1 | Protection against DoS attacks |
