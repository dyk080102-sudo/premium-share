/**
 * Worker Jobs - Cron 기반 백그라운드 작업
 * 기존 apps/worker/src/index.ts 에서 가져온 로직을 startWorkerJobs() 함수로 모듈화.
 * unified server (server.ts) 에서 Next.js와 함께 단일 프로세스로 실행됩니다.
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

export function startWorkerJobs(prisma: PrismaClient) {
  const workerId = process.env.WORKER_ID ?? 'unified-worker-1'

  const mailer = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'localhost',
    port: parseInt(process.env.SMTP_PORT ?? '1025'),
    auth:
      process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    secure: false,
    ignoreTLS: true,
  })

  const orderService = new OrderService(prisma)
  const allocationService = new AllocationService(prisma)
  const subscriptionService = new SubscriptionService(prisma)
  const notificationService = new NotificationService(prisma)

  async function runJob(jobType: string, targetId: string, fn: JobFn) {
    const idempotencyKey = `${jobType}:${targetId}:${new Date().toISOString().slice(0, 10)}`

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
        return
      }
    } catch {
      console.log(`[worker:${jobType}] Job ${idempotencyKey} already executed or locked`)
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

      console.log(`[worker:${jobType}] Done in ${elapsed}ms:`, result)
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
    }
  }

  // ── CRON SCHEDULES ─────────────────────────────────────────────────────────

  // 5분마다: 미결제 주문 만료
  cron.schedule('*/5 * * * *', async () => {
    await runJob('expire-unpaid-orders', 'all', async () => {
      const count = await orderService.expireUnpaidOrders()
      return { count }
    })
  })

  // 매시간: 대기열 처리
  cron.schedule('0 * * * *', async () => {
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

  // 매시간 +5분: 구독 만료 처리
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

  // 매일 00:00 UTC (KST 09:00): 갱신 알림
  cron.schedule('0 0 * * *', async () => {
    await runJob('renewal-reminders', new Date().toISOString().slice(0, 10), async () => {
      const count = await subscriptionService.sendRenewalReminders()
      return { count }
    })
  })

  // 매분: 이메일 발신함 처리
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
        console.log(`[worker:outbox] Sent → ${msg.recipientContact}: ${msg.subject}`)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        await notificationService.markOutboxFailed(msg.id, message)
        console.error(`[worker:outbox] Failed → ${msg.recipientContact}:`, message)
      }
    }
  })

  // 10분마다: 데이터 무결성 검사
  cron.schedule('*/10 * * * *', async () => {
    await runJob('integrity-check', new Date().toISOString().slice(0, 13), async () => {
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

  console.log(`[worker] Jobs scheduled (workerId=${workerId})`)
}
