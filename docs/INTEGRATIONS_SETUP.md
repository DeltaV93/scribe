# Workflow Integrations Setup Guide

This guide explains how to configure workflow integrations for pushing action items, meeting notes, and other outputs to external platforms.

## Supported Platforms

| Platform | Features | OAuth Type |
|----------|----------|------------|
| **Linear** | Action items, issues | OAuth 2.0 |
| **Notion** | Meeting notes, documents | OAuth 2.0 |
| **Jira** | Action items, issues | OAuth 2.0 (3LO) |
| **Google Calendar** | Calendar events | OAuth 2.0 |

---

## Linear OAuth App Setup

1. Go to [Linear Settings > API > OAuth Applications](https://linear.app/settings/api)
2. Click "Create new application"
3. Fill in the application details:
   - **Name**: `Inkra`
   - **Description**: `Conversation-to-work automation`
   - **Developer URL**: Your company website
   - **Callback URL**: `https://app.inkra.app/api/integrations/linear/callback`
     - For local development: `http://localhost:3000/api/integrations/linear/callback`
4. Request the following scopes:
   - `read` - Read access to user's data
   - `write` - Write access to create issues
   - `issues:create` - Create issues
5. Copy the **Client ID** and **Client Secret**
6. Add to your environment variables:
   ```bash
   LINEAR_CLIENT_ID=your_client_id
   LINEAR_CLIENT_SECRET=your_client_secret
   ```

---

## Notion OAuth App Setup

1. Go to [My Integrations](https://www.notion.so/my-integrations)
2. Click "New integration"
3. Configure the integration:
   - **Name**: `Inkra`
   - **Associated workspace**: Select your workspace
   - **Type**: Select "Public"
   - **Integration type**: Select "OAuth 2.0"
4. Under OAuth settings:
   - **Redirect URI**: `https://app.inkra.app/api/integrations/notion/callback`
     - For local development: `http://localhost:3000/api/integrations/notion/callback`
5. Under Capabilities, enable:
   - Read content
   - Insert content
   - Update content
6. Copy the **OAuth client ID** and **OAuth client secret**
7. Add to your environment variables:
   ```bash
   NOTION_CLIENT_ID=your_client_id
   NOTION_CLIENT_SECRET=your_client_secret
   ```

---

## Jira OAuth App Setup

1. Go to [Atlassian Developer Console](https://developer.atlassian.com/console/myapps/)
2. Click "Create" and select "OAuth 2.0 integration"
3. Fill in application details:
   - **Name**: `Inkra`
   - **Description**: `Conversation-to-work automation`
4. Configure OAuth 2.0 (3LO):
   - Click "Authorization" in the left menu
   - Click "Add" next to OAuth 2.0 (3LO)
   - **Callback URL**: `https://app.inkra.app/api/integrations/jira/callback`
     - For local development: `http://localhost:3000/api/integrations/jira/callback`
5. Configure Permissions:
   - Click "Permissions" in the left menu
   - Click "Add" next to Jira API
   - Add these scopes:
     - `read:jira-work` - Read Jira issues
     - `write:jira-work` - Create and update issues
     - `read:jira-user` - Read user information
     - `offline_access` - Refresh tokens
6. Copy your **Client ID** and generate a **Client Secret** under "Settings"
7. Add to your environment variables:
   ```bash
   JIRA_CLIENT_ID=your_client_id
   JIRA_CLIENT_SECRET=your_client_secret
   ```

---

## Environment Variables Reference

All workflow integration environment variables:

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

# Google Calendar (separate integration)
GOOGLE_CALENDAR_CLIENT_ID=
GOOGLE_CALENDAR_CLIENT_SECRET=
```

For Railway deployment, add these in the project settings under Variables.

---

## Connecting Integrations

Once OAuth apps are configured:

1. Navigate to **Settings > Integrations** in the Inkra dashboard
2. Scroll to the **Workflow Integrations** section
3. Click "Connect" on the desired platform
4. Authorize Inkra to access your workspace
5. Once connected, the platform will show as "Connected"

---

## Auto-Push on Approve

When a workflow output (action item, meeting notes, etc.) is approved:

1. Inkra checks if a destination platform is configured for the output
2. If the platform is connected for your organization, the output is automatically pushed
3. The output status changes to "Pushed" on success, or "Failed" with an error message

**Manual Push**: If auto-push fails or the platform wasn't connected at approval time, you can manually push from the output's detail view.

---

## Troubleshooting

### "Platform not configured"
The OAuth credentials are missing from environment variables. Add the required `*_CLIENT_ID` and `*_CLIENT_SECRET` values.

### "Token expired - reconnection required"
The access token has expired and cannot be refreshed. Disconnect and reconnect the integration in Settings.

### "No Jira sites accessible"
The user who connected Jira doesn't have access to any Jira sites. Ensure they have admin or project access.

### "No projects available" (Jira)
The connected Jira site has no projects. Create a project in Jira first, or configure a specific project in the output settings.

### Linear/Notion push fails silently
Check that the user who connected the integration has permission to create issues/pages in the target workspace or team.

---

## Security Notes

- OAuth tokens are stored securely in the database
- Only organization admins and program managers can connect/disconnect integrations
- All integration actions are audit-logged
- Tokens are scoped to minimum required permissions

---

## Architecture (for developers)

The workflow integrations use a SOLID architecture:

```
apps/web/src/lib/integrations/
├── base/
│   ├── types.ts          # WorkflowService interface
│   ├── registry.ts       # Factory: getWorkflowService()
│   ├── oauth-handler.ts  # Reusable OAuth route handlers
│   ├── token-store.ts    # Token storage utilities
│   └── schemas.ts        # Zod validation schemas
├── linear/service.ts     # Implements WorkflowService
├── notion/service.ts     # Implements WorkflowService
└── jira/service.ts       # Implements WorkflowService
```

Adding a new integration requires:
1. Create `service.ts` implementing `WorkflowService`
2. Register in `registry.ts`
3. Add OAuth routes (one-liners using `createOAuthAuthorizeHandler`)
4. Add to Settings UI platform list

See the plan file for full architecture details: `~/.claude/plans/glimmering-singing-axolotl.md`
