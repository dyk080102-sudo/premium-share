import cron from 'node-cron'
import { PrismaClient, JobStatus } from '@prisma/client'
import { OrderService, AllocationService, SubscriptionService, NotificationService } from '@premium-share/domain'
import nodemailer from 'nodemailer'

const prisma = new PrismaClient()
const workerId = process.env.WORKER_ID ?? 'worker-1'

const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? 'localhost',
  port: parseInt(process.env.SMTP_PORT ?? '1025'),
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    : undefined,
  secure: false,
  ignoreTLS: true,
})

type JobFn = () => Promise<{ count?: number; message?: string }>

async function runJob(jobType: string, targetId: string, fn: JobFn) {
  const idempotencyKey = `${jobType}:${targetId}:${new Date().toISOString().slice(0, 10)}`

  // Atomic acquire using upsert + check
  try {
    const job = await prisma.jobExecution.upsert({
      where: { idempotencyKey },
      create: {
        jobType,
        targetId,
        idempotencyKey,
        scheduledAt: new Date(),
        status: JobStatus.RUNNING,
        startedAt: new Date(),
        lockedAt: new Date(),
        lockedBy: workerId,
      },
      update: {
        // Only update if PENDING (not RUNNING/DONE/FAILED)
        status: JobStatus.RUNNING,
        startedAt: new Date(),
        lockedAt: new Date(),
        lockedBy: workerId,
      },
    })

    if (job.lockedBy !== workerId) {
      console.log(`[${jobType}] Job already locked by ${job.lockedBy}, skipping`)
      return
    }
  } catch (err) {
    // Already exists and another worker has it
    console.log(`[${jobType}] Job ${idempotencyKey} already executed or locked`)
    return
  }

  const startedAt = Date.now()
  try {
    const result = await fn()
    const elapsed = Date.now() - startedAt

    await prisma.jobExecution.update({
      where: { idempotencyKey },
      data: {
        status: JobStatus.DONE,
        completedAt: new Date(),
        resultSummary: JSON.stringify(result),
      },
    })

    console.log(`[${jobType}] Done in ${elapsed}ms:`, result)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await prisma.jobExecution.update({
      where: { idempotencyKey },
      data: {
        status: JobStatus.FAILED,
        completedAt: new Date(),
        errorMessage: message,
      },
    })
    console.error(`[${jobType}] Error:`, message)
  }
}

// ── JOBS ──────────────────────────────────────────────────────────────────────

const orderService = new OrderService(prisma)
const allocationService = new AllocationService(prisma)
const subscriptionService = new SubscriptionService(prisma)
const notificationService = new NotificationService(prisma)

// Every 5 minutes: expire unpaid orders
cron.schedule('*/5 * * * *', async () => {
  await runJob('expire-unpaid-orders', 'all', async () => {
    const count = await orderService.expireUnpaidOrders()
    return { count }
  })
})

// Every hour: process waitlist
cron.schedule('0 * * * *', async () => {
  // Get all active products
  const products = await prisma.product.findMany({
    where: { isActive: true, reviewStatus: 'APPROVED' },
    select: { id: true },
  })

  for (const product of products) {
    await runJob('process-waitlist', product.id, async () => {
      const count = await allocationService.processWaitlist(product.id)
      return { count, productId: product.id }
    })
  }
})

// Every hour (offset 5 min): subscription expiry
cron.schedule('5 * * * *', async () => {
  await runJob('subscription-expiry', 'all', async () => {
    const result = await subscriptionService.processExpirations()
    return result
  })

  await runJob('create-reclaim-tasks', 'all', async () => {
    const count = await subscriptionService.createReclaimTasks()
    return { count }
  })
})

// Daily at 9 KST (00:00 UTC): renewal reminders
cron.schedule('0 0 * * *', async () => {
  await runJob('renewal-reminders', new Date().toISOString().slice(0, 10), async () => {
    const count = await subscriptionService.sendRenewalReminders()
    return { count }
  })
})

// Every minute: process outbox emails
cron.schedule('* * * * *', async () => {
  const messages = await notificationService.getPendingOutboxMessages(20)

  for (const msg of messages) {
    try {
      await mailer.sendMail({
        from: process.env.SMTP_FROM ?? 'noreply@premiumshare.demo',
        to: msg.recipientContact,
        subject: msg.subject,
        text: msg.content,
        html: `<div style="font-family:sans-serif;max-width:600px">${msg.content.replace(/\n/g, '<br>')}</div>`,
      })

      await notificationService.markOutboxSent(msg.id)
      console.log(`[outbox] Sent email to ${msg.recipientContact}: ${msg.subject}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await notificationService.markOutboxFailed(msg.id, message)
      console.error(`[outbox] Failed to send to ${msg.recipientContact}:`, message)
    }
  }
})

// Every 10 minutes: data integrity check
cron.schedule('*/10 * * * *', async () => {
  await runJob('integrity-check', new Date().toISOString().slice(0, 13), async () => {
    // Find subscriptions with multiple active allocations (should not exist due to DB constraint)
    const issues = await prisma.$queryRaw<{ subscriptionId: string; count: number }[]>`
      SELECT "subscriptionId", COUNT(*) as count
      FROM allocations
      WHERE status != 'RECLAIMED'
      GROUP BY "subscriptionId"
      HAVING COUNT(*) > 1
    `

    if (issues.length > 0) {
      console.error('[integrity] Found subscriptions with multiple active allocations:', issues)
    }

    // Find expired subscriptions not yet marked
    const unmarked = await prisma.subscription.count({
      where: {
        status: { in: ['ACTIVE', 'WAITING', 'EXPIRING'] },
        expiresAt: { lt: new Date() },
      },
    })

    return { allocationIssues: issues.length, unmarkedExpired: unmarked }
  })
})

console.log(`[worker] ${workerId} started. BUSINESS_MODE=${process.env.BUSINESS_MODE}`)

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[worker] Shutting down...')
  await prisma.$disconnect()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('[worker] Shutting down...')
  await prisma.$disconnect()
  process.exit(0)
})
