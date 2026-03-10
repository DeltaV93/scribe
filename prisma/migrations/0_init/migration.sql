-- CreateEnum
CREATE TYPE "Tier" AS ENUM ('FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "FormType" AS ENUM ('INTAKE', 'FOLLOWUP', 'REFERRAL', 'ASSESSMENT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "FormStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "FieldType" AS ENUM ('TEXT_SHORT', 'TEXT_LONG', 'NUMBER', 'DATE', 'PHONE', 'EMAIL', 'ADDRESS', 'DROPDOWN', 'CHECKBOX', 'YES_NO', 'FILE', 'SIGNATURE');

-- CreateEnum
CREATE TYPE "FieldPurpose" AS ENUM ('GRANT_REQUIREMENT', 'INTERNAL_OPS', 'COMPLIANCE', 'OUTCOME_MEASUREMENT', 'RISK_ASSESSMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "GranteeType" AS ENUM ('TEAM', 'USER');

-- CreateEnum
CREATE TYPE "FormRole" AS ENUM ('VIEW', 'USE', 'EDIT');

-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('PENDING', 'SCANNING', 'CLEAN', 'INFECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'CASE_MANAGER', 'FACILITATOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "ProgramMemberRole" AS ENUM ('MANAGER', 'FACILITATOR', 'CASE_MANAGER', 'VIEWER');

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('ACTIVE', 'ON_HOLD', 'CLOSED', 'PENDING');

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('INITIATING', 'RINGING', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED', 'ATTEMPTED', 'FAILED');

-- CreateEnum
CREATE TYPE "CallDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "InteractionType" AS ENUM ('VOIP_CALL', 'IN_PERSON', 'VIDEO_CALL');

-- CreateEnum
CREATE TYPE "UnrecordedReason" AS ENUM ('CLIENT_OPT_OUT', 'PRIOR_OPT_OUT', 'SYSTEM_ERROR', 'CONSENT_ABANDONED');

-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'QUEUED_FOR_RETRY');

-- CreateEnum
CREATE TYPE "NoteType" AS ENUM ('INTERNAL', 'SHAREABLE');

-- CreateEnum
CREATE TYPE "NoteStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'PUBLISHED', 'REJECTED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('MENTION', 'APPROVAL_REQUEST', 'APPROVAL_RESULT', 'REMINDER', 'SYSTEM', 'GOAL_PROGRESS_ALERT', 'GOAL_AT_RISK', 'GOAL_DEADLINE_APPROACHING', 'GOAL_COMPLETED', 'KPI_THRESHOLD_REACHED', 'CLIENT_GOAL_UPDATE', 'INTEGRATION_ERROR', 'CALENDAR_EVENT_CREATED', 'CALENDAR_PENDING_REVIEW');

-- CreateEnum
CREATE TYPE "ConsentMode" AS ENUM ('AUTO_RECORDING', 'CASE_MANAGER_SCRIPT', 'DISABLED');

-- CreateEnum
CREATE TYPE "PhoneNumberRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "WaitlistStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ProgramStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProgramLabelType" AS ENUM ('PROGRAM', 'COURSE', 'CLASS', 'WORKSHOP', 'TRAINING', 'GROUP');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ENROLLED', 'IN_PROGRESS', 'COMPLETED', 'WITHDRAWN', 'FAILED', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED', 'RESCHEDULED');

-- CreateEnum
CREATE TYPE "MaterialType" AS ENUM ('SYLLABUS', 'HANDOUT', 'PRESENTATION', 'WORKSHEET', 'ASSESSMENT', 'CERTIFICATE_TEMPLATE', 'OTHER');

-- CreateEnum
CREATE TYPE "ExtractionStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AttendanceUploadStatus" AS ENUM ('SHEET_GENERATED', 'IN_PROGRESS', 'PHOTO_UPLOADED', 'AI_PROCESSING', 'PENDING_REVIEW', 'CONFIRMED', 'FAILED', 'PENDING_OVERRIDE_REVIEW');

-- CreateEnum
CREATE TYPE "AttendanceType" AS ENUM ('PRESENT', 'EXCUSED', 'ABSENT');

-- CreateEnum
CREATE TYPE "GrantStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'EXPIRED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MetricType" AS ENUM ('CLIENT_CONTACTS', 'CLIENTS_ENROLLED', 'PROGRAM_COMPLETIONS', 'CLIENTS_HOUSED', 'SESSIONS_DELIVERED', 'FORM_SUBMISSIONS', 'CUSTOM');

-- CreateEnum
CREATE TYPE "DeliverableStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'AT_RISK', 'COMPLETED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "ProgressEventType" AS ENUM ('INCREMENT', 'DECREMENT', 'ADJUSTMENT', 'RESET');

-- CreateEnum
CREATE TYPE "TriggerEvent" AS ENUM ('INTAKE_COMPLETED', 'ENROLLMENT_CREATED', 'CALL_COMPLETED', 'SESSION_MISSED', 'FORM_SUBMITTED', 'CLIENT_CREATED');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('PENDING', 'SENT', 'ACKNOWLEDGED', 'COMPLETED', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReminderType" AS ENUM ('FOLLOW_UP_CALL', 'DOCUMENT_REQUEST', 'APPOINTMENT_REMINDER', 'PROGRAM_CHECK_IN', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ActionItemSource" AS ENUM ('CALL_TRANSCRIPT', 'MANUAL', 'WORKFLOW');

-- CreateEnum
CREATE TYPE "AvailabilityStatus" AS ENUM ('AVAILABLE', 'LIMITED', 'UNAVAILABLE', 'ON_LEAVE');

-- CreateEnum
CREATE TYPE "ClientSharePermission" AS ENUM ('VIEW', 'EDIT', 'FULL');

-- CreateEnum
CREATE TYPE "MessageSenderType" AS ENUM ('CASE_MANAGER', 'CLIENT');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('DRAFT', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- CreateEnum
CREATE TYPE "SmsDeliveryStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'UNDELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'BOUNCED', 'FAILED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "NoteTemplateScope" AS ENUM ('ORG', 'PROGRAM', 'USER');

-- CreateEnum
CREATE TYPE "ConversionSourceType" AS ENUM ('PHOTO', 'PDF_CLEAN', 'PDF_SCANNED');

-- CreateEnum
CREATE TYPE "ConversionStatus" AS ENUM ('PENDING', 'PROCESSING', 'REVIEW_REQUIRED', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('HUD_APR', 'DOL_WORKFORCE', 'CALI_GRANTS', 'BOARD_REPORT', 'IMPACT_REPORT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ReportTemplateStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('GENERATING', 'REVIEW_REQUIRED', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "StorageTier" AS ENUM ('FULL', 'COMPRESSED');

-- CreateEnum
CREATE TYPE "ExportType" AS ENUM ('CAP60', 'DOL_WIPS', 'CALI_GRANTS', 'HUD_HMIS', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ExportTemplateStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ExportStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'VALIDATION_REQUIRED');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'PARSING', 'MAPPING', 'READY', 'PROCESSING', 'COMPLETED', 'FAILED', 'ROLLED_BACK');

-- CreateEnum
CREATE TYPE "ImportRecordStatus" AS ENUM ('PENDING', 'CREATED', 'UPDATED', 'SKIPPED', 'FAILED', 'ROLLED_BACK');

-- CreateEnum
CREATE TYPE "DuplicateAction" AS ENUM ('SKIP', 'UPDATE', 'CREATE_NEW', 'MERGE');

-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('STORE', 'DISTRICT', 'REGION', 'HEADQUARTERS');

-- CreateEnum
CREATE TYPE "LocationAccessLevel" AS ENUM ('VIEW', 'EDIT', 'MANAGE');

-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('SCHEDULED', 'JOINING', 'RECORDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "MeetingSource" AS ENUM ('TEAMS', 'ZOOM', 'UPLOAD', 'GOOGLE_MEET');

-- CreateEnum
CREATE TYPE "ActionItemStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "KnowledgeSource" AS ENUM ('MEETING', 'DOCUMENT', 'MANUAL');

-- CreateEnum
CREATE TYPE "MeetingPlatform" AS ENUM ('TEAMS', 'ZOOM', 'GOOGLE_MEET');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('PENDING', 'ACTIVE', 'EXPIRED', 'ERROR', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "CalendarProvider" AS ENUM ('GOOGLE', 'OUTLOOK', 'APPLE');

-- CreateEnum
CREATE TYPE "CalendarIntegrationStatus" AS ENUM ('PENDING', 'ACTIVE', 'ERROR', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "CalendarEventStatus" AS ENUM ('CREATED', 'UPDATED', 'DELETED', 'FAILED');

-- CreateEnum
CREATE TYPE "PendingSchedulingTier" AS ENUM ('TIER_1_CONFLICT', 'TIER_2_VAGUE');

-- CreateEnum
CREATE TYPE "PendingSchedulingStatus" AS ENUM ('PENDING', 'APPROVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "IntegrationTokenType" AS ENUM ('ZOOM', 'TEAMS', 'GOOGLE_MEET', 'GOOGLE_CALENDAR', 'OUTLOOK_CALENDAR', 'APPLE_CALENDAR');

-- CreateEnum
CREATE TYPE "ObjectiveStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "KeyResultStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'AT_RISK', 'COMPLETED');

-- CreateEnum
CREATE TYPE "GoalType" AS ENUM ('GRANT', 'KPI', 'OKR', 'PROGRAM_INITIATIVE', 'TEAM_INITIATIVE', 'INDIVIDUAL');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'ON_TRACK', 'AT_RISK', 'BEHIND', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ClientOutcomeType" AS ENUM ('EMPLOYMENT', 'HOUSING', 'EDUCATION', 'CERTIFICATION', 'OTHER');

-- CreateEnum
CREATE TYPE "ClientGoalStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'ACHIEVED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "KpiMetricType" AS ENUM ('COUNT', 'PERCENTAGE', 'CURRENCY', 'DURATION', 'RATING', 'CUSTOM');

-- CreateEnum
CREATE TYPE "QuizQuestionType" AS ENUM ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'FREE_TEXT', 'SCALE', 'MATCHING', 'ORDERING', 'FILE_UPLOAD');

-- CreateEnum
CREATE TYPE "QuizAttemptStatus" AS ENUM ('IN_PROGRESS', 'PASSED', 'FAILED');

-- CreateEnum
CREATE TYPE "QuizAudience" AS ENUM ('STAFF', 'CLIENT', 'BOTH');

-- CreateEnum
CREATE TYPE "ChatSessionStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ABANDONED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "CredentialStatus" AS ENUM ('ACTIVE', 'EXPIRING', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PlacementStatus" AS ENUM ('ACTIVE', 'ENDED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "ConsentMethod" AS ENUM ('DIGITAL', 'VERBAL', 'PRE_SIGNED');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('RECORDING', 'TRANSCRIPTION', 'DATA_STORAGE');

-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('GRANTED', 'REVOKED', 'PENDING');

-- CreateEnum
CREATE TYPE "ConsentCollectionMethod" AS ENUM ('KEYPRESS', 'VERBAL', 'WRITTEN', 'SILENCE_TIMEOUT');

-- CreateEnum
CREATE TYPE "StateConsentType" AS ENUM ('ONE_PARTY', 'TWO_PARTY');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('CALL_COMPLETED', 'CALL_MISSED', 'NOTE_ADDED', 'FORM_SUBMITTED', 'FORM_UPDATED', 'ATTENDANCE_RECORDED', 'ENROLLMENT_CREATED', 'ENROLLMENT_UPDATED', 'ACTION_ITEM_CREATED', 'ACTION_ITEM_COMPLETED', 'CONSENT_GRANTED', 'CONSENT_REVOKED');

-- CreateEnum
CREATE TYPE "ConversationType" AS ENUM ('PHONE_CALL', 'IN_PERSON', 'VIDEO_MEETING');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('SCHEDULED', 'RECORDING', 'PROCESSING', 'REVIEW', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "SensitivityTier" AS ENUM ('STANDARD', 'RESTRICTED', 'REDACTED');

-- CreateEnum
CREATE TYPE "SensitivityCategory" AS ENUM ('PERSONAL_OFF_TOPIC', 'HR_SENSITIVE', 'LEGAL_SENSITIVE', 'HEALTH_SENSITIVE', 'FINANCIAL_SENSITIVE');

-- CreateEnum
CREATE TYPE "VideoPlatform" AS ENUM ('ZOOM', 'GOOGLE_MEET', 'MICROSOFT_TEAMS');

-- CreateEnum
CREATE TYPE "FlagReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'OVERRIDDEN', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ConversationAccessType" AS ENUM ('PARTICIPANT', 'GRANTED', 'INHERITED');

-- CreateEnum
CREATE TYPE "WorkflowOutputType" AS ENUM ('ACTION_ITEM', 'MEETING_NOTES', 'DOCUMENT', 'CALENDAR_EVENT', 'GOAL_UPDATE', 'DELAY_SIGNAL');

-- CreateEnum
CREATE TYPE "IntegrationPlatform" AS ENUM ('LINEAR', 'JIRA', 'GOOGLE_DOCS', 'NOTION', 'GOOGLE_CALENDAR', 'OUTLOOK_CALENDAR');

-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'PUSHED', 'FAILED');

-- CreateEnum
CREATE TYPE "ConversationLinkStatus" AS ENUM ('SUGGESTED', 'CONFIRMED', 'REJECTED');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "tier" "Tier" NOT NULL DEFAULT 'FREE',
    "purchasedFormPacks" INTEGER NOT NULL DEFAULT 0,
    "encryptionKeyId" TEXT,
    "webhookUrl" TEXT,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "featureFlags" JSONB NOT NULL DEFAULT '{}',
    "userLimit" INTEGER NOT NULL DEFAULT 3,
    "preferredAreaCode" TEXT,
    "recordingRetentionDays" INTEGER NOT NULL DEFAULT 30,
    "consentMode" "ConsentMode" NOT NULL DEFAULT 'CASE_MANAGER_SCRIPT',
    "consentRecordingUrl" TEXT,
    "stripeCustomerId" TEXT,
    "requireMfa" BOOLEAN NOT NULL DEFAULT false,
    "sessionTimeoutMinutes" INTEGER NOT NULL DEFAULT 30,
    "maxConcurrentSessions" INTEGER NOT NULL DEFAULT 3,
    "realTimeChatEnabled" BOOLEAN NOT NULL DEFAULT false,
    "businessHoursStart" TEXT,
    "businessHoursEnd" TEXT,
    "businessHoursTimezone" TEXT,
    "businessHoursDays" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5]::INTEGER[],
    "chatbotEnabled" BOOLEAN NOT NULL DEFAULT false,
    "chatbotFormId" TEXT,
    "chatbotCrisisContact" TEXT,
    "chatbotAuthRequired" BOOLEAN NOT NULL DEFAULT false,
    "inPersonRecordingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "maxRecordingDurationMinutes" INTEGER NOT NULL DEFAULT 60,
    "workforceEnabled" BOOLEAN NOT NULL DEFAULT false,
    "eligibilityCheckEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatarUrl" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'CASE_MANAGER',
    "supabaseUserId" TEXT NOT NULL,
    "canCreateForms" BOOLEAN NOT NULL DEFAULT false,
    "canReadForms" BOOLEAN NOT NULL DEFAULT true,
    "canUpdateForms" BOOLEAN NOT NULL DEFAULT false,
    "canDeleteForms" BOOLEAN NOT NULL DEFAULT false,
    "canPublishForms" BOOLEAN NOT NULL DEFAULT false,
    "maxCaseload" INTEGER,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecret" TEXT,
    "mfaBackupCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mfaLastUsed" TIMESTAMP(3),
    "mfaEnabledAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deactivatedAt" TIMESTAMP(3),
    "deactivatedById" TEXT,
    "passwordChangedAt" TIMESTAMP(3),
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseManagerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "maxCaseload" INTEGER NOT NULL DEFAULT 30,
    "currentCaseload" INTEGER NOT NULL DEFAULT 0,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "languages" TEXT[] DEFAULT ARRAY['English']::TEXT[],
    "specializations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "availabilityStatus" "AvailabilityStatus" NOT NULL DEFAULT 'AVAILABLE',
    "availabilityNote" TEXT,
    "preferredClientTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseManagerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientMatchPreference" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "preferredLanguages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requiredSkills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "specialNeeds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientMatchPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Form" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "FormType" NOT NULL,
    "status" "FormStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "settings" JSONB NOT NULL DEFAULT '{"allowPartialSaves": true, "requireSupervisorReview": false, "autoArchiveDays": null, "activityTriggers": []}',
    "fieldFingerprint" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "Form_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormField" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FieldType" NOT NULL,
    "purpose" "FieldPurpose" NOT NULL,
    "purposeNote" TEXT,
    "helpText" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isSensitive" BOOLEAN NOT NULL DEFAULT false,
    "isAiExtractable" BOOLEAN NOT NULL DEFAULT true,
    "options" JSONB,
    "section" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "conditionalLogic" JSONB,
    "translations" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormVersion" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "aiExtractionPrompt" TEXT NOT NULL,
    "publishedById" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormAccess" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "granteeType" "GranteeType" NOT NULL,
    "granteeId" TEXT NOT NULL,
    "role" "FormRole" NOT NULL,
    "grantedById" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractionExample" (
    "id" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "transcriptSnippet" TEXT NOT NULL,
    "extractedValue" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExtractionExample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormTemplate" (
    "id" TEXT NOT NULL,
    "orgId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tags" TEXT[],
    "thumbnail" TEXT,
    "useCaseExamples" TEXT[],
    "formSnapshot" JSONB NOT NULL,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usageCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FormTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormSubmission" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "formVersionId" TEXT NOT NULL,
    "clientId" TEXT,
    "callId" TEXT,
    "data" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "isComplete" BOOLEAN NOT NULL DEFAULT false,
    "isDraft" BOOLEAN NOT NULL DEFAULT true,
    "aiExtractedData" JSONB,
    "aiConfidence" JSONB,
    "flaggedFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "submittedById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Signature" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "imageData" BYTEA NOT NULL,
    "imageHash" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signerIp" TEXT NOT NULL,
    "signerUserAgent" TEXT NOT NULL,
    "signerSessionId" TEXT NOT NULL,
    "geolocation" JSONB,
    "deviceFingerprint" TEXT,
    "consentRecorded" BOOLEAN NOT NULL DEFAULT true,
    "consentText" TEXT,
    "documentHash" TEXT,

    CONSTRAINT "Signature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileUpload" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "scanStatus" "ScanStatus" NOT NULL DEFAULT 'PENDING',
    "scanResult" JSONB,
    "scannedAt" TIMESTAMP(3),
    "extractedText" TEXT,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "resourceName" TEXT,
    "details" JSONB NOT NULL DEFAULT '{}',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "previousHash" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceReport" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedById" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "hash" TEXT NOT NULL,

    CONSTRAINT "ComplianceReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT NOT NULL,
    "stripeCustomerId" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentHistory" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "stripePaymentId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "additionalPhones" JSONB,
    "email" TEXT,
    "address" JSONB,
    "internalId" TEXT,
    "status" "ClientStatus" NOT NULL DEFAULT 'ACTIVE',
    "assignedTo" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "emailBounced" BOOLEAN NOT NULL DEFAULT false,
    "emailBouncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientShare" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "sharedWithUserId" TEXT NOT NULL,
    "sharedByUserId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "permission" "ClientSharePermission" NOT NULL DEFAULT 'VIEW',
    "expiresAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ClientShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Call" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "caseManagerId" TEXT NOT NULL,
    "formIds" TEXT[],
    "status" "CallStatus" NOT NULL DEFAULT 'INITIATING',
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "twilioCallSid" TEXT,
    "recordingUrl" TEXT,
    "recordingRetention" TIMESTAMP(3),
    "isRecorded" BOOLEAN NOT NULL DEFAULT true,
    "consentGrantedAt" TIMESTAMP(3),
    "consentMethod" "ConsentCollectionMethod",
    "transcriptRaw" TEXT,
    "transcriptJson" JSONB,
    "aiSummary" JSONB,
    "extractedFields" JSONB,
    "confidenceScores" JSONB,
    "manualCorrections" JSONB,
    "mlMatchedForms" JSONB,
    "mlMatchingTimestamp" TIMESTAMP(3),
    "mlServiceUsed" BOOLEAN NOT NULL DEFAULT false,
    "aiProcessingStatus" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "aiProcessingError" TEXT,
    "aiProcessingRetries" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Call_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "callId" TEXT,
    "sessionId" TEXT,
    "authorId" TEXT NOT NULL,
    "type" "NoteType" NOT NULL DEFAULT 'INTERNAL',
    "status" "NoteStatus" NOT NULL DEFAULT 'DRAFT',
    "content" TEXT NOT NULL,
    "tags" TEXT[],
    "isMassNote" BOOLEAN NOT NULL DEFAULT false,
    "isDraft" BOOLEAN NOT NULL DEFAULT false,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteVersion" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "editedById" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteMention" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "mentionedUserId" TEXT NOT NULL,
    "notified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteMention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteTag" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "programId" TEXT,
    "name" TEXT NOT NULL,
    "colorHash" TEXT NOT NULL,
    "isRestricted" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NoteTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TwilioNumber" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "twilioSid" TEXT NOT NULL,
    "areaCode" TEXT NOT NULL,
    "provisionedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TwilioNumber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhoneNumberPool" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "twilioSid" TEXT NOT NULL,
    "areaCode" TEXT NOT NULL,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "monthlyCost" DECIMAL(10,2) NOT NULL DEFAULT 5.00,

    CONSTRAINT "PhoneNumberPool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhoneNumberRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "status" "PhoneNumberRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "rejectionReason" TEXT,

    CONSTRAINT "PhoneNumberRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormEditLog" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "previousValue" JSONB,
    "newValue" JSONB,
    "editedBy" TEXT NOT NULL,
    "editedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editReason" TEXT,

    CONSTRAINT "FormEditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceLock" (
    "id" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "lockedBy" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResourceLock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserInvitation" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "teamId" TEXT,
    "maxCaseload" INTEGER,
    "token" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "reminderSentAt" TIMESTAMP(3),
    "invitedById" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Waitlist" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "teamSize" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "status" "WaitlistStatus" NOT NULL DEFAULT 'PENDING',
    "approvalToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Waitlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Program" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "labelType" "ProgramLabelType" NOT NULL DEFAULT 'PROGRAM',
    "description" TEXT,
    "requiredHours" INTEGER,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "schedule" JSONB,
    "location" TEXT,
    "maxEnrollment" INTEGER,
    "facilitatorId" TEXT,
    "status" "ProgramStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramSession" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "sessionNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "topic" TEXT,
    "date" TIMESTAMP(3),
    "durationMinutes" INTEGER,
    "notes" TEXT,
    "status" "SessionStatus" NOT NULL DEFAULT 'DRAFT',
    "rescheduledToId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionStatusHistory" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "oldStatus" "SessionStatus",
    "newStatus" "SessionStatus" NOT NULL,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "rescheduledToId" TEXT,

    CONSTRAINT "SessionStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramEnrollment" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "enrolledDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ENROLLED',
    "hoursOverride" DECIMAL(6,2),
    "completionDate" TIMESTAMP(3),
    "withdrawalDate" TIMESTAMP(3),
    "withdrawalReason" TEXT,
    "enrolledById" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionAttendance" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "attended" BOOLEAN NOT NULL DEFAULT false,
    "hoursAttended" DECIMAL(4,2),
    "notes" TEXT,
    "recordedById" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "attendanceType" "AttendanceType",
    "uploadSourceId" TEXT,
    "timeIn" TIMESTAMP(3),
    "timeOut" TIMESTAMP(3),
    "signatureVerified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SessionAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramMaterial" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "sessionId" TEXT,
    "filename" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "materialType" "MaterialType" NOT NULL DEFAULT 'OTHER',
    "extractionStatus" "ExtractionStatus" NOT NULL DEFAULT 'PENDING',
    "extractedData" JSONB,
    "extractionError" TEXT,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgramMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceSheetConfig" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "includeTimeInOut" BOOLEAN NOT NULL DEFAULT true,
    "includeClientSignature" BOOLEAN NOT NULL DEFAULT true,
    "includeNotes" BOOLEAN NOT NULL DEFAULT true,
    "customInstructions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceSheetConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceCode" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceUpload" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "status" "AttendanceUploadStatus" NOT NULL DEFAULT 'SHEET_GENERATED',
    "sheetPath" TEXT,
    "sheetGeneratedAt" TIMESTAMP(3),
    "photoPath" TEXT,
    "photoUploadedAt" TIMESTAMP(3),
    "photoMimeType" TEXT,
    "photoSizeBytes" INTEGER,
    "enhancedPhotoPath" TEXT,
    "aiProcessingStartedAt" TIMESTAMP(3),
    "aiProcessingEndedAt" TIMESTAMP(3),
    "aiRawResponse" JSONB,
    "aiExtractedData" JSONB,
    "aiConfidence" DOUBLE PRECISION,
    "aiError" TEXT,
    "aiRetryCount" INTEGER NOT NULL DEFAULT 0,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewNotes" TEXT,
    "isOverride" BOOLEAN NOT NULL DEFAULT false,
    "overrideReason" TEXT,
    "overrideApprovedById" TEXT,
    "overrideApprovedAt" TIMESTAMP(3),
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceExtractedRecord" (
    "id" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "enrollmentId" TEXT,
    "attendanceType" "AttendanceType",
    "qrCodeDetected" BOOLEAN NOT NULL DEFAULT false,
    "qrCodeValue" TEXT,
    "printedCodeDetected" BOOLEAN NOT NULL DEFAULT false,
    "printedCodeValue" TEXT,
    "timeIn" TIMESTAMP(3),
    "timeOut" TIMESTAMP(3),
    "signatureDetected" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "confidence" DOUBLE PRECISION,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "reviewFlag" TEXT,
    "isManuallyVerified" BOOLEAN NOT NULL DEFAULT false,
    "manuallyVerifiedById" TEXT,
    "manuallyVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceExtractedRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceUploadRateLimit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "uploadCount" INTEGER NOT NULL DEFAULT 1,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceUploadRateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "senderId" TEXT,
    "senderType" "MessageSenderType" NOT NULL,
    "content" TEXT NOT NULL,
    "contentHash" TEXT,
    "status" "MessageStatus" NOT NULL DEFAULT 'SENT',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageAttachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsNotification" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "twilioSid" TEXT,
    "deliveryStatus" "SmsDeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsPreference" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "optedIn" BOOLEAN NOT NULL DEFAULT false,
    "phoneNumber" TEXT NOT NULL,
    "optedInAt" TIMESTAMP(3),
    "optedOutAt" TIMESTAMP(3),
    "optInMethod" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "messageId" TEXT,
    "clientId" TEXT,
    "recipientEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "templateId" TEXT,
    "body" TEXT,
    "status" "EmailStatus" NOT NULL DEFAULT 'QUEUED',
    "sesMessageId" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "bouncedAt" TIMESTAMP(3),
    "bounceType" TEXT,
    "bounceReason" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalToken" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "messageId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsTemplate" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalSession" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "csrfToken" TEXT NOT NULL,

    CONSTRAINT "PortalSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientPIN" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientPIN_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhoneVerification" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PhoneVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobProgress" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "completed" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "result" JSONB,
    "error" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "actionUrl" TEXT,
    "metadata" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteTemplate" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "programId" TEXT,
    "userId" TEXT,
    "scope" "NoteTemplateScope" NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "availableVariables" TEXT[],
    "sessionType" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NoteTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormConversion" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "sourceType" "ConversionSourceType" NOT NULL,
    "sourcePath" TEXT NOT NULL,
    "status" "ConversionStatus" NOT NULL DEFAULT 'PENDING',
    "detectedFields" JSONB,
    "fieldPositions" JSONB,
    "confidence" DOUBLE PRECISION,
    "warnings" TEXT[],
    "requiresOriginalExport" BOOLEAN NOT NULL DEFAULT false,
    "resultFormId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "FormConversion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportTemplate" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "ReportType" NOT NULL,
    "status" "ReportTemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "questionnaireAnswers" JSONB NOT NULL,
    "metrics" JSONB NOT NULL,
    "sections" JSONB NOT NULL,
    "funderRequirements" JSONB,
    "aiGeneratedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "publishedById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "reportingPeriodStart" TIMESTAMP(3) NOT NULL,
    "reportingPeriodEnd" TIMESTAMP(3) NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'GENERATING',
    "storageTier" "StorageTier" NOT NULL DEFAULT 'FULL',
    "pdfPath" TEXT,
    "generatedData" JSONB,
    "narrativeSections" JSONB,
    "generatedById" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportSnapshot" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "dataSnapshot" JSONB NOT NULL,
    "metricsVersion" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomMetric" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "baseMetricId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "calculation" JSONB NOT NULL,
    "version" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FunderDocumentLibrary" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "funderName" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "sourcePath" TEXT NOT NULL,
    "extractedText" TEXT NOT NULL,
    "extractedRequirements" JSONB NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL,
    "curatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FunderDocumentLibrary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportTemplate" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "exportType" "ExportType" NOT NULL,
    "status" "ExportTemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "fieldMappings" JSONB NOT NULL,
    "sourceFormIds" TEXT[],
    "validationRules" JSONB,
    "outputFormat" TEXT NOT NULL DEFAULT 'CSV',
    "outputConfig" JSONB,
    "scheduleEnabled" BOOLEAN NOT NULL DEFAULT false,
    "scheduleCron" TEXT,
    "scheduleTimezone" TEXT NOT NULL DEFAULT 'America/Los_Angeles',
    "lastScheduledRunAt" TIMESTAMP(3),
    "nextScheduledRunAt" TIMESTAMP(3),
    "scheduleFailureCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExportTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FunderExport" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "status" "ExportStatus" NOT NULL DEFAULT 'PENDING',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "programIds" TEXT[],
    "clientIds" TEXT[],
    "filePath" TEXT,
    "recordCount" INTEGER,
    "validationErrors" JSONB,
    "warnings" JSONB,
    "generatedById" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3),
    "processingTimeMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FunderExport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportTemplate" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sourceSystem" TEXT,
    "fileFormat" TEXT NOT NULL DEFAULT 'CSV',
    "fieldMappings" JSONB NOT NULL,
    "duplicateSettings" JSONB,
    "defaultAction" "DuplicateAction" NOT NULL DEFAULT 'SKIP',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "templateId" TEXT,
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "totalRows" INTEGER,
    "processedRows" INTEGER NOT NULL DEFAULT 0,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "fieldMappings" JSONB,
    "duplicateSettings" JSONB,
    "previewData" JSONB,
    "detectedColumns" TEXT[],
    "suggestedMappings" JSONB,
    "validationErrors" JSONB,
    "rollbackAvailableUntil" TIMESTAMP(3),
    "rollbackExecutedAt" TIMESTAMP(3),
    "uploadedById" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportRecord" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "status" "ImportRecordStatus" NOT NULL DEFAULT 'PENDING',
    "action" "DuplicateAction",
    "sourceData" JSONB NOT NULL,
    "mappedData" JSONB,
    "duplicateMatches" JSONB,
    "selectedMatchId" TEXT,
    "createdClientId" TEXT,
    "updatedClientId" TEXT,
    "validationErrors" JSONB,
    "processingNotes" TEXT,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "ImportRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "LocationType" NOT NULL,
    "code" TEXT,
    "parentId" TEXT,
    "address" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "timezone" TEXT NOT NULL DEFAULT 'America/Los_Angeles',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserLocation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "accessLevel" "LocationAccessLevel" NOT NULL DEFAULT 'VIEW',
    "grantedById" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "MeetingStatus" NOT NULL DEFAULT 'SCHEDULED',
    "source" "MeetingSource" NOT NULL DEFAULT 'UPLOAD',
    "externalMeetingId" TEXT,
    "externalJoinUrl" TEXT,
    "scheduledStartAt" TIMESTAMP(3),
    "scheduledEndAt" TIMESTAMP(3),
    "actualStartAt" TIMESTAMP(3),
    "actualEndAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "recordingPath" TEXT,
    "recordingSize" INTEGER,
    "processingStartedAt" TIMESTAMP(3),
    "processingCompletedAt" TIMESTAMP(3),
    "processingError" TEXT,
    "participants" JSONB,
    "participantCount" INTEGER,
    "summaryEmailSentAt" TIMESTAMP(3),
    "emailRecipients" TEXT[],
    "locationId" TEXT,
    "tags" TEXT[],
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingTranscript" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "fullText" TEXT NOT NULL,
    "wordCount" INTEGER,
    "segments" JSONB NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "transcriptionModel" TEXT,
    "wordErrorRate" DOUBLE PRECISION,
    "processingTimeMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingTranscript_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingSummary" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "executiveSummary" TEXT NOT NULL,
    "keyPoints" JSONB NOT NULL,
    "decisions" JSONB NOT NULL,
    "topicsDiscussed" TEXT[],
    "summaryModel" TEXT,
    "tokensUsed" INTEGER,
    "processingTimeMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingActionItem" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "assigneeName" TEXT,
    "assigneeEmail" TEXT,
    "assigneeUserId" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" "ActionItemStatus" NOT NULL DEFAULT 'OPEN',
    "contextSnippet" TEXT,
    "timestampSeconds" INTEGER,
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingActionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingQuestion" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "askedByName" TEXT,
    "askedByUserId" TEXT,
    "isAnswered" BOOLEAN NOT NULL DEFAULT false,
    "answer" TEXT,
    "answeredByName" TEXT,
    "answeredByUserId" TEXT,
    "answeredAt" TIMESTAMP(3),
    "contextSnippet" TEXT,
    "timestampSeconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeEntry" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "summary" TEXT,
    "source" "KnowledgeSource" NOT NULL DEFAULT 'MANUAL',
    "meetingId" TEXT,
    "documentPath" TEXT,
    "tags" TEXT[],
    "category" TEXT,
    "embeddingId" TEXT,
    "embeddingVector" DOUBLE PRECISION[],
    "createdById" TEXT NOT NULL,
    "lastUpdatedById" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingIntegration" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "platform" "MeetingPlatform" NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "externalUserId" TEXT,
    "externalTenantId" TEXT,
    "webhookId" TEXT,
    "webhookSecret" TEXT,
    "webhookExpiresAt" TIMESTAMP(3),
    "status" "IntegrationStatus" NOT NULL DEFAULT 'PENDING',
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "autoRecordEnabled" BOOLEAN NOT NULL DEFAULT true,
    "syncCalendarEnabled" BOOLEAN NOT NULL DEFAULT false,
    "connectedById" TEXT NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarIntegration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "provider" "CalendarProvider" NOT NULL,
    "externalEmail" TEXT,
    "status" "CalendarIntegrationStatus" NOT NULL DEFAULT 'PENDING',
    "lastError" TEXT,
    "clientAutoInvite" BOOLEAN NOT NULL DEFAULT true,
    "connectedAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "provider" "CalendarProvider" NOT NULL,
    "title" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "rrule" TEXT,
    "callId" TEXT,
    "clientId" TEXT,
    "calendarIntegrationId" TEXT,
    "pendingSchedulingItemId" TEXT,
    "actionItemId" TEXT,
    "clientInvited" BOOLEAN NOT NULL DEFAULT false,
    "status" "CalendarEventStatus" NOT NULL DEFAULT 'CREATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PendingSchedulingItem" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "clientId" TEXT,
    "clientName" TEXT NOT NULL,
    "extractedContext" TEXT NOT NULL,
    "extractedDateHint" TEXT,
    "hasRecurrence" BOOLEAN NOT NULL DEFAULT false,
    "recurrencePattern" TEXT,
    "tier" "PendingSchedulingTier" NOT NULL,
    "conflictDetails" JSONB,
    "status" "PendingSchedulingStatus" NOT NULL DEFAULT 'PENDING',
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingSchedulingItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationToken" (
    "id" TEXT NOT NULL,
    "type" "IntegrationTokenType" NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meetingIntegrationId" TEXT,
    "calendarIntegrationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EncryptionKey" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "encryptedDek" TEXT NOT NULL,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotatedAt" TIMESTAMP(3),

    CONSTRAINT "EncryptionKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "deviceInfo" JSONB NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "lastActivity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "terminatedAt" TIMESTAMP(3),
    "terminationReason" TEXT,

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustedDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "deviceInfo" JSONB NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokedBy" TEXT,

    CONSTRAINT "TrustedDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grant" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "funderName" TEXT,
    "grantNumber" TEXT,
    "description" TEXT,
    "status" "GrantStatus" NOT NULL DEFAULT 'DRAFT',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reportingFrequency" TEXT,
    "exportTemplateId" TEXT,
    "notificationSettings" JSONB NOT NULL DEFAULT '{}',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Grant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrantDeliverable" (
    "id" TEXT NOT NULL,
    "grantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "metricType" "MetricType" NOT NULL,
    "targetValue" INTEGER NOT NULL,
    "currentValue" INTEGER NOT NULL DEFAULT 0,
    "customConfig" JSONB,
    "dueDate" TIMESTAMP(3),
    "status" "DeliverableStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "completedAt" TIMESTAMP(3),
    "autoReportOnComplete" BOOLEAN NOT NULL DEFAULT true,
    "reportTemplateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GrantDeliverable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrantProgramLink" (
    "id" TEXT NOT NULL,
    "grantId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GrantProgramLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliverableProgress" (
    "id" TEXT NOT NULL,
    "deliverableId" TEXT NOT NULL,
    "eventType" "ProgressEventType" NOT NULL,
    "delta" INTEGER NOT NULL,
    "previousValue" INTEGER NOT NULL,
    "newValue" INTEGER NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "notes" TEXT,
    "recordedById" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliverableProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrantReport" (
    "id" TEXT NOT NULL,
    "grantId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "reportType" TEXT NOT NULL,
    "dataSnapshot" JSONB NOT NULL,
    "narrativeSummary" TEXT,
    "pdfPath" TEXT,
    "generatedById" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GrantReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowRule" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "triggerEvent" "TriggerEvent" NOT NULL,
    "conditions" JSONB,
    "delayDays" INTEGER NOT NULL,
    "reminderType" "ReminderType" NOT NULL,
    "assignToRole" "UserRole",
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "workflowRuleId" TEXT,
    "clientId" TEXT NOT NULL,
    "assignedToId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 2,
    "sentAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallActionItem" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "assigneeName" TEXT,
    "assigneeUserId" TEXT,
    "assigneeRole" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" "ActionItemStatus" NOT NULL DEFAULT 'OPEN',
    "source" "ActionItemSource" NOT NULL DEFAULT 'CALL_TRANSCRIPT',
    "priority" TEXT,
    "contextSnippet" TEXT,
    "timestampSeconds" INTEGER,
    "aiConfidence" DOUBLE PRECISION,
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallActionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Objective" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "ownerId" TEXT NOT NULL,
    "parentId" TEXT,
    "status" "ObjectiveStatus" NOT NULL DEFAULT 'DRAFT',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "progress" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Objective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeyResult" (
    "id" TEXT NOT NULL,
    "objectiveId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "currentValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "status" "KeyResultStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KeyResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeyResultProgress" (
    "id" TEXT NOT NULL,
    "keyResultId" TEXT NOT NULL,
    "previousValue" DOUBLE PRECISION NOT NULL,
    "newValue" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "recordedById" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KeyResultProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObjectiveUpdate" (
    "id" TEXT NOT NULL,
    "objectiveId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "progressSnapshot" INTEGER,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ObjectiveUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "GoalType" NOT NULL,
    "status" "GoalStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "progress" INTEGER NOT NULL DEFAULT 0,
    "ownerId" TEXT,
    "teamId" TEXT,
    "autoCompleteOnProgress" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoalGrant" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "grantId" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoalGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoalObjective" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "objectiveId" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoalObjective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoalKpi" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "kpiId" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoalKpi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoalProgramLink" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "isInherited" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoalProgramLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoalProgress" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "previousValue" INTEGER NOT NULL,
    "newValue" INTEGER NOT NULL,
    "previousStatus" "GoalStatus" NOT NULL,
    "newStatus" "GoalStatus" NOT NULL,
    "triggerType" TEXT NOT NULL,
    "triggerSource" TEXT,
    "notes" TEXT,
    "recordedById" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoalProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoalUpdate" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "progressSnapshot" INTEGER,
    "statusSnapshot" "GoalStatus",
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoalUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallGoalDraft" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "narrative" TEXT NOT NULL,
    "actionItems" JSONB NOT NULL,
    "keyPoints" JSONB NOT NULL,
    "sentiment" TEXT,
    "topics" JSONB NOT NULL,
    "mappingType" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "editedContent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallGoalDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Kpi" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parentKpiId" TEXT,
    "metricType" "KpiMetricType" NOT NULL,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "currentValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "trackingFrequency" TEXT,
    "progressPercentage" INTEGER NOT NULL DEFAULT 0,
    "ownerId" TEXT,
    "teamId" TEXT,
    "dataSourceConfig" JSONB,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Kpi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KpiProgress" (
    "id" TEXT NOT NULL,
    "kpiId" TEXT NOT NULL,
    "previousValue" DOUBLE PRECISION NOT NULL,
    "newValue" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "recordedById" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KpiProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KpiProgramLink" (
    "id" TEXT NOT NULL,
    "kpiId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KpiProgramLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientGoal" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "outcomeType" "ClientOutcomeType" NOT NULL,
    "status" "ClientGoalStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "metricType" "KpiMetricType",
    "targetValue" DOUBLE PRECISION,
    "currentValue" DOUBLE PRECISION DEFAULT 0,
    "unit" TEXT,
    "startDate" TIMESTAMP(3),
    "deadline" TIMESTAMP(3),
    "achievedAt" TIMESTAMP(3),
    "achievedNotes" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "createdByClientId" TEXT,
    "clientVisibility" BOOLEAN NOT NULL DEFAULT true,
    "clientCanEdit" BOOLEAN NOT NULL DEFAULT false,
    "clientNotes" TEXT,
    "staffNotes" TEXT,
    "assignedToId" TEXT,
    "programId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "ClientGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientGoalProgress" (
    "id" TEXT NOT NULL,
    "clientGoalId" TEXT NOT NULL,
    "previousValue" DOUBLE PRECISION,
    "newValue" DOUBLE PRECISION,
    "previousStatus" "ClientGoalStatus" NOT NULL,
    "newStatus" "ClientGoalStatus" NOT NULL,
    "notes" TEXT,
    "recordedById" TEXT,
    "recordedByClient" BOOLEAN NOT NULL DEFAULT false,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientGoalProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatRoom" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quiz" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "audience" "QuizAudience" NOT NULL DEFAULT 'BOTH',
    "passingScore" INTEGER NOT NULL DEFAULT 80,
    "maxAttempts" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Quiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizQuestion" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "type" "QuizQuestionType" NOT NULL,
    "question" TEXT NOT NULL,
    "options" JSONB,
    "correctAnswer" JSONB NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 1,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuizQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizAttempt" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" INTEGER,
    "totalPoints" INTEGER,
    "maxPoints" INTEGER,
    "status" "QuizAttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizAnswer" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answer" JSONB NOT NULL,
    "isCorrect" BOOLEAN,
    "pointsEarned" INTEGER,
    "fileUrl" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuizAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatSession" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "status" "ChatSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "clientPhone" TEXT,
    "clientEmail" TEXT,
    "extractedData" JSONB,
    "lastQuestionIndex" INTEGER NOT NULL DEFAULT 0,
    "handoffRequested" BOOLEAN NOT NULL DEFAULT false,
    "handoffUserId" TEXT,
    "handoffRequestedAt" TIMESTAMP(3),
    "crisisDetected" BOOLEAN NOT NULL DEFAULT false,
    "crisisDetectedAt" TIMESTAMP(3),
    "resumeToken" TEXT,
    "completedAt" TIMESTAMP(3),
    "clientId" TEXT,
    "dropOffField" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobPlacement" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "employerName" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "hourlyWage" DECIMAL(10,2),
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "status" "PlacementStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobPlacement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Credential" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuingOrg" TEXT,
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "status" "CredentialStatus" NOT NULL DEFAULT 'ACTIVE',
    "documentUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Credential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientInsurance" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "groupNumber" TEXT,
    "payerCode" TEXT,
    "payerName" TEXT,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "terminationDate" TIMESTAMP(3),
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "subscriberName" TEXT,
    "subscriberDob" TIMESTAMP(3),
    "subscriberRelation" TEXT,
    "planType" TEXT,
    "planPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientInsurance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EligibilityCheck" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "insurancePlanId" TEXT,
    "serviceCode" TEXT NOT NULL,
    "serviceName" TEXT,
    "isEligible" BOOLEAN NOT NULL,
    "responseData" JSONB NOT NULL,
    "documentUrls" TEXT[],
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "requestId" TEXT,
    "providerNpi" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EligibilityCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InPersonRecording" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recordingUrl" TEXT,
    "duration" INTEGER,
    "transcriptText" TEXT,
    "extractedData" JSONB,
    "confidenceScores" JSONB,
    "processingStatus" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "processingError" TEXT,
    "processedAt" TIMESTAMP(3),
    "consentMethod" "ConsentMethod" NOT NULL,
    "consentRecordedAt" TIMESTAMP(3) NOT NULL,
    "consentSignature" TEXT,
    "consentDocumentId" TEXT,
    "formIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InPersonRecording_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "consentType" "ConsentType" NOT NULL,
    "status" "ConsentStatus" NOT NULL DEFAULT 'PENDING',
    "grantedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "method" "ConsentCollectionMethod",
    "callId" TEXT,
    "revokedById" TEXT,
    "retentionUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StateConsentRule" (
    "id" TEXT NOT NULL,
    "stateCode" TEXT NOT NULL,
    "stateName" TEXT NOT NULL,
    "consentType" "StateConsentType" NOT NULL,
    "requiresExplicitOptIn" BOOLEAN NOT NULL DEFAULT true,
    "silenceImpliesConsent" BOOLEAN NOT NULL DEFAULT false,
    "minorAgeThreshold" INTEGER NOT NULL DEFAULT 18,
    "additionalRules" JSONB,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "lastReviewedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StateConsentRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InteractionMetadata" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "caseManagerId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "interactionType" "InteractionType" NOT NULL DEFAULT 'VOIP_CALL',
    "direction" "CallDirection" NOT NULL DEFAULT 'OUTBOUND',
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "reason" "UnrecordedReason" NOT NULL,
    "callId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InteractionMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientActivity" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorRole" "UserRole" NOT NULL,
    "activityType" "ActivityType" NOT NULL,
    "summary" TEXT NOT NULL,
    "rawData" JSONB NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramMember" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ProgramMemberRole" NOT NULL DEFAULT 'CASE_MANAGER',
    "canEditEnrollments" BOOLEAN NOT NULL DEFAULT false,
    "canEditAttendance" BOOLEAN NOT NULL DEFAULT true,
    "canViewAllClients" BOOLEAN NOT NULL DEFAULT false,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SettingsDelegation" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "canManageBilling" BOOLEAN NOT NULL DEFAULT false,
    "canManageTeam" BOOLEAN NOT NULL DEFAULT false,
    "canManageIntegrations" BOOLEAN NOT NULL DEFAULT false,
    "canManageBranding" BOOLEAN NOT NULL DEFAULT false,
    "delegatedBy" TEXT NOT NULL,
    "delegatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SettingsDelegation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermissionDenialLog" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resourceId" TEXT,
    "reason" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PermissionDenialLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "type" "ConversationType" NOT NULL,
    "title" TEXT,
    "status" "ConversationStatus" NOT NULL DEFAULT 'RECORDING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "recordingUrl" TEXT,
    "recordingRetention" TIMESTAMP(3),
    "isRecorded" BOOLEAN NOT NULL DEFAULT true,
    "consentStatus" TEXT,
    "consentGrantedAt" TIMESTAMP(3),
    "consentMethod" "ConsentCollectionMethod",
    "transcriptRaw" TEXT,
    "transcriptJson" JSONB,
    "aiSummary" JSONB,
    "extractedFields" JSONB,
    "confidenceScores" JSONB,
    "formIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "aiProcessingStatus" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "aiProcessingError" TEXT,
    "aiProcessingRetries" INTEGER NOT NULL DEFAULT 0,
    "sensitivityTier" "SensitivityTier" NOT NULL DEFAULT 'STANDARD',
    "redactedSegments" JSONB,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "legacyCallId" TEXT,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhoneCallDetails" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "twilioCallSid" TEXT,
    "direction" "CallDirection" NOT NULL DEFAULT 'OUTBOUND',
    "clientId" TEXT,
    "caseManagerId" TEXT,

    CONSTRAINT "PhoneCallDetails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InPersonDetails" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "participants" JSONB,
    "clientIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "location" TEXT,
    "deviceInfo" JSONB,
    "offlineUploadAt" TIMESTAMP(3),

    CONSTRAINT "InPersonDetails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoMeetingDetails" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "platform" "VideoPlatform" NOT NULL,
    "externalMeetingId" TEXT,
    "meetingUrl" TEXT,
    "participants" JSONB,
    "clientIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "botId" TEXT,
    "botStatus" TEXT,
    "botJoinedAt" TIMESTAMP(3),
    "botLeftAt" TIMESTAMP(3),
    "recordingUrl" TEXT,

    CONSTRAINT "VideoMeetingDetails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlaggedSegment" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "startTime" DOUBLE PRECISION NOT NULL,
    "endTime" DOUBLE PRECISION NOT NULL,
    "text" TEXT NOT NULL,
    "category" "SensitivityCategory" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "suggestedTier" "SensitivityTier" NOT NULL,
    "status" "FlagReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "finalTier" "SensitivityTier",
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlaggedSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SensitivityDecision" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "segmentText" TEXT NOT NULL,
    "predictedCategory" "SensitivityCategory" NOT NULL,
    "predictedTier" "SensitivityTier" NOT NULL,
    "actualTier" "SensitivityTier" NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "isLocalModel" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SensitivityDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationAccess" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grantedById" TEXT,
    "accessType" "ConversationAccessType" NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ConversationAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DraftedOutput" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "outputType" "WorkflowOutputType" NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "sourceSnippet" TEXT,
    "destinationPlatform" "IntegrationPlatform",
    "destinationConfig" JSONB,
    "status" "DraftStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "editedContent" TEXT,
    "pushedAt" TIMESTAMP(3),
    "externalId" TEXT,
    "pushError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DraftedOutput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationObjectiveLink" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "objectiveId" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "status" "ConversationLinkStatus" NOT NULL DEFAULT 'SUGGESTED',
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "delaySignalType" TEXT,
    "delayDays" INTEGER,
    "impactNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationObjectiveLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationClient" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationConnection" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "platform" "IntegrationPlatform" NOT NULL,
    "name" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "config" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "connectedById" TEXT NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_stripeCustomerId_key" ON "Organization"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "Organization_slug_idx" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_stripeCustomerId_idx" ON "Organization"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_supabaseUserId_key" ON "User"("supabaseUserId");

-- CreateIndex
CREATE INDEX "User_orgId_idx" ON "User"("orgId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_supabaseUserId_idx" ON "User"("supabaseUserId");

-- CreateIndex
CREATE UNIQUE INDEX "CaseManagerProfile_userId_key" ON "CaseManagerProfile"("userId");

-- CreateIndex
CREATE INDEX "CaseManagerProfile_userId_idx" ON "CaseManagerProfile"("userId");

-- CreateIndex
CREATE INDEX "CaseManagerProfile_availabilityStatus_idx" ON "CaseManagerProfile"("availabilityStatus");

-- CreateIndex
CREATE UNIQUE INDEX "ClientMatchPreference_clientId_key" ON "ClientMatchPreference"("clientId");

-- CreateIndex
CREATE INDEX "ClientMatchPreference_clientId_idx" ON "ClientMatchPreference"("clientId");

-- CreateIndex
CREATE INDEX "PasswordHistory_userId_createdAt_idx" ON "PasswordHistory"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Team_orgId_idx" ON "Team"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_orgId_name_key" ON "Team"("orgId", "name");

-- CreateIndex
CREATE INDEX "TeamMember_teamId_idx" ON "TeamMember"("teamId");

-- CreateIndex
CREATE INDEX "TeamMember_userId_idx" ON "TeamMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_teamId_userId_key" ON "TeamMember"("teamId", "userId");

-- CreateIndex
CREATE INDEX "Form_orgId_status_idx" ON "Form"("orgId", "status");

-- CreateIndex
CREATE INDEX "Form_createdById_idx" ON "Form"("createdById");

-- CreateIndex
CREATE INDEX "Form_status_idx" ON "Form"("status");

-- CreateIndex
CREATE INDEX "Form_orgId_fieldFingerprint_idx" ON "Form"("orgId", "fieldFingerprint");

-- CreateIndex
CREATE INDEX "FormField_formId_order_idx" ON "FormField"("formId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "FormField_formId_slug_key" ON "FormField"("formId", "slug");

-- CreateIndex
CREATE INDEX "FormVersion_formId_idx" ON "FormVersion"("formId");

-- CreateIndex
CREATE UNIQUE INDEX "FormVersion_formId_version_key" ON "FormVersion"("formId", "version");

-- CreateIndex
CREATE INDEX "FormAccess_formId_idx" ON "FormAccess"("formId");

-- CreateIndex
CREATE INDEX "FormAccess_granteeId_idx" ON "FormAccess"("granteeId");

-- CreateIndex
CREATE UNIQUE INDEX "FormAccess_formId_granteeType_granteeId_key" ON "FormAccess"("formId", "granteeType", "granteeId");

-- CreateIndex
CREATE INDEX "ExtractionExample_fieldId_idx" ON "ExtractionExample"("fieldId");

-- CreateIndex
CREATE INDEX "FormTemplate_isSystemTemplate_idx" ON "FormTemplate"("isSystemTemplate");

-- CreateIndex
CREATE INDEX "FormTemplate_orgId_idx" ON "FormTemplate"("orgId");

-- CreateIndex
CREATE INDEX "FormSubmission_formId_idx" ON "FormSubmission"("formId");

-- CreateIndex
CREATE INDEX "FormSubmission_formVersionId_idx" ON "FormSubmission"("formVersionId");

-- CreateIndex
CREATE INDEX "FormSubmission_clientId_idx" ON "FormSubmission"("clientId");

-- CreateIndex
CREATE INDEX "FormSubmission_callId_idx" ON "FormSubmission"("callId");

-- CreateIndex
CREATE INDEX "Signature_submissionId_idx" ON "Signature"("submissionId");

-- CreateIndex
CREATE INDEX "FileUpload_orgId_idx" ON "FileUpload"("orgId");

-- CreateIndex
CREATE INDEX "FileUpload_scanStatus_idx" ON "FileUpload"("scanStatus");

-- CreateIndex
CREATE INDEX "AuditLog_orgId_timestamp_idx" ON "AuditLog"("orgId", "timestamp");

-- CreateIndex
CREATE INDEX "AuditLog_resource_resourceId_idx" ON "AuditLog"("resource", "resourceId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "ComplianceReport_orgId_reportType_idx" ON "ComplianceReport"("orgId", "reportType");

-- CreateIndex
CREATE INDEX "ComplianceReport_orgId_generatedAt_idx" ON "ComplianceReport"("orgId", "generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "Subscription_orgId_idx" ON "Subscription"("orgId");

-- CreateIndex
CREATE INDEX "Subscription_stripeCustomerId_idx" ON "Subscription"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentHistory_stripePaymentId_key" ON "PaymentHistory"("stripePaymentId");

-- CreateIndex
CREATE INDEX "PaymentHistory_orgId_idx" ON "PaymentHistory"("orgId");

-- CreateIndex
CREATE INDEX "PaymentHistory_createdAt_idx" ON "PaymentHistory"("createdAt");

-- CreateIndex
CREATE INDEX "Client_orgId_status_idx" ON "Client"("orgId", "status");

-- CreateIndex
CREATE INDEX "Client_orgId_phone_idx" ON "Client"("orgId", "phone");

-- CreateIndex
CREATE INDEX "Client_assignedTo_idx" ON "Client"("assignedTo");

-- CreateIndex
CREATE INDEX "ClientShare_clientId_idx" ON "ClientShare"("clientId");

-- CreateIndex
CREATE INDEX "ClientShare_sharedWithUserId_idx" ON "ClientShare"("sharedWithUserId");

-- CreateIndex
CREATE INDEX "ClientShare_orgId_idx" ON "ClientShare"("orgId");

-- CreateIndex
CREATE INDEX "ClientShare_expiresAt_idx" ON "ClientShare"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClientShare_clientId_sharedWithUserId_key" ON "ClientShare"("clientId", "sharedWithUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Call_twilioCallSid_key" ON "Call"("twilioCallSid");

-- CreateIndex
CREATE INDEX "Call_clientId_idx" ON "Call"("clientId");

-- CreateIndex
CREATE INDEX "Call_caseManagerId_idx" ON "Call"("caseManagerId");

-- CreateIndex
CREATE INDEX "Call_status_idx" ON "Call"("status");

-- CreateIndex
CREATE INDEX "Call_aiProcessingStatus_idx" ON "Call"("aiProcessingStatus");

-- CreateIndex
CREATE INDEX "Note_clientId_idx" ON "Note"("clientId");

-- CreateIndex
CREATE INDEX "Note_callId_idx" ON "Note"("callId");

-- CreateIndex
CREATE INDEX "Note_sessionId_idx" ON "Note"("sessionId");

-- CreateIndex
CREATE INDEX "Note_authorId_idx" ON "Note"("authorId");

-- CreateIndex
CREATE INDEX "Note_orgId_status_idx" ON "Note"("orgId", "status");

-- CreateIndex
CREATE INDEX "Note_orgId_createdAt_idx" ON "Note"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "NoteVersion_noteId_idx" ON "NoteVersion"("noteId");

-- CreateIndex
CREATE INDEX "NoteVersion_editedById_idx" ON "NoteVersion"("editedById");

-- CreateIndex
CREATE INDEX "NoteMention_mentionedUserId_idx" ON "NoteMention"("mentionedUserId");

-- CreateIndex
CREATE UNIQUE INDEX "NoteMention_noteId_mentionedUserId_key" ON "NoteMention"("noteId", "mentionedUserId");

-- CreateIndex
CREATE INDEX "NoteTag_orgId_idx" ON "NoteTag"("orgId");

-- CreateIndex
CREATE INDEX "NoteTag_programId_idx" ON "NoteTag"("programId");

-- CreateIndex
CREATE UNIQUE INDEX "NoteTag_orgId_programId_name_key" ON "NoteTag"("orgId", "programId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "TwilioNumber_userId_key" ON "TwilioNumber"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TwilioNumber_phoneNumber_key" ON "TwilioNumber"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "TwilioNumber_twilioSid_key" ON "TwilioNumber"("twilioSid");

-- CreateIndex
CREATE UNIQUE INDEX "PhoneNumberPool_phoneNumber_key" ON "PhoneNumberPool"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PhoneNumberPool_twilioSid_key" ON "PhoneNumberPool"("twilioSid");

-- CreateIndex
CREATE INDEX "PhoneNumberPool_orgId_idx" ON "PhoneNumberPool"("orgId");

-- CreateIndex
CREATE INDEX "PhoneNumberRequest_orgId_status_idx" ON "PhoneNumberRequest"("orgId", "status");

-- CreateIndex
CREATE INDEX "PhoneNumberRequest_userId_idx" ON "PhoneNumberRequest"("userId");

-- CreateIndex
CREATE INDEX "FormEditLog_submissionId_idx" ON "FormEditLog"("submissionId");

-- CreateIndex
CREATE INDEX "FormEditLog_editedBy_idx" ON "FormEditLog"("editedBy");

-- CreateIndex
CREATE INDEX "ResourceLock_expiresAt_idx" ON "ResourceLock"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceLock_resourceType_resourceId_key" ON "ResourceLock"("resourceType", "resourceId");

-- CreateIndex
CREATE UNIQUE INDEX "UserInvitation_token_key" ON "UserInvitation"("token");

-- CreateIndex
CREATE INDEX "UserInvitation_orgId_idx" ON "UserInvitation"("orgId");

-- CreateIndex
CREATE INDEX "UserInvitation_token_idx" ON "UserInvitation"("token");

-- CreateIndex
CREATE INDEX "UserInvitation_email_orgId_idx" ON "UserInvitation"("email", "orgId");

-- CreateIndex
CREATE INDEX "UserInvitation_status_idx" ON "UserInvitation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Waitlist_email_key" ON "Waitlist"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Waitlist_approvalToken_key" ON "Waitlist"("approvalToken");

-- CreateIndex
CREATE INDEX "Waitlist_status_idx" ON "Waitlist"("status");

-- CreateIndex
CREATE INDEX "Waitlist_submittedAt_idx" ON "Waitlist"("submittedAt");

-- CreateIndex
CREATE INDEX "Waitlist_email_idx" ON "Waitlist"("email");

-- CreateIndex
CREATE INDEX "Waitlist_approvalToken_idx" ON "Waitlist"("approvalToken");

-- CreateIndex
CREATE INDEX "Program_orgId_status_idx" ON "Program"("orgId", "status");

-- CreateIndex
CREATE INDEX "Program_facilitatorId_idx" ON "Program"("facilitatorId");

-- CreateIndex
CREATE INDEX "Program_createdById_idx" ON "Program"("createdById");

-- CreateIndex
CREATE INDEX "ProgramSession_programId_idx" ON "ProgramSession"("programId");

-- CreateIndex
CREATE INDEX "ProgramSession_date_idx" ON "ProgramSession"("date");

-- CreateIndex
CREATE INDEX "ProgramSession_status_idx" ON "ProgramSession"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramSession_programId_sessionNumber_key" ON "ProgramSession"("programId", "sessionNumber");

-- CreateIndex
CREATE INDEX "SessionStatusHistory_sessionId_idx" ON "SessionStatusHistory"("sessionId");

-- CreateIndex
CREATE INDEX "SessionStatusHistory_changedAt_idx" ON "SessionStatusHistory"("changedAt");

-- CreateIndex
CREATE INDEX "SessionStatusHistory_changedById_idx" ON "SessionStatusHistory"("changedById");

-- CreateIndex
CREATE INDEX "ProgramEnrollment_programId_status_idx" ON "ProgramEnrollment"("programId", "status");

-- CreateIndex
CREATE INDEX "ProgramEnrollment_clientId_idx" ON "ProgramEnrollment"("clientId");

-- CreateIndex
CREATE INDEX "ProgramEnrollment_enrolledById_idx" ON "ProgramEnrollment"("enrolledById");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramEnrollment_programId_clientId_key" ON "ProgramEnrollment"("programId", "clientId");

-- CreateIndex
CREATE INDEX "SessionAttendance_sessionId_idx" ON "SessionAttendance"("sessionId");

-- CreateIndex
CREATE INDEX "SessionAttendance_enrollmentId_idx" ON "SessionAttendance"("enrollmentId");

-- CreateIndex
CREATE INDEX "SessionAttendance_uploadSourceId_idx" ON "SessionAttendance"("uploadSourceId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionAttendance_sessionId_enrollmentId_key" ON "SessionAttendance"("sessionId", "enrollmentId");

-- CreateIndex
CREATE INDEX "ProgramMaterial_programId_idx" ON "ProgramMaterial"("programId");

-- CreateIndex
CREATE INDEX "ProgramMaterial_sessionId_idx" ON "ProgramMaterial"("sessionId");

-- CreateIndex
CREATE INDEX "ProgramMaterial_materialType_idx" ON "ProgramMaterial"("materialType");

-- CreateIndex
CREATE INDEX "ProgramMaterial_extractionStatus_idx" ON "ProgramMaterial"("extractionStatus");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceSheetConfig_programId_key" ON "AttendanceSheetConfig"("programId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceCode_enrollmentId_key" ON "AttendanceCode"("enrollmentId");

-- CreateIndex
CREATE INDEX "AttendanceCode_code_idx" ON "AttendanceCode"("code");

-- CreateIndex
CREATE INDEX "AttendanceUpload_sessionId_idx" ON "AttendanceUpload"("sessionId");

-- CreateIndex
CREATE INDEX "AttendanceUpload_orgId_status_idx" ON "AttendanceUpload"("orgId", "status");

-- CreateIndex
CREATE INDEX "AttendanceUpload_uploadedById_idx" ON "AttendanceUpload"("uploadedById");

-- CreateIndex
CREATE INDEX "AttendanceUpload_status_idx" ON "AttendanceUpload"("status");

-- CreateIndex
CREATE INDEX "AttendanceExtractedRecord_uploadId_idx" ON "AttendanceExtractedRecord"("uploadId");

-- CreateIndex
CREATE INDEX "AttendanceExtractedRecord_enrollmentId_idx" ON "AttendanceExtractedRecord"("enrollmentId");

-- CreateIndex
CREATE INDEX "AttendanceUploadRateLimit_windowStart_idx" ON "AttendanceUploadRateLimit"("windowStart");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceUploadRateLimit_userId_sessionId_key" ON "AttendanceUploadRateLimit"("userId", "sessionId");

-- CreateIndex
CREATE INDEX "Message_clientId_sentAt_idx" ON "Message"("clientId", "sentAt");

-- CreateIndex
CREATE INDEX "Message_orgId_clientId_idx" ON "Message"("orgId", "clientId");

-- CreateIndex
CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");

-- CreateIndex
CREATE INDEX "Message_status_idx" ON "Message"("status");

-- CreateIndex
CREATE INDEX "MessageAttachment_messageId_idx" ON "MessageAttachment"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "SmsNotification_messageId_key" ON "SmsNotification"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "SmsNotification_twilioSid_key" ON "SmsNotification"("twilioSid");

-- CreateIndex
CREATE INDEX "SmsNotification_twilioSid_idx" ON "SmsNotification"("twilioSid");

-- CreateIndex
CREATE INDEX "SmsNotification_deliveryStatus_idx" ON "SmsNotification"("deliveryStatus");

-- CreateIndex
CREATE UNIQUE INDEX "SmsPreference_clientId_key" ON "SmsPreference"("clientId");

-- CreateIndex
CREATE INDEX "SmsPreference_clientId_idx" ON "SmsPreference"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailLog_sesMessageId_key" ON "EmailLog"("sesMessageId");

-- CreateIndex
CREATE INDEX "EmailLog_organizationId_status_idx" ON "EmailLog"("organizationId", "status");

-- CreateIndex
CREATE INDEX "EmailLog_organizationId_createdAt_idx" ON "EmailLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "EmailLog_sesMessageId_idx" ON "EmailLog"("sesMessageId");

-- CreateIndex
CREATE INDEX "EmailLog_clientId_idx" ON "EmailLog"("clientId");

-- CreateIndex
CREATE INDEX "EmailLog_status_nextRetryAt_idx" ON "EmailLog"("status", "nextRetryAt");

-- CreateIndex
CREATE UNIQUE INDEX "PortalToken_token_key" ON "PortalToken"("token");

-- CreateIndex
CREATE INDEX "PortalToken_token_idx" ON "PortalToken"("token");

-- CreateIndex
CREATE INDEX "PortalToken_clientId_idx" ON "PortalToken"("clientId");

-- CreateIndex
CREATE INDEX "PortalToken_expiresAt_idx" ON "PortalToken"("expiresAt");

-- CreateIndex
CREATE INDEX "SmsTemplate_orgId_idx" ON "SmsTemplate"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "SmsTemplate_orgId_name_key" ON "SmsTemplate"("orgId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "PortalSession_sessionToken_key" ON "PortalSession"("sessionToken");

-- CreateIndex
CREATE INDEX "PortalSession_sessionToken_idx" ON "PortalSession"("sessionToken");

-- CreateIndex
CREATE INDEX "PortalSession_clientId_idx" ON "PortalSession"("clientId");

-- CreateIndex
CREATE INDEX "PortalSession_expiresAt_idx" ON "PortalSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClientPIN_clientId_key" ON "ClientPIN"("clientId");

-- CreateIndex
CREATE INDEX "PhoneVerification_clientId_idx" ON "PhoneVerification"("clientId");

-- CreateIndex
CREATE INDEX "PhoneVerification_expiresAt_idx" ON "PhoneVerification"("expiresAt");

-- CreateIndex
CREATE INDEX "JobProgress_userId_status_idx" ON "JobProgress"("userId", "status");

-- CreateIndex
CREATE INDEX "JobProgress_orgId_type_idx" ON "JobProgress"("orgId", "type");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "Notification_orgId_createdAt_idx" ON "Notification"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_expiresAt_idx" ON "Notification"("expiresAt");

-- CreateIndex
CREATE INDEX "NoteTemplate_orgId_scope_idx" ON "NoteTemplate"("orgId", "scope");

-- CreateIndex
CREATE INDEX "NoteTemplate_programId_idx" ON "NoteTemplate"("programId");

-- CreateIndex
CREATE INDEX "NoteTemplate_sessionType_idx" ON "NoteTemplate"("sessionType");

-- CreateIndex
CREATE INDEX "FormConversion_orgId_status_idx" ON "FormConversion"("orgId", "status");

-- CreateIndex
CREATE INDEX "FormConversion_createdById_idx" ON "FormConversion"("createdById");

-- CreateIndex
CREATE INDEX "ReportTemplate_orgId_status_idx" ON "ReportTemplate"("orgId", "status");

-- CreateIndex
CREATE INDEX "ReportTemplate_type_idx" ON "ReportTemplate"("type");

-- CreateIndex
CREATE INDEX "Report_orgId_status_idx" ON "Report"("orgId", "status");

-- CreateIndex
CREATE INDEX "Report_templateId_idx" ON "Report"("templateId");

-- CreateIndex
CREATE INDEX "ReportSnapshot_reportId_idx" ON "ReportSnapshot"("reportId");

-- CreateIndex
CREATE INDEX "CustomMetric_orgId_idx" ON "CustomMetric"("orgId");

-- CreateIndex
CREATE INDEX "FunderDocumentLibrary_funderName_idx" ON "FunderDocumentLibrary"("funderName");

-- CreateIndex
CREATE INDEX "ExportTemplate_orgId_status_idx" ON "ExportTemplate"("orgId", "status");

-- CreateIndex
CREATE INDEX "ExportTemplate_exportType_idx" ON "ExportTemplate"("exportType");

-- CreateIndex
CREATE INDEX "FunderExport_orgId_status_idx" ON "FunderExport"("orgId", "status");

-- CreateIndex
CREATE INDEX "FunderExport_templateId_idx" ON "FunderExport"("templateId");

-- CreateIndex
CREATE INDEX "ImportTemplate_orgId_isActive_idx" ON "ImportTemplate"("orgId", "isActive");

-- CreateIndex
CREATE INDEX "ImportBatch_orgId_status_idx" ON "ImportBatch"("orgId", "status");

-- CreateIndex
CREATE INDEX "ImportBatch_templateId_idx" ON "ImportBatch"("templateId");

-- CreateIndex
CREATE INDEX "ImportRecord_batchId_status_idx" ON "ImportRecord"("batchId", "status");

-- CreateIndex
CREATE INDEX "ImportRecord_createdClientId_idx" ON "ImportRecord"("createdClientId");

-- CreateIndex
CREATE INDEX "ImportRecord_updatedClientId_idx" ON "ImportRecord"("updatedClientId");

-- CreateIndex
CREATE INDEX "Location_orgId_type_idx" ON "Location"("orgId", "type");

-- CreateIndex
CREATE INDEX "Location_parentId_idx" ON "Location"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Location_orgId_code_key" ON "Location"("orgId", "code");

-- CreateIndex
CREATE INDEX "UserLocation_userId_idx" ON "UserLocation"("userId");

-- CreateIndex
CREATE INDEX "UserLocation_locationId_idx" ON "UserLocation"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "UserLocation_userId_locationId_key" ON "UserLocation"("userId", "locationId");

-- CreateIndex
CREATE INDEX "Meeting_orgId_status_idx" ON "Meeting"("orgId", "status");

-- CreateIndex
CREATE INDEX "Meeting_orgId_scheduledStartAt_idx" ON "Meeting"("orgId", "scheduledStartAt");

-- CreateIndex
CREATE INDEX "Meeting_locationId_idx" ON "Meeting"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingTranscript_meetingId_key" ON "MeetingTranscript"("meetingId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingSummary_meetingId_key" ON "MeetingSummary"("meetingId");

-- CreateIndex
CREATE INDEX "MeetingActionItem_meetingId_idx" ON "MeetingActionItem"("meetingId");

-- CreateIndex
CREATE INDEX "MeetingActionItem_assigneeUserId_status_idx" ON "MeetingActionItem"("assigneeUserId", "status");

-- CreateIndex
CREATE INDEX "MeetingActionItem_status_idx" ON "MeetingActionItem"("status");

-- CreateIndex
CREATE INDEX "MeetingQuestion_meetingId_idx" ON "MeetingQuestion"("meetingId");

-- CreateIndex
CREATE INDEX "MeetingQuestion_isAnswered_idx" ON "MeetingQuestion"("isAnswered");

-- CreateIndex
CREATE INDEX "KnowledgeEntry_orgId_source_idx" ON "KnowledgeEntry"("orgId", "source");

-- CreateIndex
CREATE INDEX "KnowledgeEntry_orgId_category_idx" ON "KnowledgeEntry"("orgId", "category");

-- CreateIndex
CREATE INDEX "KnowledgeEntry_createdById_idx" ON "KnowledgeEntry"("createdById");

-- CreateIndex
CREATE INDEX "KnowledgeEntry_meetingId_idx" ON "KnowledgeEntry"("meetingId");

-- CreateIndex
CREATE INDEX "KnowledgeEntry_tags_idx" ON "KnowledgeEntry"("tags");

-- CreateIndex
CREATE INDEX "MeetingIntegration_orgId_status_idx" ON "MeetingIntegration"("orgId", "status");

-- CreateIndex
CREATE INDEX "MeetingIntegration_platform_idx" ON "MeetingIntegration"("platform");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingIntegration_orgId_platform_key" ON "MeetingIntegration"("orgId", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarIntegration_userId_key" ON "CalendarIntegration"("userId");

-- CreateIndex
CREATE INDEX "CalendarIntegration_orgId_idx" ON "CalendarIntegration"("orgId");

-- CreateIndex
CREATE INDEX "CalendarIntegration_userId_status_idx" ON "CalendarIntegration"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarEvent_pendingSchedulingItemId_key" ON "CalendarEvent"("pendingSchedulingItemId");

-- CreateIndex
CREATE INDEX "CalendarEvent_userId_idx" ON "CalendarEvent"("userId");

-- CreateIndex
CREATE INDEX "CalendarEvent_orgId_idx" ON "CalendarEvent"("orgId");

-- CreateIndex
CREATE INDEX "CalendarEvent_externalEventId_provider_idx" ON "CalendarEvent"("externalEventId", "provider");

-- CreateIndex
CREATE INDEX "CalendarEvent_callId_idx" ON "CalendarEvent"("callId");

-- CreateIndex
CREATE INDEX "PendingSchedulingItem_userId_status_idx" ON "PendingSchedulingItem"("userId", "status");

-- CreateIndex
CREATE INDEX "PendingSchedulingItem_callId_idx" ON "PendingSchedulingItem"("callId");

-- CreateIndex
CREATE INDEX "PendingSchedulingItem_orgId_idx" ON "PendingSchedulingItem"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationToken_meetingIntegrationId_key" ON "IntegrationToken"("meetingIntegrationId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationToken_calendarIntegrationId_key" ON "IntegrationToken"("calendarIntegrationId");

-- CreateIndex
CREATE INDEX "IntegrationToken_type_idx" ON "IntegrationToken"("type");

-- CreateIndex
CREATE INDEX "IntegrationToken_expiresAt_idx" ON "IntegrationToken"("expiresAt");

-- CreateIndex
CREATE INDEX "IntegrationToken_type_expiresAt_idx" ON "IntegrationToken"("type", "expiresAt");

-- CreateIndex
CREATE INDEX "EncryptionKey_organizationId_isActive_idx" ON "EncryptionKey"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "EncryptionKey_organizationId_keyVersion_idx" ON "EncryptionKey"("organizationId", "keyVersion");

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_token_key" ON "UserSession"("token");

-- CreateIndex
CREATE INDEX "UserSession_userId_isActive_idx" ON "UserSession"("userId", "isActive");

-- CreateIndex
CREATE INDEX "UserSession_token_idx" ON "UserSession"("token");

-- CreateIndex
CREATE INDEX "UserSession_expiresAt_idx" ON "UserSession"("expiresAt");

-- CreateIndex
CREATE INDEX "UserSession_userId_lastActivity_idx" ON "UserSession"("userId", "lastActivity");

-- CreateIndex
CREATE UNIQUE INDEX "TrustedDevice_tokenHash_key" ON "TrustedDevice"("tokenHash");

-- CreateIndex
CREATE INDEX "TrustedDevice_userId_expiresAt_idx" ON "TrustedDevice"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "TrustedDevice_tokenHash_idx" ON "TrustedDevice"("tokenHash");

-- CreateIndex
CREATE INDEX "Grant_orgId_status_idx" ON "Grant"("orgId", "status");

-- CreateIndex
CREATE INDEX "Grant_endDate_idx" ON "Grant"("endDate");

-- CreateIndex
CREATE INDEX "GrantDeliverable_grantId_idx" ON "GrantDeliverable"("grantId");

-- CreateIndex
CREATE INDEX "GrantDeliverable_status_idx" ON "GrantDeliverable"("status");

-- CreateIndex
CREATE INDEX "GrantDeliverable_metricType_idx" ON "GrantDeliverable"("metricType");

-- CreateIndex
CREATE INDEX "GrantProgramLink_grantId_idx" ON "GrantProgramLink"("grantId");

-- CreateIndex
CREATE INDEX "GrantProgramLink_programId_idx" ON "GrantProgramLink"("programId");

-- CreateIndex
CREATE UNIQUE INDEX "GrantProgramLink_grantId_programId_key" ON "GrantProgramLink"("grantId", "programId");

-- CreateIndex
CREATE INDEX "DeliverableProgress_deliverableId_recordedAt_idx" ON "DeliverableProgress"("deliverableId", "recordedAt");

-- CreateIndex
CREATE INDEX "DeliverableProgress_sourceType_sourceId_idx" ON "DeliverableProgress"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "GrantReport_grantId_periodEnd_idx" ON "GrantReport"("grantId", "periodEnd");

-- CreateIndex
CREATE INDEX "GrantReport_orgId_idx" ON "GrantReport"("orgId");

-- CreateIndex
CREATE INDEX "WorkflowRule_orgId_isActive_idx" ON "WorkflowRule"("orgId", "isActive");

-- CreateIndex
CREATE INDEX "WorkflowRule_triggerEvent_idx" ON "WorkflowRule"("triggerEvent");

-- CreateIndex
CREATE INDEX "Reminder_orgId_status_idx" ON "Reminder"("orgId", "status");

-- CreateIndex
CREATE INDEX "Reminder_assignedToId_status_idx" ON "Reminder"("assignedToId", "status");

-- CreateIndex
CREATE INDEX "Reminder_clientId_idx" ON "Reminder"("clientId");

-- CreateIndex
CREATE INDEX "Reminder_dueDate_idx" ON "Reminder"("dueDate");

-- CreateIndex
CREATE INDEX "CallActionItem_callId_idx" ON "CallActionItem"("callId");

-- CreateIndex
CREATE INDEX "CallActionItem_orgId_status_idx" ON "CallActionItem"("orgId", "status");

-- CreateIndex
CREATE INDEX "CallActionItem_assigneeUserId_status_idx" ON "CallActionItem"("assigneeUserId", "status");

-- CreateIndex
CREATE INDEX "Objective_orgId_status_idx" ON "Objective"("orgId", "status");

-- CreateIndex
CREATE INDEX "Objective_ownerId_idx" ON "Objective"("ownerId");

-- CreateIndex
CREATE INDEX "Objective_parentId_idx" ON "Objective"("parentId");

-- CreateIndex
CREATE INDEX "Objective_endDate_idx" ON "Objective"("endDate");

-- CreateIndex
CREATE INDEX "KeyResult_objectiveId_idx" ON "KeyResult"("objectiveId");

-- CreateIndex
CREATE INDEX "KeyResult_status_idx" ON "KeyResult"("status");

-- CreateIndex
CREATE INDEX "KeyResultProgress_keyResultId_recordedAt_idx" ON "KeyResultProgress"("keyResultId", "recordedAt");

-- CreateIndex
CREATE INDEX "ObjectiveUpdate_objectiveId_createdAt_idx" ON "ObjectiveUpdate"("objectiveId", "createdAt");

-- CreateIndex
CREATE INDEX "ObjectiveUpdate_createdById_idx" ON "ObjectiveUpdate"("createdById");

-- CreateIndex
CREATE INDEX "Goal_orgId_status_idx" ON "Goal"("orgId", "status");

-- CreateIndex
CREATE INDEX "Goal_orgId_type_idx" ON "Goal"("orgId", "type");

-- CreateIndex
CREATE INDEX "Goal_ownerId_idx" ON "Goal"("ownerId");

-- CreateIndex
CREATE INDEX "Goal_teamId_idx" ON "Goal"("teamId");

-- CreateIndex
CREATE INDEX "Goal_endDate_idx" ON "Goal"("endDate");

-- CreateIndex
CREATE INDEX "Goal_archivedAt_idx" ON "Goal"("archivedAt");

-- CreateIndex
CREATE INDEX "GoalGrant_goalId_idx" ON "GoalGrant"("goalId");

-- CreateIndex
CREATE INDEX "GoalGrant_grantId_idx" ON "GoalGrant"("grantId");

-- CreateIndex
CREATE UNIQUE INDEX "GoalGrant_goalId_grantId_key" ON "GoalGrant"("goalId", "grantId");

-- CreateIndex
CREATE INDEX "GoalObjective_goalId_idx" ON "GoalObjective"("goalId");

-- CreateIndex
CREATE INDEX "GoalObjective_objectiveId_idx" ON "GoalObjective"("objectiveId");

-- CreateIndex
CREATE UNIQUE INDEX "GoalObjective_goalId_objectiveId_key" ON "GoalObjective"("goalId", "objectiveId");

-- CreateIndex
CREATE INDEX "GoalKpi_goalId_idx" ON "GoalKpi"("goalId");

-- CreateIndex
CREATE INDEX "GoalKpi_kpiId_idx" ON "GoalKpi"("kpiId");

-- CreateIndex
CREATE UNIQUE INDEX "GoalKpi_goalId_kpiId_key" ON "GoalKpi"("goalId", "kpiId");

-- CreateIndex
CREATE INDEX "GoalProgramLink_goalId_idx" ON "GoalProgramLink"("goalId");

-- CreateIndex
CREATE INDEX "GoalProgramLink_programId_idx" ON "GoalProgramLink"("programId");

-- CreateIndex
CREATE UNIQUE INDEX "GoalProgramLink_goalId_programId_key" ON "GoalProgramLink"("goalId", "programId");

-- CreateIndex
CREATE INDEX "GoalProgress_goalId_recordedAt_idx" ON "GoalProgress"("goalId", "recordedAt");

-- CreateIndex
CREATE INDEX "GoalUpdate_goalId_createdAt_idx" ON "GoalUpdate"("goalId", "createdAt");

-- CreateIndex
CREATE INDEX "CallGoalDraft_goalId_status_idx" ON "CallGoalDraft"("goalId", "status");

-- CreateIndex
CREATE INDEX "CallGoalDraft_callId_idx" ON "CallGoalDraft"("callId");

-- CreateIndex
CREATE UNIQUE INDEX "CallGoalDraft_callId_goalId_key" ON "CallGoalDraft"("callId", "goalId");

-- CreateIndex
CREATE INDEX "Kpi_orgId_archivedAt_idx" ON "Kpi"("orgId", "archivedAt");

-- CreateIndex
CREATE INDEX "Kpi_parentKpiId_idx" ON "Kpi"("parentKpiId");

-- CreateIndex
CREATE INDEX "Kpi_ownerId_idx" ON "Kpi"("ownerId");

-- CreateIndex
CREATE INDEX "Kpi_teamId_idx" ON "Kpi"("teamId");

-- CreateIndex
CREATE INDEX "Kpi_endDate_idx" ON "Kpi"("endDate");

-- CreateIndex
CREATE INDEX "KpiProgress_kpiId_recordedAt_idx" ON "KpiProgress"("kpiId", "recordedAt");

-- CreateIndex
CREATE INDEX "KpiProgramLink_kpiId_idx" ON "KpiProgramLink"("kpiId");

-- CreateIndex
CREATE INDEX "KpiProgramLink_programId_idx" ON "KpiProgramLink"("programId");

-- CreateIndex
CREATE UNIQUE INDEX "KpiProgramLink_kpiId_programId_key" ON "KpiProgramLink"("kpiId", "programId");

-- CreateIndex
CREATE INDEX "ClientGoal_orgId_clientId_idx" ON "ClientGoal"("orgId", "clientId");

-- CreateIndex
CREATE INDEX "ClientGoal_clientId_status_idx" ON "ClientGoal"("clientId", "status");

-- CreateIndex
CREATE INDEX "ClientGoal_assignedToId_idx" ON "ClientGoal"("assignedToId");

-- CreateIndex
CREATE INDEX "ClientGoal_outcomeType_idx" ON "ClientGoal"("outcomeType");

-- CreateIndex
CREATE INDEX "ClientGoal_deadline_idx" ON "ClientGoal"("deadline");

-- CreateIndex
CREATE INDEX "ClientGoal_archivedAt_idx" ON "ClientGoal"("archivedAt");

-- CreateIndex
CREATE INDEX "ClientGoalProgress_clientGoalId_recordedAt_idx" ON "ClientGoalProgress"("clientGoalId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChatRoom_clientId_key" ON "ChatRoom"("clientId");

-- CreateIndex
CREATE INDEX "ChatRoom_isActive_lastActivityAt_idx" ON "ChatRoom"("isActive", "lastActivityAt");

-- CreateIndex
CREATE INDEX "ChatRoom_organizationId_isActive_idx" ON "ChatRoom"("organizationId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ChatRoom_organizationId_clientId_key" ON "ChatRoom"("organizationId", "clientId");

-- CreateIndex
CREATE INDEX "Quiz_organizationId_isActive_idx" ON "Quiz"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "Quiz_audience_idx" ON "Quiz"("audience");

-- CreateIndex
CREATE INDEX "Quiz_createdById_idx" ON "Quiz"("createdById");

-- CreateIndex
CREATE INDEX "QuizQuestion_quizId_order_idx" ON "QuizQuestion"("quizId", "order");

-- CreateIndex
CREATE INDEX "QuizAttempt_quizId_userId_idx" ON "QuizAttempt"("quizId", "userId");

-- CreateIndex
CREATE INDEX "QuizAttempt_userId_status_idx" ON "QuizAttempt"("userId", "status");

-- CreateIndex
CREATE INDEX "QuizAttempt_startedAt_idx" ON "QuizAttempt"("startedAt");

-- CreateIndex
CREATE INDEX "QuizAnswer_attemptId_idx" ON "QuizAnswer"("attemptId");

-- CreateIndex
CREATE INDEX "QuizAnswer_questionId_idx" ON "QuizAnswer"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "QuizAnswer_attemptId_questionId_key" ON "QuizAnswer"("attemptId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatSession_resumeToken_key" ON "ChatSession"("resumeToken");

-- CreateIndex
CREATE INDEX "ChatSession_organizationId_status_idx" ON "ChatSession"("organizationId", "status");

-- CreateIndex
CREATE INDEX "ChatSession_organizationId_createdAt_idx" ON "ChatSession"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatSession_resumeToken_idx" ON "ChatSession"("resumeToken");

-- CreateIndex
CREATE INDEX "ChatMessage_sessionId_createdAt_idx" ON "ChatMessage"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "JobPlacement_clientId_idx" ON "JobPlacement"("clientId");

-- CreateIndex
CREATE INDEX "JobPlacement_clientId_status_idx" ON "JobPlacement"("clientId", "status");

-- CreateIndex
CREATE INDEX "JobPlacement_startDate_idx" ON "JobPlacement"("startDate");

-- CreateIndex
CREATE INDEX "Credential_clientId_idx" ON "Credential"("clientId");

-- CreateIndex
CREATE INDEX "Credential_expiryDate_status_idx" ON "Credential"("expiryDate", "status");

-- CreateIndex
CREATE INDEX "Credential_status_idx" ON "Credential"("status");

-- CreateIndex
CREATE INDEX "ClientInsurance_clientId_idx" ON "ClientInsurance"("clientId");

-- CreateIndex
CREATE INDEX "ClientInsurance_clientId_isPrimary_idx" ON "ClientInsurance"("clientId", "isPrimary");

-- CreateIndex
CREATE INDEX "ClientInsurance_memberId_payerCode_idx" ON "ClientInsurance"("memberId", "payerCode");

-- CreateIndex
CREATE INDEX "EligibilityCheck_clientId_serviceCode_idx" ON "EligibilityCheck"("clientId", "serviceCode");

-- CreateIndex
CREATE INDEX "EligibilityCheck_expiresAt_idx" ON "EligibilityCheck"("expiresAt");

-- CreateIndex
CREATE INDEX "EligibilityCheck_clientId_checkedAt_idx" ON "EligibilityCheck"("clientId", "checkedAt");

-- CreateIndex
CREATE INDEX "EligibilityCheck_insurancePlanId_idx" ON "EligibilityCheck"("insurancePlanId");

-- CreateIndex
CREATE INDEX "InPersonRecording_organizationId_idx" ON "InPersonRecording"("organizationId");

-- CreateIndex
CREATE INDEX "InPersonRecording_clientId_idx" ON "InPersonRecording"("clientId");

-- CreateIndex
CREATE INDEX "InPersonRecording_userId_idx" ON "InPersonRecording"("userId");

-- CreateIndex
CREATE INDEX "InPersonRecording_processingStatus_idx" ON "InPersonRecording"("processingStatus");

-- CreateIndex
CREATE INDEX "InPersonRecording_createdAt_idx" ON "InPersonRecording"("createdAt");

-- CreateIndex
CREATE INDEX "ConsentRecord_clientId_idx" ON "ConsentRecord"("clientId");

-- CreateIndex
CREATE INDEX "ConsentRecord_status_idx" ON "ConsentRecord"("status");

-- CreateIndex
CREATE INDEX "ConsentRecord_retentionUntil_idx" ON "ConsentRecord"("retentionUntil");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentRecord_clientId_consentType_key" ON "ConsentRecord"("clientId", "consentType");

-- CreateIndex
CREATE UNIQUE INDEX "StateConsentRule_stateCode_key" ON "StateConsentRule"("stateCode");

-- CreateIndex
CREATE INDEX "StateConsentRule_stateCode_idx" ON "StateConsentRule"("stateCode");

-- CreateIndex
CREATE INDEX "InteractionMetadata_clientId_idx" ON "InteractionMetadata"("clientId");

-- CreateIndex
CREATE INDEX "InteractionMetadata_caseManagerId_idx" ON "InteractionMetadata"("caseManagerId");

-- CreateIndex
CREATE INDEX "InteractionMetadata_orgId_startedAt_idx" ON "InteractionMetadata"("orgId", "startedAt");

-- CreateIndex
CREATE INDEX "ClientActivity_clientId_createdAt_idx" ON "ClientActivity"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "ClientActivity_actorId_idx" ON "ClientActivity"("actorId");

-- CreateIndex
CREATE INDEX "ClientActivity_sourceType_sourceId_idx" ON "ClientActivity"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "ClientActivity_activityType_idx" ON "ClientActivity"("activityType");

-- CreateIndex
CREATE INDEX "ProgramMember_programId_idx" ON "ProgramMember"("programId");

-- CreateIndex
CREATE INDEX "ProgramMember_userId_idx" ON "ProgramMember"("userId");

-- CreateIndex
CREATE INDEX "ProgramMember_role_idx" ON "ProgramMember"("role");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramMember_programId_userId_key" ON "ProgramMember"("programId", "userId");

-- CreateIndex
CREATE INDEX "SettingsDelegation_orgId_idx" ON "SettingsDelegation"("orgId");

-- CreateIndex
CREATE INDEX "SettingsDelegation_userId_idx" ON "SettingsDelegation"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SettingsDelegation_orgId_userId_key" ON "SettingsDelegation"("orgId", "userId");

-- CreateIndex
CREATE INDEX "PermissionDenialLog_orgId_userId_idx" ON "PermissionDenialLog"("orgId", "userId");

-- CreateIndex
CREATE INDEX "PermissionDenialLog_orgId_resource_action_idx" ON "PermissionDenialLog"("orgId", "resource", "action");

-- CreateIndex
CREATE INDEX "PermissionDenialLog_createdAt_idx" ON "PermissionDenialLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_legacyCallId_key" ON "Conversation"("legacyCallId");

-- CreateIndex
CREATE INDEX "Conversation_orgId_status_idx" ON "Conversation"("orgId", "status");

-- CreateIndex
CREATE INDEX "Conversation_orgId_type_idx" ON "Conversation"("orgId", "type");

-- CreateIndex
CREATE INDEX "Conversation_createdById_idx" ON "Conversation"("createdById");

-- CreateIndex
CREATE INDEX "Conversation_startedAt_idx" ON "Conversation"("startedAt");

-- CreateIndex
CREATE INDEX "Conversation_sensitivityTier_idx" ON "Conversation"("sensitivityTier");

-- CreateIndex
CREATE INDEX "Conversation_legacyCallId_idx" ON "Conversation"("legacyCallId");

-- CreateIndex
CREATE UNIQUE INDEX "PhoneCallDetails_conversationId_key" ON "PhoneCallDetails"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "PhoneCallDetails_twilioCallSid_key" ON "PhoneCallDetails"("twilioCallSid");

-- CreateIndex
CREATE INDEX "PhoneCallDetails_twilioCallSid_idx" ON "PhoneCallDetails"("twilioCallSid");

-- CreateIndex
CREATE INDEX "PhoneCallDetails_clientId_idx" ON "PhoneCallDetails"("clientId");

-- CreateIndex
CREATE INDEX "PhoneCallDetails_caseManagerId_idx" ON "PhoneCallDetails"("caseManagerId");

-- CreateIndex
CREATE UNIQUE INDEX "InPersonDetails_conversationId_key" ON "InPersonDetails"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "VideoMeetingDetails_conversationId_key" ON "VideoMeetingDetails"("conversationId");

-- CreateIndex
CREATE INDEX "VideoMeetingDetails_platform_idx" ON "VideoMeetingDetails"("platform");

-- CreateIndex
CREATE INDEX "VideoMeetingDetails_externalMeetingId_idx" ON "VideoMeetingDetails"("externalMeetingId");

-- CreateIndex
CREATE INDEX "FlaggedSegment_conversationId_idx" ON "FlaggedSegment"("conversationId");

-- CreateIndex
CREATE INDEX "FlaggedSegment_status_idx" ON "FlaggedSegment"("status");

-- CreateIndex
CREATE INDEX "FlaggedSegment_category_idx" ON "FlaggedSegment"("category");

-- CreateIndex
CREATE INDEX "SensitivityDecision_orgId_idx" ON "SensitivityDecision"("orgId");

-- CreateIndex
CREATE INDEX "SensitivityDecision_predictedCategory_idx" ON "SensitivityDecision"("predictedCategory");

-- CreateIndex
CREATE INDEX "SensitivityDecision_isCorrect_idx" ON "SensitivityDecision"("isCorrect");

-- CreateIndex
CREATE INDEX "ConversationAccess_userId_idx" ON "ConversationAccess"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationAccess_conversationId_userId_key" ON "ConversationAccess"("conversationId", "userId");

-- CreateIndex
CREATE INDEX "DraftedOutput_conversationId_idx" ON "DraftedOutput"("conversationId");

-- CreateIndex
CREATE INDEX "DraftedOutput_outputType_idx" ON "DraftedOutput"("outputType");

-- CreateIndex
CREATE INDEX "DraftedOutput_status_idx" ON "DraftedOutput"("status");

-- CreateIndex
CREATE INDEX "ConversationObjectiveLink_objectiveId_idx" ON "ConversationObjectiveLink"("objectiveId");

-- CreateIndex
CREATE INDEX "ConversationObjectiveLink_status_idx" ON "ConversationObjectiveLink"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationObjectiveLink_conversationId_objectiveId_key" ON "ConversationObjectiveLink"("conversationId", "objectiveId");

-- CreateIndex
CREATE INDEX "ConversationClient_clientId_idx" ON "ConversationClient"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationClient_conversationId_clientId_key" ON "ConversationClient"("conversationId", "clientId");

-- CreateIndex
CREATE INDEX "IntegrationConnection_orgId_platform_idx" ON "IntegrationConnection"("orgId", "platform");

-- CreateIndex
CREATE INDEX "IntegrationConnection_isActive_idx" ON "IntegrationConnection"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationConnection_orgId_platform_name_key" ON "IntegrationConnection"("orgId", "platform", "name");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseManagerProfile" ADD CONSTRAINT "CaseManagerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientMatchPreference" ADD CONSTRAINT "ClientMatchPreference_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordHistory" ADD CONSTRAINT "PasswordHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Form" ADD CONSTRAINT "Form_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Form" ADD CONSTRAINT "Form_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormField" ADD CONSTRAINT "FormField_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormVersion" ADD CONSTRAINT "FormVersion_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormVersion" ADD CONSTRAINT "FormVersion_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormAccess" ADD CONSTRAINT "FormAccess_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormAccess" ADD CONSTRAINT "FormAccess_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormAccess" ADD CONSTRAINT "FormAccess_team_fkey" FOREIGN KEY ("granteeId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractionExample" ADD CONSTRAINT "ExtractionExample_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "FormField"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormTemplate" ADD CONSTRAINT "FormTemplate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_formVersionId_fkey" FOREIGN KEY ("formVersionId") REFERENCES "FormVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signature" ADD CONSTRAINT "Signature_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "FormSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileUpload" ADD CONSTRAINT "FileUpload_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientShare" ADD CONSTRAINT "ClientShare_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientShare" ADD CONSTRAINT "ClientShare_sharedWithUserId_fkey" FOREIGN KEY ("sharedWithUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientShare" ADD CONSTRAINT "ClientShare_sharedByUserId_fkey" FOREIGN KEY ("sharedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_caseManagerId_fkey" FOREIGN KEY ("caseManagerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ProgramSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteVersion" ADD CONSTRAINT "NoteVersion_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteVersion" ADD CONSTRAINT "NoteVersion_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteMention" ADD CONSTRAINT "NoteMention_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteMention" ADD CONSTRAINT "NoteMention_mentionedUserId_fkey" FOREIGN KEY ("mentionedUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteTag" ADD CONSTRAINT "NoteTag_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteTag" ADD CONSTRAINT "NoteTag_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TwilioNumber" ADD CONSTRAINT "TwilioNumber_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhoneNumberPool" ADD CONSTRAINT "PhoneNumberPool_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhoneNumberRequest" ADD CONSTRAINT "PhoneNumberRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhoneNumberRequest" ADD CONSTRAINT "PhoneNumberRequest_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhoneNumberRequest" ADD CONSTRAINT "PhoneNumberRequest_resolvedBy_fkey" FOREIGN KEY ("resolvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormEditLog" ADD CONSTRAINT "FormEditLog_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "FormSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormEditLog" ADD CONSTRAINT "FormEditLog_editedBy_fkey" FOREIGN KEY ("editedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInvitation" ADD CONSTRAINT "UserInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInvitation" ADD CONSTRAINT "UserInvitation_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Waitlist" ADD CONSTRAINT "Waitlist_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_facilitatorId_fkey" FOREIGN KEY ("facilitatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramSession" ADD CONSTRAINT "ProgramSession_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramSession" ADD CONSTRAINT "ProgramSession_rescheduledToId_fkey" FOREIGN KEY ("rescheduledToId") REFERENCES "ProgramSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionStatusHistory" ADD CONSTRAINT "SessionStatusHistory_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ProgramSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionStatusHistory" ADD CONSTRAINT "SessionStatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramEnrollment" ADD CONSTRAINT "ProgramEnrollment_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramEnrollment" ADD CONSTRAINT "ProgramEnrollment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramEnrollment" ADD CONSTRAINT "ProgramEnrollment_enrolledById_fkey" FOREIGN KEY ("enrolledById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionAttendance" ADD CONSTRAINT "SessionAttendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ProgramSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionAttendance" ADD CONSTRAINT "SessionAttendance_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "ProgramEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionAttendance" ADD CONSTRAINT "SessionAttendance_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramMaterial" ADD CONSTRAINT "ProgramMaterial_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramMaterial" ADD CONSTRAINT "ProgramMaterial_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ProgramSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramMaterial" ADD CONSTRAINT "ProgramMaterial_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSheetConfig" ADD CONSTRAINT "AttendanceSheetConfig_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceCode" ADD CONSTRAINT "AttendanceCode_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "ProgramEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceUpload" ADD CONSTRAINT "AttendanceUpload_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ProgramSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceUpload" ADD CONSTRAINT "AttendanceUpload_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceUpload" ADD CONSTRAINT "AttendanceUpload_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceUpload" ADD CONSTRAINT "AttendanceUpload_overrideApprovedById_fkey" FOREIGN KEY ("overrideApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceExtractedRecord" ADD CONSTRAINT "AttendanceExtractedRecord_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "AttendanceUpload"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceExtractedRecord" ADD CONSTRAINT "AttendanceExtractedRecord_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "ProgramEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceExtractedRecord" ADD CONSTRAINT "AttendanceExtractedRecord_manuallyVerifiedById_fkey" FOREIGN KEY ("manuallyVerifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageAttachment" ADD CONSTRAINT "MessageAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsNotification" ADD CONSTRAINT "SmsNotification_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsPreference" ADD CONSTRAINT "SmsPreference_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalToken" ADD CONSTRAINT "PortalToken_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsTemplate" ADD CONSTRAINT "SmsTemplate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalSession" ADD CONSTRAINT "PortalSession_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientPIN" ADD CONSTRAINT "ClientPIN_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhoneVerification" ADD CONSTRAINT "PhoneVerification_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobProgress" ADD CONSTRAINT "JobProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobProgress" ADD CONSTRAINT "JobProgress_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteTemplate" ADD CONSTRAINT "NoteTemplate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteTemplate" ADD CONSTRAINT "NoteTemplate_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteTemplate" ADD CONSTRAINT "NoteTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteTemplate" ADD CONSTRAINT "NoteTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormConversion" ADD CONSTRAINT "FormConversion_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormConversion" ADD CONSTRAINT "FormConversion_resultFormId_fkey" FOREIGN KEY ("resultFormId") REFERENCES "Form"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormConversion" ADD CONSTRAINT "FormConversion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportTemplate" ADD CONSTRAINT "ReportTemplate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportTemplate" ADD CONSTRAINT "ReportTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportTemplate" ADD CONSTRAINT "ReportTemplate_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ReportTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportSnapshot" ADD CONSTRAINT "ReportSnapshot_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomMetric" ADD CONSTRAINT "CustomMetric_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomMetric" ADD CONSTRAINT "CustomMetric_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunderDocumentLibrary" ADD CONSTRAINT "FunderDocumentLibrary_curatedById_fkey" FOREIGN KEY ("curatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportTemplate" ADD CONSTRAINT "ExportTemplate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportTemplate" ADD CONSTRAINT "ExportTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunderExport" ADD CONSTRAINT "FunderExport_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunderExport" ADD CONSTRAINT "FunderExport_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ExportTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunderExport" ADD CONSTRAINT "FunderExport_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportTemplate" ADD CONSTRAINT "ImportTemplate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportTemplate" ADD CONSTRAINT "ImportTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ImportTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRecord" ADD CONSTRAINT "ImportRecord_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRecord" ADD CONSTRAINT "ImportRecord_createdClientId_fkey" FOREIGN KEY ("createdClientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRecord" ADD CONSTRAINT "ImportRecord_updatedClientId_fkey" FOREIGN KEY ("updatedClientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserLocation" ADD CONSTRAINT "UserLocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserLocation" ADD CONSTRAINT "UserLocation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserLocation" ADD CONSTRAINT "UserLocation_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingTranscript" ADD CONSTRAINT "MeetingTranscript_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingSummary" ADD CONSTRAINT "MeetingSummary_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingActionItem" ADD CONSTRAINT "MeetingActionItem_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingActionItem" ADD CONSTRAINT "MeetingActionItem_assigneeUserId_fkey" FOREIGN KEY ("assigneeUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingActionItem" ADD CONSTRAINT "MeetingActionItem_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingQuestion" ADD CONSTRAINT "MeetingQuestion_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingQuestion" ADD CONSTRAINT "MeetingQuestion_askedByUserId_fkey" FOREIGN KEY ("askedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingQuestion" ADD CONSTRAINT "MeetingQuestion_answeredByUserId_fkey" FOREIGN KEY ("answeredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeEntry" ADD CONSTRAINT "KnowledgeEntry_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeEntry" ADD CONSTRAINT "KnowledgeEntry_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeEntry" ADD CONSTRAINT "KnowledgeEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeEntry" ADD CONSTRAINT "KnowledgeEntry_lastUpdatedById_fkey" FOREIGN KEY ("lastUpdatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingIntegration" ADD CONSTRAINT "MeetingIntegration_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarIntegration" ADD CONSTRAINT "CalendarIntegration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarIntegration" ADD CONSTRAINT "CalendarIntegration_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_calendarIntegrationId_fkey" FOREIGN KEY ("calendarIntegrationId") REFERENCES "CalendarIntegration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_pendingSchedulingItemId_fkey" FOREIGN KEY ("pendingSchedulingItemId") REFERENCES "PendingSchedulingItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingSchedulingItem" ADD CONSTRAINT "PendingSchedulingItem_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingSchedulingItem" ADD CONSTRAINT "PendingSchedulingItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingSchedulingItem" ADD CONSTRAINT "PendingSchedulingItem_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingSchedulingItem" ADD CONSTRAINT "PendingSchedulingItem_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationToken" ADD CONSTRAINT "IntegrationToken_meetingIntegrationId_fkey" FOREIGN KEY ("meetingIntegrationId") REFERENCES "MeetingIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationToken" ADD CONSTRAINT "IntegrationToken_calendarIntegrationId_fkey" FOREIGN KEY ("calendarIntegrationId") REFERENCES "CalendarIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustedDevice" ADD CONSTRAINT "TrustedDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grant" ADD CONSTRAINT "Grant_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grant" ADD CONSTRAINT "Grant_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grant" ADD CONSTRAINT "Grant_exportTemplateId_fkey" FOREIGN KEY ("exportTemplateId") REFERENCES "ExportTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrantDeliverable" ADD CONSTRAINT "GrantDeliverable_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "Grant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrantProgramLink" ADD CONSTRAINT "GrantProgramLink_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "Grant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrantProgramLink" ADD CONSTRAINT "GrantProgramLink_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliverableProgress" ADD CONSTRAINT "DeliverableProgress_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "GrantDeliverable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliverableProgress" ADD CONSTRAINT "DeliverableProgress_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrantReport" ADD CONSTRAINT "GrantReport_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "Grant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrantReport" ADD CONSTRAINT "GrantReport_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRule" ADD CONSTRAINT "WorkflowRule_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRule" ADD CONSTRAINT "WorkflowRule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_workflowRuleId_fkey" FOREIGN KEY ("workflowRuleId") REFERENCES "WorkflowRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallActionItem" ADD CONSTRAINT "CallActionItem_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallActionItem" ADD CONSTRAINT "CallActionItem_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallActionItem" ADD CONSTRAINT "CallActionItem_assigneeUserId_fkey" FOREIGN KEY ("assigneeUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallActionItem" ADD CONSTRAINT "CallActionItem_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Objective" ADD CONSTRAINT "Objective_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Objective" ADD CONSTRAINT "Objective_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Objective" ADD CONSTRAINT "Objective_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Objective"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeyResult" ADD CONSTRAINT "KeyResult_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "Objective"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeyResultProgress" ADD CONSTRAINT "KeyResultProgress_keyResultId_fkey" FOREIGN KEY ("keyResultId") REFERENCES "KeyResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeyResultProgress" ADD CONSTRAINT "KeyResultProgress_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObjectiveUpdate" ADD CONSTRAINT "ObjectiveUpdate_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "Objective"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObjectiveUpdate" ADD CONSTRAINT "ObjectiveUpdate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalGrant" ADD CONSTRAINT "GoalGrant_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalGrant" ADD CONSTRAINT "GoalGrant_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "Grant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalObjective" ADD CONSTRAINT "GoalObjective_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalObjective" ADD CONSTRAINT "GoalObjective_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "Objective"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalKpi" ADD CONSTRAINT "GoalKpi_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalKpi" ADD CONSTRAINT "GoalKpi_kpiId_fkey" FOREIGN KEY ("kpiId") REFERENCES "Kpi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalProgramLink" ADD CONSTRAINT "GoalProgramLink_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalProgramLink" ADD CONSTRAINT "GoalProgramLink_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalProgress" ADD CONSTRAINT "GoalProgress_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalProgress" ADD CONSTRAINT "GoalProgress_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalUpdate" ADD CONSTRAINT "GoalUpdate_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalUpdate" ADD CONSTRAINT "GoalUpdate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallGoalDraft" ADD CONSTRAINT "CallGoalDraft_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallGoalDraft" ADD CONSTRAINT "CallGoalDraft_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallGoalDraft" ADD CONSTRAINT "CallGoalDraft_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Kpi" ADD CONSTRAINT "Kpi_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Kpi" ADD CONSTRAINT "Kpi_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Kpi" ADD CONSTRAINT "Kpi_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Kpi" ADD CONSTRAINT "Kpi_parentKpiId_fkey" FOREIGN KEY ("parentKpiId") REFERENCES "Kpi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Kpi" ADD CONSTRAINT "Kpi_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiProgress" ADD CONSTRAINT "KpiProgress_kpiId_fkey" FOREIGN KEY ("kpiId") REFERENCES "Kpi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiProgress" ADD CONSTRAINT "KpiProgress_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiProgramLink" ADD CONSTRAINT "KpiProgramLink_kpiId_fkey" FOREIGN KEY ("kpiId") REFERENCES "Kpi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiProgramLink" ADD CONSTRAINT "KpiProgramLink_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientGoal" ADD CONSTRAINT "ClientGoal_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientGoal" ADD CONSTRAINT "ClientGoal_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientGoal" ADD CONSTRAINT "ClientGoal_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientGoal" ADD CONSTRAINT "ClientGoal_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientGoal" ADD CONSTRAINT "ClientGoal_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientGoalProgress" ADD CONSTRAINT "ClientGoalProgress_clientGoalId_fkey" FOREIGN KEY ("clientGoalId") REFERENCES "ClientGoal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientGoalProgress" ADD CONSTRAINT "ClientGoalProgress_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatRoom" ADD CONSTRAINT "ChatRoom_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatRoom" ADD CONSTRAINT "ChatRoom_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizQuestion" ADD CONSTRAINT "QuizQuestion_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAnswer" ADD CONSTRAINT "QuizAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "QuizAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAnswer" ADD CONSTRAINT "QuizAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuizQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAnswer" ADD CONSTRAINT "QuizAnswer_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_handoffUserId_fkey" FOREIGN KEY ("handoffUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPlacement" ADD CONSTRAINT "JobPlacement_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credential" ADD CONSTRAINT "Credential_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientInsurance" ADD CONSTRAINT "ClientInsurance_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EligibilityCheck" ADD CONSTRAINT "EligibilityCheck_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EligibilityCheck" ADD CONSTRAINT "EligibilityCheck_insurancePlanId_fkey" FOREIGN KEY ("insurancePlanId") REFERENCES "ClientInsurance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InPersonRecording" ADD CONSTRAINT "InPersonRecording_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InPersonRecording" ADD CONSTRAINT "InPersonRecording_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InPersonRecording" ADD CONSTRAINT "InPersonRecording_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InteractionMetadata" ADD CONSTRAINT "InteractionMetadata_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InteractionMetadata" ADD CONSTRAINT "InteractionMetadata_caseManagerId_fkey" FOREIGN KEY ("caseManagerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InteractionMetadata" ADD CONSTRAINT "InteractionMetadata_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientActivity" ADD CONSTRAINT "ClientActivity_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientActivity" ADD CONSTRAINT "ClientActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramMember" ADD CONSTRAINT "ProgramMember_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramMember" ADD CONSTRAINT "ProgramMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramMember" ADD CONSTRAINT "ProgramMember_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettingsDelegation" ADD CONSTRAINT "SettingsDelegation_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettingsDelegation" ADD CONSTRAINT "SettingsDelegation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettingsDelegation" ADD CONSTRAINT "SettingsDelegation_delegatedBy_fkey" FOREIGN KEY ("delegatedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionDenialLog" ADD CONSTRAINT "PermissionDenialLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhoneCallDetails" ADD CONSTRAINT "PhoneCallDetails_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InPersonDetails" ADD CONSTRAINT "InPersonDetails_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoMeetingDetails" ADD CONSTRAINT "VideoMeetingDetails_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlaggedSegment" ADD CONSTRAINT "FlaggedSegment_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlaggedSegment" ADD CONSTRAINT "FlaggedSegment_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationAccess" ADD CONSTRAINT "ConversationAccess_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationAccess" ADD CONSTRAINT "ConversationAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationAccess" ADD CONSTRAINT "ConversationAccess_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftedOutput" ADD CONSTRAINT "DraftedOutput_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftedOutput" ADD CONSTRAINT "DraftedOutput_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationObjectiveLink" ADD CONSTRAINT "ConversationObjectiveLink_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationObjectiveLink" ADD CONSTRAINT "ConversationObjectiveLink_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "Objective"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationObjectiveLink" ADD CONSTRAINT "ConversationObjectiveLink_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationClient" ADD CONSTRAINT "ConversationClient_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationClient" ADD CONSTRAINT "ConversationClient_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_connectedById_fkey" FOREIGN KEY ("connectedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

