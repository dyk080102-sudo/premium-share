/**
 * Worker Jobs - Cron 기반 백그라운드 작업
 * unified server 에서는 startWorkerJobs() 로 스케줄,
 * Vercel 에서는 runWorkerTick() 을 /api/cron/tick 에서 호출합니다.
 */
import cron from 'node-cron'
import { PrismaClient, JobStatus } from '@prisma/client'
import {
  OrderService,
  AllocationService,
  SubscriptionService,
  NotificationService,
} from '@premium-share/domain'
import nodemailer from 'nodemailer'

type JobFn = () => Promise<{ count?: number; message?: string; [key: string]: unknown }>

function createMailer() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'localhost',
    port: parseInt(process.env.SMTP_PORT ?? '1025'),
    auth:
      process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    secure: false,
    ignoreTLS: true,
  })
}

async function runJob(
  prisma: PrismaClient,
  workerId: string,
  jobType: string,
  targetId: string,
  fn: JobFn,
) {
  const idempotencyKey = `${jobType}:${targetId}:${new Date().toISOString().slice(0, 16)}`

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
        status: JobStatus.RUNNING,
        startedAt: new Date(),
        lockedAt: new Date(),
        lockedBy: workerId,
      },
    })

    if (job.lockedBy !== workerId) {
      console.log(`[worker:${jobType}] Job already locked by ${job.lockedBy}, skipping`)
      return { skipped: true }
    }
  } catch {
    console.log(`[worker:${jobType}] Job ${idempotencyKey} already executed or locked`)
    return { skipped: true }
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

    console.log(`[worker:${jobType}] Done in ${elapsed}ms:`, result)
    return result
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
    console.error(`[worker:${jobType}] Error:`, message)
    return { error: message }
  }
}

/** One-shot tick for serverless cron (expire + waitlist + outbox + expiry). */
export async function runWorkerTick(prisma: PrismaClient) {
  const workerId = process.env.WORKER_ID ?? 'vercel-cron'
  const orderService = new OrderService(prisma)
  const allocationService = new AllocationService(prisma)
  const subscriptionService = new SubscriptionService(prisma)
  const notificationService = new NotificationService(prisma)
  const mailer = createMailer()

  const expired = await runJob(prisma, workerId, 'expire-unpaid-orders', 'tick', async () => {
    const count = await orderService.expireUnpaidOrders()
    return { count }
  })

  const products = await prisma.product.findMany({
    where: { isActive: true, reviewStatus: 'APPROVED' },
    select: { id: true },
  })
  const waitlist: unknown[] = []
  for (const product of products) {
    waitlist.push(
      await runJob(prisma, workerId, 'process-waitlist', product.id, async () => {
        const count = await allocationService.processWaitlist(product.id)
        return { count, productId: product.id }
      }),
    )
  }

  const expiry = await runJob(prisma, workerId, 'subscription-expiry', 'tick', async () => {
    return subscriptionService.processExpirations()
  })

  const reclaim = await runJob(prisma, workerId, 'create-reclaim-tasks', 'tick', async () => {
    const count = await subscriptionService.createReclaimTasks()
    return { count }
  })

  const messages = await notificationService.getPendingOutboxMessages(20)
  let sent = 0
  let failed = 0
  for (const msg of messages) {
    try {
      await mailer.sendMail({
        from: process.env.SMTP_FROM ?? 'noreply@premiumshare.kr',
        to: msg.recipientContact,
        subject: msg.subject,
        text: msg.content,
        html: `<div style="font-family:sans-serif;max-width:600px">${msg.content.replace(/\n/g, '<br>')}</div>`,
      })
      await notificationService.markOutboxSent(msg.id)
      sent += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await notificationService.markOutboxFailed(msg.id, message)
      failed += 1
    }
  }

  return { expired, waitlist, expiry, reclaim, outbox: { sent, failed, pending: messages.length } }
}

export function startWorkerJobs(prisma: PrismaClient) {
  const workerId = process.env.WORKER_ID ?? 'unified-worker-1'
  const mailer = createMailer()
  const orderService = new OrderService(prisma)
  const allocationService = new AllocationService(prisma)
  const subscriptionService = new SubscriptionService(prisma)
  const notificationService = new NotificationService(prisma)

  cron.schedule('*/5 * * * *', async () => {
    await runJob(prisma, workerId, 'expire-unpaid-orders', 'all', async () => {
      const count = await orderService.expireUnpaidOrders()
      return { count }
    })
  })

  cron.schedule('0 * * * *', async () => {
    const products = await prisma.product.findMany({
      where: { isActive: true, reviewStatus: 'APPROVED' },
      select: { id: true },
    })

    for (const product of products) {
      await runJob(prisma, workerId, 'process-waitlist', product.id, async () => {
        const count = await allocationService.processWaitlist(product.id)
        return { count, productId: product.id }
      })
    }
  })

  cron.schedule('5 * * * *', async () => {
    await runJob(prisma, workerId, 'subscription-expiry', 'all', async () => {
      return subscriptionService.processExpirations()
    })

    await runJob(prisma, workerId, 'create-reclaim-tasks', 'all', async () => {
      const count = await subscriptionService.createReclaimTasks()
      return { count }
    })
  })

  cron.schedule('0 0 * * *', async () => {
    await runJob(prisma, workerId, 'renewal-reminders', new Date().toISOString().slice(0, 10), async () => {
      const count = await subscriptionService.sendRenewalReminders()
      return { count }
    })
  })

  cron.schedule('* * * * *', async () => {
    const messages = await notificationService.getPendingOutboxMessages(20)

    for (const msg of messages) {
      try {
        await mailer.sendMail({
          from: process.env.SMTP_FROM ?? 'noreply@premiumshare.kr',
          to: msg.recipientContact,
          subject: msg.subject,
          text: msg.content,
          html: `<div style="font-family:sans-serif;max-width:600px">${msg.content.replace(/\n/g, '<br>')}</div>`,
        })

        await notificationService.markOutboxSent(msg.id)
        console.log(`[worker:outbox] Sent → ${msg.recipientContact}: ${msg.subject}`)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        await notificationService.markOutboxFailed(msg.id, message)
        console.error(`[worker:outbox] Failed → ${msg.recipientContact}:`, message)
      }
    }
  })

  cron.schedule('*/10 * * * *', async () => {
    await runJob(prisma, workerId, 'integrity-check', new Date().toISOString().slice(0, 13), async () => {
      const issues = await prisma.$queryRaw<{ subscriptionId: string; count: number }[]>`
        SELECT "subscriptionId", COUNT(*) as count
        FROM allocations
        WHERE status != 'RECLAIMED'
        GROUP BY "subscriptionId"
        HAVING COUNT(*) > 1
      `

      if (issues.length > 0) {
        console.error('[worker:integrity] Multiple active allocations:', issues)
      }

      const unmarked = await prisma.subscription.count({
        where: {
          status: { in: ['ACTIVE', 'WAITING', 'EXPIRING'] },
          expiresAt: { lt: new Date() },
        },
      })

      return { allocationIssues: issues.length, unmarkedExpired: unmarked }
    })
  })

  // Avoid unused in serverless build trees
  void mailer

  console.log(`[worker] Jobs scheduled (workerId=${workerId})`)
}
