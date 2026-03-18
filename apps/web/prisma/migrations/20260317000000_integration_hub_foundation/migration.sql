-- Integration Hub Foundation (PX-1001 + PX-1002)
-- Adds encrypted token storage, provider registry, and resource discovery

-- CreateEnum
CREATE TYPE "IntegrationCategory" AS ENUM ('COMMUNICATION', 'DOCUMENTATION', 'PROJECT_MGMT', 'CRM', 'HR_LEGAL', 'HEALTHCARE', 'NONPROFIT', 'CALENDAR');

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('WORKSPACE', 'TEAM', 'PROJECT', 'DATABASE', 'CHANNEL', 'FOLDER');

-- AlterTable: Make accessToken nullable for migration to IntegrationToken
ALTER TABLE "IntegrationConnection" ALTER COLUMN "accessToken" DROP NOT NULL;

-- AlterTable: Add integrationConnectionId to IntegrationToken
ALTER TABLE "IntegrationToken" ADD COLUMN "integrationConnectionId" TEXT;

-- CreateTable: IntegrationProvider
CREATE TABLE "IntegrationProvider" (
    "id" TEXT NOT NULL,
    "platform" "IntegrationPlatform" NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientSecret" TEXT NOT NULL,
    "authorizeUrl" TEXT NOT NULL,
    "tokenUrl" TEXT NOT NULL,
    "scopes" TEXT[],
    "redirectUri" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "iconUrl" TEXT,
    "category" "IntegrationCategory" NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isConfigured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable: IntegrationResource
CREATE TABLE "IntegrationResource" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "resourceType" "ResourceType" NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "metadata" JSONB,

    CONSTRAINT "IntegrationResource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationProvider_platform_key" ON "IntegrationProvider"("platform");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationToken_integrationConnectionId_key" ON "IntegrationToken"("integrationConnectionId");

-- CreateIndex
CREATE INDEX "IntegrationResource_connectionId_idx" ON "IntegrationResource"("connectionId");

-- CreateIndex
CREATE INDEX "IntegrationResource_resourceType_idx" ON "IntegrationResource"("resourceType");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationResource_connectionId_resourceType_externalId_key" ON "IntegrationResource"("connectionId", "resourceType", "externalId");

-- AddForeignKey
ALTER TABLE "IntegrationToken" ADD CONSTRAINT "IntegrationToken_integrationConnectionId_fkey" FOREIGN KEY ("integrationConnectionId") REFERENCES "IntegrationConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationResource" ADD CONSTRAINT "IntegrationResource_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "IntegrationConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
