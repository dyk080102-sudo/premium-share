-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'OPERATOR', 'SUPPORT', 'MEMBER');
CREATE TYPE "AuthTokenType" AS ENUM ('PASSWORD_RESET', 'EMAIL_VERIFY');
CREATE TYPE "PolicyType" AS ENUM ('TERMS', 'PRIVACY', 'REFUND');
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'BLOCKED');
CREATE TYPE "OwnerAccountStatus" AS ENUM ('AVAILABLE', 'UNVERIFIED', 'SUSPENDED');
CREATE TYPE "SupplyPaymentStatus" AS ENUM ('ACTIVE', 'EXPIRING', 'SUSPENDED');
CREATE TYPE "GroupStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');
CREATE TYPE "AllocationStatus" AS ENUM ('RESERVED', 'INVITED', 'ACTIVE', 'PENDING_RECLAIM', 'RECLAIMED');
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED', 'EXPIRED');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'REFUNDED');
CREATE TYPE "BankImportStatus" AS ENUM ('PREVIEW', 'CONFIRMED', 'CANCELLED');
CREATE TYPE "MatchStatus" AS ENUM ('UNMATCHED', 'MATCHED', 'DUPLICATE', 'REVIEW');
CREATE TYPE "SubscriptionStatus" AS ENUM ('WAITING', 'ACTIVE', 'EXPIRING', 'EXPIRED', 'CANCELLED', 'SUSPENDED');
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING_SEND', 'SENT', 'CUSTOMER_ACCEPTED', 'ACTIVATED', 'FAILED', 'EXPIRED', 'PENDING_CANCEL', 'CANCELLED');
CREATE TYPE "TaskType" AS ENUM ('INVITE_SEND', 'INVITE_ACTIVATE', 'SLOT_RECLAIM', 'RENEWAL_REMIND', 'REVIEW_REFUND', 'MANUAL_PAYMENT_CONFIRM');
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE', 'FAILED', 'CANCELLED');
CREATE TYPE "WaitlistStatus" AS ENUM ('WAITING', 'ALLOCATED', 'CANCELLED', 'EXPIRED');
CREATE TYPE "RefundStatus" AS ENUM ('REQUESTED', 'REVIEWING', 'APPROVED', 'PENDING_PAYOUT', 'PAID_OUT', 'REJECTED', 'CANCELLED');
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED', 'CANCELLED');
CREATE TYPE "BusinessSource" AS ENUM ('DEMO', 'MANUAL');

-- CreateTable: users
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'MEMBER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "loginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateTable: sessions
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateTable: auth_tokens
CREATE TABLE "auth_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "AuthTokenType" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "auth_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "auth_tokens_tokenHash_key" ON "auth_tokens"("tokenHash");
CREATE INDEX "auth_tokens_userId_idx" ON "auth_tokens"("userId");

-- CreateTable: policy_versions
CREATE TABLE "policy_versions" (
    "id" TEXT NOT NULL,
    "type" "PolicyType" NOT NULL,
    "version" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    CONSTRAINT "policy_versions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "policy_versions_type_version_key" ON "policy_versions"("type", "version");

-- CreateTable: consents
CREATE TABLE "consents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "policyVersionId" TEXT NOT NULL,
    "consentedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "consents_userId_policyVersionId_key" ON "consents"("userId", "policyVersionId");

-- CreateTable: products
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "serviceType" TEXT NOT NULL,
    "shareMethod" TEXT NOT NULL,
    "countryCodes" JSONB NOT NULL DEFAULT '[]',
    "eligibilityInfo" TEXT,
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "onboardingGuide" TEXT,
    "groupMoveRestriction" BOOLEAN NOT NULL DEFAULT false,
    "maxSlotsPerGroup" INTEGER NOT NULL DEFAULT 5,
    "adminSlotsReserved" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable: plans
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "priceKrw" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "plans_productId_idx" ON "plans"("productId");

-- CreateTable: refund_policies
CREATE TABLE "refund_policies" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rules" JSONB NOT NULL,
    "version" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "refund_policies_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "refund_policies_productId_idx" ON "refund_policies"("productId");

-- CreateTable: owner_accounts
CREATE TABLE "owner_accounts" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "status" "OwnerAccountStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "verifiedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "owner_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: subscription_groups
CREATE TABLE "subscription_groups" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "ownerAccountId" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "totalCapacity" INTEGER NOT NULL,
    "adminSlotsReserved" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "supplyPaymentStatus" "SupplyPaymentStatus" NOT NULL DEFAULT 'ACTIVE',
    "supplyNextRenewalAt" TIMESTAMP(3),
    "status" "GroupStatus" NOT NULL DEFAULT 'ACTIVE',
    "policyVerified" BOOLEAN NOT NULL DEFAULT false,
    "operatorNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "subscription_groups_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "subscription_groups_productId_idx" ON "subscription_groups"("productId");
CREATE INDEX "subscription_groups_ownerAccountId_idx" ON "subscription_groups"("ownerAccountId");

-- CreateTable: slots
CREATE TABLE "slots" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "slotIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "slots_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "slots_groupId_slotIndex_key" ON "slots"("groupId", "slotIndex");
CREATE INDEX "slots_groupId_idx" ON "slots"("groupId");

-- CreateTable: allocations
CREATE TABLE "allocations" (
    "id" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "status" "AllocationStatus" NOT NULL DEFAULT 'RESERVED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3),
    "reclaimedAt" TIMESTAMP(3),
    "reclaimedBy" TEXT,
    "reclaimNotes" TEXT,
    CONSTRAINT "allocations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "allocations_slotId_idx" ON "allocations"("slotId");
CREATE INDEX "allocations_subscriptionId_idx" ON "allocations"("subscriptionId");

-- CreateTable: orders
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productNameSnapshot" TEXT NOT NULL,
    "planNameSnapshot" TEXT NOT NULL,
    "durationDaysSnapshot" INTEGER NOT NULL,
    "priceKrwSnapshot" INTEGER NOT NULL,
    "policyVersionSnapshot" JSONB,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "source" "BusinessSource" NOT NULL DEFAULT 'DEMO',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "orders_idempotencyKey_key" ON "orders"("idempotencyKey");
CREATE INDEX "orders_userId_idx" ON "orders"("userId");
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateTable: payments
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amountKrw" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "source" "BusinessSource" NOT NULL DEFAULT 'DEMO',
    "confirmedAt" TIMESTAMP(3),
    "confirmedBy" TEXT,
    "confirmNotes" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "payments_idempotencyKey_key" ON "payments"("idempotencyKey");
CREATE INDEX "payments_orderId_idx" ON "payments"("orderId");
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateTable: bank_imports
CREATE TABLE "bank_imports" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "status" "BankImportStatus" NOT NULL DEFAULT 'PREVIEW',
    CONSTRAINT "bank_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable: bank_transactions
CREATE TABLE "bank_transactions" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "transactedAt" TIMESTAMP(3) NOT NULL,
    "amountKrw" INTEGER NOT NULL,
    "depositorName" TEXT NOT NULL,
    "memo" TEXT,
    "matchStatus" "MatchStatus" NOT NULL DEFAULT 'UNMATCHED',
    "matchedPaymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bank_transactions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "bank_transactions_externalId_key" ON "bank_transactions"("externalId");
CREATE INDEX "bank_transactions_importId_idx" ON "bank_transactions"("importId");

-- CreateTable: subscriptions
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'WAITING',
    "startedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "subscriptions_userId_idx" ON "subscriptions"("userId");
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");
CREATE INDEX "subscriptions_productId_idx" ON "subscriptions"("productId");

-- CreateTable: subscription_periods
CREATE TABLE "subscription_periods" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "paymentId" TEXT,
    "planId" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "source" "BusinessSource" NOT NULL DEFAULT 'DEMO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "subscription_periods_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "subscription_periods_subscriptionId_idx" ON "subscription_periods"("subscriptionId");

-- CreateTable: invitations
CREATE TABLE "invitations" (
    "id" TEXT NOT NULL,
    "allocationId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "inviteEmail" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING_SEND',
    "sentAt" TIMESTAMP(3),
    "sentBy" TEXT,
    "acceptedReportedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "activatedBy" TEXT,
    "activationNotes" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "invitations_allocationId_idx" ON "invitations"("allocationId");
CREATE INDEX "invitations_subscriptionId_idx" ON "invitations"("subscriptionId");

-- CreateTable: operation_tasks
CREATE TABLE "operation_tasks" (
    "id" TEXT NOT NULL,
    "type" "TaskType" NOT NULL,
    "orderId" TEXT,
    "subscriptionId" TEXT,
    "groupId" TEXT,
    "slotId" TEXT,
    "invitationId" TEXT,
    "allocationId" TEXT,
    "assignedTo" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 5,
    "dueAt" TIMESTAMP(3),
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "resultNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    CONSTRAINT "operation_tasks_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "operation_tasks_status_idx" ON "operation_tasks"("status");
CREATE INDEX "operation_tasks_type_idx" ON "operation_tasks"("type");

-- CreateTable: waitlist_entries
CREATE TABLE "waitlist_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "eligibilityCountry" TEXT,
    "subscriptionId" TEXT,
    "status" "WaitlistStatus" NOT NULL DEFAULT 'WAITING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "waitlist_entries_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "waitlist_entries_productId_status_idx" ON "waitlist_entries"("productId", "status");

-- CreateTable: refunds
CREATE TABLE "refunds" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "paymentId" TEXT,
    "subscriptionId" TEXT,
    "requestedAmountKrw" INTEGER NOT NULL,
    "approvedAmountKrw" INTEGER,
    "status" "RefundStatus" NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT NOT NULL,
    "requestNotes" TEXT,
    "reviewNotes" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "paidBy" TEXT,
    "payoutRef" TEXT,
    "paidNotes" TEXT,
    "source" "BusinessSource" NOT NULL DEFAULT 'DEMO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "refunds_userId_idx" ON "refunds"("userId");
CREATE INDEX "refunds_status_idx" ON "refunds"("status");
CREATE INDEX "refunds_orderId_idx" ON "refunds"("orderId");

-- CreateTable: tickets
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT,
    "subscriptionId" TEXT,
    "title" TEXT NOT NULL,
    "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "assignedTo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "tickets_userId_idx" ON "tickets"("userId");
CREATE INDEX "tickets_status_idx" ON "tickets"("status");

-- CreateTable: ticket_messages
CREATE TABLE "ticket_messages" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ticket_messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ticket_messages_ticketId_idx" ON "ticket_messages"("ticketId");

-- CreateTable: attachments
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "ticketMessageId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable: notifications
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "relatedId" TEXT,
    "relatedType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

-- CreateTable: outbox_messages
CREATE TABLE "outbox_messages" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "recipientUserId" TEXT,
    "recipientContact" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "templateKey" TEXT,
    "variables" JSONB,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "source" "BusinessSource" NOT NULL DEFAULT 'DEMO',
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "outbox_messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "outbox_messages_status_scheduledAt_idx" ON "outbox_messages"("status", "scheduledAt");

-- CreateTable: job_executions
CREATE TABLE "job_executions" (
    "id" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "targetId" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "resultSummary" TEXT,
    "errorMessage" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "job_executions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "job_executions_idempotencyKey_key" ON "job_executions"("idempotencyKey");
CREATE INDEX "job_executions_status_idx" ON "job_executions"("status");
CREATE INDEX "job_executions_jobType_idx" ON "job_executions"("jobType");

-- CreateTable: audit_logs
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" TEXT,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "reason" TEXT,
    "source" "BusinessSource" NOT NULL DEFAULT 'DEMO',
    "requestId" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");
CREATE INDEX "audit_logs_targetType_targetId_idx" ON "audit_logs"("targetType", "targetId");
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateTable: faqs
CREATE TABLE "faqs" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "faqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: announcements
CREATE TABLE "announcements" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable: app_settings
CREATE TABLE "app_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "app_settings_key_key" ON "app_settings"("key");

-- CreateTable: group_expenses
CREATE TABLE "group_expenses" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "amountKrw" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "group_expenses_pkey" PRIMARY KEY ("id")
);

-- AddForeignKeys
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "consents" ADD CONSTRAINT "consents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "consents" ADD CONSTRAINT "consents_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "policy_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "plans" ADD CONSTRAINT "plans_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "refund_policies" ADD CONSTRAINT "refund_policies_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subscription_groups" ADD CONSTRAINT "subscription_groups_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subscription_groups" ADD CONSTRAINT "subscription_groups_ownerAccountId_fkey" FOREIGN KEY ("ownerAccountId") REFERENCES "owner_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "slots" ADD CONSTRAINT "slots_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "subscription_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_importId_fkey" FOREIGN KEY ("importId") REFERENCES "bank_imports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_matchedPaymentId_fkey" FOREIGN KEY ("matchedPaymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subscription_periods" ADD CONSTRAINT "subscription_periods_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subscription_periods" ADD CONSTRAINT "subscription_periods_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subscription_periods" ADD CONSTRAINT "subscription_periods_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "subscription_periods" ADD CONSTRAINT "subscription_periods_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "allocations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "operation_tasks" ADD CONSTRAINT "operation_tasks_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "operation_tasks" ADD CONSTRAINT "operation_tasks_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "operation_tasks" ADD CONSTRAINT "operation_tasks_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "subscription_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "operation_tasks" ADD CONSTRAINT "operation_tasks_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "operation_tasks" ADD CONSTRAINT "operation_tasks_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "invitations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "operation_tasks" ADD CONSTRAINT "operation_tasks_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "allocations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_ticketMessageId_fkey" FOREIGN KEY ("ticketMessageId") REFERENCES "ticket_messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "outbox_messages" ADD CONSTRAINT "outbox_messages_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "group_expenses" ADD CONSTRAINT "group_expenses_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "subscription_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Partial unique indexes
CREATE UNIQUE INDEX "allocation_slot_active_unique" ON "allocations"("slotId") WHERE (status != 'RECLAIMED');
CREATE UNIQUE INDEX "allocation_subscription_active_unique" ON "allocations"("subscriptionId") WHERE (status != 'RECLAIMED');
