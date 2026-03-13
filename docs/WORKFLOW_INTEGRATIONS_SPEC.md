# Workflow Integrations Spec (PX-882)

Push workflow outputs (action items, meeting notes, calendar events) to external platforms: Linear, Notion, Jira, and Google Calendar.

## Architecture

### SOLID Patterns

| Pattern | Purpose | Example |
|---------|---------|---------|
| **Factory** | Create provider-specific instances | `getWorkflowService(platform)` |
| **Adapter** | Normalize APIs to one interface | `WorkflowService.pushActionItem()` |
| **Strategy** | Swappable OAuth/token refresh | Platform-specific refresh |
| **Template Method** | Common workflow, platform-specific steps | OAuth flow |
| **Registry** | Map enum to implementations | `{ LINEAR: linearService }` |

### Directory Structure

```
apps/web/src/lib/integrations/
├── base/
│   ├── types.ts                    # WorkflowService interface
│   ├── oauth-handler.ts            # Reusable OAuth route handlers
│   ├── connection-handler.ts       # GET/DELETE connection handlers
│   ├── registry.ts                 # Factory: getWorkflowService(platform)
│   ├── schemas.ts                  # Zod validation schemas
│   ├── security.ts                 # Auth, RBAC, redirect validation
│   ├── token-store.ts              # Encrypted token management
│   └── logging.ts                  # Structured logging utilities
├── linear/
│   ├── service.ts                  # Implements WorkflowService
│   ├── client.ts                   # GraphQL client
│   └── types.ts
├── notion/
│   ├── service.ts
│   ├── client.ts
│   └── types.ts
├── jira/
│   ├── service.ts
│   ├── client.ts
│   └── types.ts
└── index.ts
```

### Core Interface

```typescript
interface WorkflowService {
  platform: IntegrationPlatform;
  isConfigured(): boolean;

  // OAuth
  getAuthorizationUrl(state: string): string;
  exchangeCodeForTokens(code: string): Promise<OAuthTokens>;
  testConnection(accessToken: string): Promise<ConnectionStatus>;

  // Push operations
  pushActionItem(orgId: string, draft: ActionItemDraft): Promise<PushResult>;
  pushMeetingNotes?(orgId: string, draft: MeetingNotesDraft): Promise<PushResult>;
}
```

---

## Reusable Utilities

### OAuth Route Handlers

| Utility | Purpose |
|---------|---------|
| `createOAuthAuthorizeHandler(platform)` | Generate OAuth authorize route |
| `createOAuthCallbackHandler(platform)` | Handle OAuth callback |
| `createGetConnectionHandler(platform)` | Get connection status |
| `createDeleteConnectionHandler(platform)` | Disconnect with audit log |

**Usage (routes become one-liners):**
```typescript
// api/integrations/linear/authorize/route.ts
export const GET = createOAuthAuthorizeHandler("LINEAR");
```

### Validation Schemas

| Schema | Purpose |
|--------|---------|
| `oauthStateSchema` | Validate state parameter |
| `linearTokenResponseSchema` | Validate Linear OAuth response |
| `notionTokenResponseSchema` | Validate Notion OAuth response |
| `jiraTokenResponseSchema` | Validate Jira OAuth response |

### Security Middleware

| Utility | Purpose |
|---------|---------|
| `withIntegrationAuth(handler)` | Auth + RBAC check wrapper |
| `validateRedirectUrl(url)` | Prevent open redirects |
| `sanitizeStateParam(state)` | Validate OAuth state |

### Token Management

| Utility | Purpose |
|---------|---------|
| `storeEncryptedToken(orgId, platform, tokens)` | AES-256-GCM storage |
| `getDecryptedToken(orgId, platform)` | Retrieve and decrypt |
| `refreshTokenIfNeeded(orgId, platform)` | Auto-refresh expired |

---

## Security Requirements

### 1. Rate Limiting
```typescript
import { withRateLimit } from "@/lib/rate-limit";
export const GET = withRateLimit(handler, { category: "authentication" });
```

### 2. RBAC
Only users with `canManageIntegrations` permission can connect.

### 3. Audit Logging
Log all connect/disconnect events:
```typescript
await createAuditLog({
  orgId, userId,
  action: "CREATE",
  resource: "INTEGRATION",
  details: { platform: "LINEAR" },
});
```

### 4. Input Validation
Zod schemas for all OAuth responses.

### 5. Redirect URL Validation
```typescript
function validateRedirectUrl(url: string): string {
  if (url.startsWith("/")) return url;
  try {
    const parsed = new URL(url);
    const appUrl = new URL(process.env.NEXT_PUBLIC_APP_URL!);
    if (parsed.origin === appUrl.origin) return url;
  } catch {}
  return "/settings/integrations";
}
```

### 6. Encrypted Token Storage
Use `IntegrationToken` model with AES-256-GCM (matching calendar pattern).

---

## API Endpoints

### OAuth Flow

```
GET  /api/integrations/{platform}/authorize     # Start OAuth
GET  /api/integrations/{platform}/callback      # Handle callback
GET  /api/integrations/{platform}               # Connection status
DELETE /api/integrations/{platform}             # Disconnect
```

### Push Outputs

```
POST /api/conversations/:id/outputs/:outputId/push    # Push single output
POST /api/conversations/:id/push-all                  # Push all approved
```

---

## Environment Variables

```bash
# Linear
LINEAR_CLIENT_ID=
LINEAR_CLIENT_SECRET=

# Notion
NOTION_CLIENT_ID=
NOTION_CLIENT_SECRET=

# Jira
JIRA_CLIENT_ID=
JIRA_CLIENT_SECRET=
```

---

## OAuth App Setup

### Linear
1. https://linear.app/settings/api → OAuth Applications
2. Redirect URI: `https://app.inkra.app/api/integrations/linear/callback`

### Notion
1. https://www.notion.so/my-integrations → OAuth 2.0
2. Redirect URI: `https://app.inkra.app/api/integrations/notion/callback`

### Jira
1. https://developer.atlassian.com/console/myapps/ → OAuth 2.0 (3LO)
2. Callback URL: `https://app.inkra.app/api/integrations/jira/callback`
3. Scopes: `read:jira-work`, `write:jira-work`, `read:jira-user`, `offline_access`

---

## Scaling Benefits

### Adding a New Integration

1. Create service (implements interface): ~100 lines
2. Register in factory: 1 line
3. Create routes (one-liners): 4 files
4. Add to Settings UI: 10 lines

**Total: ~150 lines** (vs ~500+ without this architecture)

### Maintenance

| Scenario | Without | With Architecture |
|----------|---------|-------------------|
| Fix OAuth security bug | 3+ files | 1 handler |
| Add rate limiting | Each route | Already included |
| Change token encryption | Each integration | 1 file |
| New integration | 500+ lines | 150 lines |

---

## Testing

### Unit Tests
```
apps/web/src/lib/integrations/base/__tests__/
├── oauth-handler.test.ts
├── schemas.test.ts
├── security.test.ts
├── token-store.test.ts
└── registry.test.ts
```

### Security Tests
1. Rate limiting (429 after 10 requests in 15 min)
2. RBAC (403 for VIEWER/CASE_MANAGER roles)
3. Open redirect prevention
4. State parameter tampering
5. Audit log verification

### Functional Tests
1. Full OAuth flow for each platform
2. Token storage and retrieval
3. Push operations
4. Auto-push on approve

---

## Related

- [Conversation Capture Infrastructure](./CONVERSATION_CAPTURE_INFRASTRUCTURE.md)
- [HIPAA Spec](./HIPAA_SPEC.md)
- [SOC2 Spec](./SOC2_SPEC.md)
