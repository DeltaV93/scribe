-- Add correlationId to AuditLog (PX-970)
ALTER TABLE "AuditLog" ADD COLUMN "correlationId" TEXT;

-- Create index for correlationId
CREATE INDEX "AuditLog_correlationId_idx" ON "AuditLog"("correlationId");

-- Add WORKFLOW to IntegrationPlatform enum (PX-882)
ALTER TYPE "IntegrationPlatform" ADD VALUE 'WORKFLOW';

-- Create UserIntegrationStatus enum (PX-882)
CREATE TYPE "UserIntegrationStatus" AS ENUM ('PENDING', 'ACTIVE', 'ERROR', 'DISCONNECTED');

-- Create UserIntegrationConnection table (PX-882)
CREATE TABLE "UserIntegrationConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "platform" "IntegrationPlatform" NOT NULL,
    "config" JSONB,
    "status" "UserIntegrationStatus" NOT NULL DEFAULT 'PENDING',
    "lastUsedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "externalUserId" TEXT,
    "externalUserName" TEXT,
    "connectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserIntegrationConnection_pkey" PRIMARY KEY ("id")
);

-- Add unique constraint for one connection per user per platform
CREATE UNIQUE INDEX "UserIntegrationConnection_userId_platform_key" ON "UserIntegrationConnection"("userId", "platform");

-- Create indexes for UserIntegrationConnection
CREATE INDEX "UserIntegrationConnection_orgId_platform_idx" ON "UserIntegrationConnection"("orgId", "platform");
CREATE INDEX "UserIntegrationConnection_userId_idx" ON "UserIntegrationConnection"("userId");

-- Add foreign key constraints for UserIntegrationConnection
ALTER TABLE "UserIntegrationConnection" ADD CONSTRAINT "UserIntegrationConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserIntegrationConnection" ADD CONSTRAINT "UserIntegrationConnection_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add userIntegrationConnectionId to IntegrationToken (PX-882)
ALTER TABLE "IntegrationToken" ADD COLUMN "userIntegrationConnectionId" TEXT;

-- Create unique constraint for userIntegrationConnectionId
CREATE UNIQUE INDEX "IntegrationToken_userIntegrationConnectionId_key" ON "IntegrationToken"("userIntegrationConnectionId");

-- Add foreign key constraint for IntegrationToken -> UserIntegrationConnection
ALTER TABLE "IntegrationToken" ADD CONSTRAINT "IntegrationToken_userIntegrationConnectionId_fkey" FOREIGN KEY ("userIntegrationConnectionId") REFERENCES "UserIntegrationConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
