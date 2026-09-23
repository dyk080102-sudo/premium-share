-- Family automation enums and tables
CREATE TYPE "FamilyAutomationMode" AS ENUM ('DEMO', 'ASSISTED', 'AUTHORIZED_BROWSER');
CREATE TYPE "FamilyJobType" AS ENUM ('INSPECT', 'LINK_OR_CREATE_GROUP', 'SYNC_SLOTS', 'INVITE', 'CANCEL_INVITE', 'REMOVE_MEMBER', 'VERIFY_MEMBERSHIP', 'VERIFY_REMOVAL');
CREATE TYPE "FamilyJobStatus" AS ENUM ('QUEUED', 'CLAIMED', 'IN_PROGRESS', 'AWAITING_HUMAN', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'EXTERNAL_RESULT_UNKNOWN');
CREATE TYPE "FamilyErrorCode" AS ENUM ('SESSION_EXPIRED', 'HUMAN_ACTION_REQUIRED', 'ACCOUNT_MISMATCH', 'PERMISSION_DENIED', 'POLICY_BLOCKED', 'PLAN_NOT_ACTIVE', 'GROUP_FULL', 'TARGET_AMBIGUOUS', 'INVITE_LIMIT_REACHED', 'UI_CHANGED', 'EXTERNAL_RESULT_UNKNOWN', 'REAL_UI_UNVERIFIED', 'PRECONDITION_FAILED', 'PAUSED', 'EMERGENCY_STOP');
CREATE TYPE "FamilyMemberKind" AS ENUM ('ADMIN', 'MEMBER', 'PENDING_INVITE', 'UNMANAGED');
CREATE TYPE "FamilyExternalStatus" AS ENUM ('OBSERVED', 'INVITED', 'JOINED', 'REMOVAL_PENDING', 'REMOVED', 'UNKNOWN');

CREATE TABLE "family_group_links" (
    "id" TEXT NOT NULL,
    "subscriptionGroupId" TEXT NOT NULL,
    "ownerAccountId" TEXT NOT NULL,
    "externalGroupKey" TEXT,
    "adminEmailObserved" TEXT,
    "planActiveConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "planCheckedAt" TIMESTAMP(3),
    "capacityTotal" INTEGER,
    "adminSeats" INTEGER NOT NULL DEFAULT 1,
    "lastInspectedAt" TIMESTAMP(3),
    "lastInspectStatus" TEXT,
    "lastInspectError" TEXT,
    "linkedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "family_group_links_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "family_group_links_subscriptionGroupId_key" ON "family_group_links"("subscriptionGroupId");
CREATE INDEX "family_group_links_ownerAccountId_idx" ON "family_group_links"("ownerAccountId");

CREATE TABLE "family_external_members" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "kind" "FamilyMemberKind" NOT NULL,
    "externalStatus" "FamilyExternalStatus" NOT NULL DEFAULT 'OBSERVED',
    "allocationId" TEXT,
    "managedByUs" BOOLEAN NOT NULL DEFAULT false,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "family_external_members_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "family_external_members_linkId_email_kind_key" ON "family_external_members"("linkId", "email", "kind");
CREATE INDEX "family_external_members_allocationId_idx" ON "family_external_members"("allocationId");

CREATE TABLE "family_automation_settings" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "mode" "FamilyAutomationMode" NOT NULL DEFAULT 'DEMO',
    "autoInspect" BOOLEAN NOT NULL DEFAULT true,
    "autoCreateGroup" BOOLEAN NOT NULL DEFAULT false,
    "autoInvite" BOOLEAN NOT NULL DEFAULT false,
    "autoRemove" BOOLEAN NOT NULL DEFAULT false,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "authorizedEnabled" BOOLEAN NOT NULL DEFAULT false,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "family_automation_settings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "family_automation_settings_groupId_key" ON "family_automation_settings"("groupId");

CREATE TABLE "family_owner_consents" (
    "id" TEXT NOT NULL,
    "ownerAccountId" TEXT NOT NULL,
    "consentedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consentedBy" TEXT NOT NULL,
    "scopeNote" TEXT NOT NULL,
    "evidenceNote" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "family_owner_consents_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "family_owner_consents_ownerAccountId_isActive_idx" ON "family_owner_consents"("ownerAccountId", "isActive");

CREATE TABLE "family_approvals" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "jobType" "FamilyJobType" NOT NULL,
    "scopeJson" JSONB NOT NULL,
    "approvedBy" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "family_approvals_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "family_approvals_groupId_jobType_idx" ON "family_approvals"("groupId", "jobType");

CREATE TABLE "family_jobs" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "type" "FamilyJobType" NOT NULL,
    "groupId" TEXT NOT NULL,
    "ownerAccountId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "allocationId" TEXT,
    "targetEmail" TEXT,
    "status" "FamilyJobStatus" NOT NULL DEFAULT 'QUEUED',
    "errorCode" "FamilyErrorCode",
    "mode" "FamilyAutomationMode" NOT NULL,
    "approvalId" TEXT,
    "domainVersion" TEXT NOT NULL DEFAULT '1',
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "externalResultJson" JSONB,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "observedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lockedBy" TEXT,
    "lockedAt" TIMESTAMP(3),
    "resultSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "family_jobs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "family_jobs_idempotencyKey_key" ON "family_jobs"("idempotencyKey");
CREATE INDEX "family_jobs_status_requestedAt_idx" ON "family_jobs"("status", "requestedAt");
CREATE INDEX "family_jobs_ownerAccountId_status_idx" ON "family_jobs"("ownerAccountId", "status");
CREATE INDEX "family_jobs_groupId_status_idx" ON "family_jobs"("groupId", "status");

CREATE TABLE "family_browser_profile_meta" (
    "id" TEXT NOT NULL,
    "ownerAccountId" TEXT NOT NULL,
    "profileLabel" TEXT NOT NULL,
    "profilePathHash" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "lastErrorCode" "FamilyErrorCode",
    "isDisposable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "family_browser_profile_meta_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "family_browser_profile_meta_ownerAccountId_key" ON "family_browser_profile_meta"("ownerAccountId");

ALTER TABLE "family_group_links" ADD CONSTRAINT "family_group_links_subscriptionGroupId_fkey" FOREIGN KEY ("subscriptionGroupId") REFERENCES "subscription_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "family_group_links" ADD CONSTRAINT "family_group_links_ownerAccountId_fkey" FOREIGN KEY ("ownerAccountId") REFERENCES "owner_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "family_external_members" ADD CONSTRAINT "family_external_members_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "family_group_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "family_external_members" ADD CONSTRAINT "family_external_members_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "allocations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "family_automation_settings" ADD CONSTRAINT "family_automation_settings_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "subscription_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "family_owner_consents" ADD CONSTRAINT "family_owner_consents_ownerAccountId_fkey" FOREIGN KEY ("ownerAccountId") REFERENCES "owner_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "family_approvals" ADD CONSTRAINT "family_approvals_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "subscription_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "family_jobs" ADD CONSTRAINT "family_jobs_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "subscription_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "family_jobs" ADD CONSTRAINT "family_jobs_ownerAccountId_fkey" FOREIGN KEY ("ownerAccountId") REFERENCES "owner_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "family_jobs" ADD CONSTRAINT "family_jobs_approvalId_fkey" FOREIGN KEY ("approvalId") REFERENCES "family_approvals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
