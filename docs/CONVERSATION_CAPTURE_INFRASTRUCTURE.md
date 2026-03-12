# Conversation Capture Infrastructure Setup

This document covers the infrastructure setup required for PX-865: In-Person & Voice Recording Capture System.

## Overview

The conversation capture system requires:
- S3 buckets for recording storage (separate for demo/prod)
- AWS IAM credentials with appropriate permissions
- CORS configuration for browser uploads
- Environment variables per deployment

---

## S3 Bucket Setup

### Naming Convention

| Environment | Bucket Name | Region |
|-------------|-------------|--------|
| Demo | `scrybe-uploads-demo` | us-east-2 |
| Production | `scrybe-uploads-prod` | us-east-2 |

### Bucket Creation Settings

**General Configuration**
- Bucket type: General purpose
- Region: US East (Ohio) us-east-2

**Object Ownership**
- ACLs disabled (recommended)

**Block Public Access**
- ✅ Block all public access (presigned URLs still work)

**Bucket Versioning**
- Demo: Disable (cost savings)
- Production: Enable (data recovery)

**Default Encryption**
- Server-side encryption with Amazon S3 managed keys (SSE-S3)

**Object Lock**
- Disable (unless HIPAA/compliance requires WORM)

**Tags**
```
Environment: demo | production
Project: inkra
Feature: conversation-capture
```

---

## CORS Configuration

After creating each bucket, configure CORS under **Permissions → CORS**.

### Demo Bucket CORS

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedOrigins": [
      "https://demo.inkra.app",
      "http://localhost:3000"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

### Production Bucket CORS

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedOrigins": [
      "https://app.inkra.app",
      "https://inkra.app"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

---

## IAM Setup

### Create IAM User

1. Go to IAM → Users → Create user
2. User name: `inkra-recordings-demo` or `inkra-recordings-prod`
3. Access type: Programmatic access only

### IAM Policy

Create a policy with minimum required permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3RecordingsBucket",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::scrybe-uploads-demo",
        "arn:aws:s3:::scrybe-uploads-demo/*"
      ]
    }
  ]
}
```

For production, replace `scrybe-uploads-demo` with `scrybe-uploads-prod`.

### Generate Access Keys

1. Go to the IAM user → Security credentials
2. Create access key → Application running outside AWS
3. Save the Access Key ID and Secret Access Key securely

---

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `AWS_ACCESS_KEY_ID` | IAM user access key | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret key | `wJal...` |
| `AWS_REGION` | S3 bucket region | `us-east-2` |
| `AWS_S3_BUCKET` | Bucket name | `scrybe-uploads-demo` |

### Railway Configuration

**Demo Environment** (`demo.inkra.app`):
```
AWS_ACCESS_KEY_ID=<demo-access-key>
AWS_SECRET_ACCESS_KEY=<demo-secret-key>
AWS_REGION=us-east-2
AWS_S3_BUCKET=scrybe-uploads-demo
```

**Production Environment** (`app.inkra.app`):
```
AWS_ACCESS_KEY_ID=<prod-access-key>
AWS_SECRET_ACCESS_KEY=<prod-secret-key>
AWS_REGION=us-east-2
AWS_S3_BUCKET=scrybe-uploads-prod
```

### Local Development

Add to `.env.local`:
```
AWS_ACCESS_KEY_ID=<your-dev-key>
AWS_SECRET_ACCESS_KEY=<your-dev-secret>
AWS_REGION=us-east-2
AWS_S3_BUCKET=scrybe-uploads-demo
```

---

## Content Security Policy

The app's CSP headers must allow connections to S3. This is configured in `next.config.js`:

```javascript
// connect-src includes S3 for uploads
'connect-src': "... https://*.s3.us-east-2.amazonaws.com https://*.s3.us-east-1.amazonaws.com https://*.s3.amazonaws.com"

// media-src includes S3 for playback
'media-src': "... https://*.s3.us-east-2.amazonaws.com https://*.s3.us-east-1.amazonaws.com https://*.s3.amazonaws.com blob:"
```

---

## Recording Storage Structure

Recordings are stored with the following key structure:

```
recordings/{orgId}/{conversationId}.webm
```

Example:
```
recordings/c78d7d24-2ee8-45fb-af75-95b60809d2d5/a92c7f92-2f25-4d2d-a46f-eb072dbfc465.webm
```

---

## Lifecycle Policies (Optional)

For cost optimization, configure lifecycle rules:

### Demo Bucket
- Delete objects after 30 days (test data cleanup)

### Production Bucket
- Transition to S3 Glacier after 90 days
- Delete based on org retention policy (stored in `recordingRetention` field)

---

## Verification Checklist

After setup, verify:

- [ ] Bucket created with correct settings
- [ ] CORS configured with correct origins
- [ ] IAM user created with minimal permissions
- [ ] Access keys generated and stored securely
- [ ] Environment variables set in Railway
- [ ] Test recording upload works from browser
- [ ] Test recording playback works

### Test Upload Command

```bash
# Generate a presigned URL via API
curl -X POST https://demo.inkra.app/api/conversations/in-person \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Recording"}'

# Response includes upload.url - use it to PUT a test file
```

---

## Troubleshooting

### "CORS error" when uploading
- Check CORS configuration on the bucket
- Verify the origin in CORS matches your domain exactly
- Hard refresh browser to clear cached CSP

### "Could not load credentials from any providers"
- Check `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are set
- Verify IAM user has correct permissions
- Check for typos in env vars

### "Access Denied" on upload
- Verify IAM policy includes `s3:PutObject`
- Check bucket name matches `AWS_S3_BUCKET` env var
- Verify IAM user has access to the specific bucket

### "Feature not enabled" error
- Enable "Conversation Capture" feature flag in Admin → Features
- Feature flag key: `conversation-capture`

---

## Related Documentation

- [PX-865 Technical Spec](/Users/valeriephoenix/.claude/plans/glimmering-singing-axolotl.md)
- [HIPAA Compliance](./HIPAA_SPEC.md)
- [SOC2 Compliance](./SOC2_SPEC.md)
- [Monorepo Architecture](./MONOREPO_ARCHITECTURE.md)
