import {
  PrismaClient,
  SubscriptionStatus,
  TaskType,
  TaskStatus,
  AllocationStatus,
  BusinessSource,
} from '@prisma/client'
import { AuditService } from './audit.service'
import { NotificationService } from './notification.service'

export class SubscriptionService {
  private audit: AuditService
  private notificationService: NotificationService

  constructor(private db: PrismaClient) {
    this.audit = new AuditService(db)
    this.notificationService = new NotificationService(db)
  }

  async createInvitationTask(subscriptionId: string, allocationId: string, actorId?: string) {
    const subscription = await this.db.subscription.findUnique({
      where: { id: subscriptionId },
      include: { user: true },
    })
    if (!subscription) throw new Error('구독을 찾을 수 없습니다.')

    // Create invitation record
    const invitation = await this.db.invitation.create({
      data: {
        allocationId,
        subscriptionId,
        inviteEmail: subscription.user.email,
        status: 'PENDING_SEND',
      },
    })

    // Create operation task
    await this.db.operationTask.create({
      data: {
        type: TaskType.INVITE_SEND,
        subscriptionId,
        invitationId: invitation.id,
        priority: 5,
        dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: TaskStatus.PENDING,
      },
    })

    // Update allocation status to INVITED
    await this.db.allocation.update({
      where: { id: allocationId },
      data: { status: AllocationStatus.INVITED },
    })

    return invitation
  }

  async createRenewalOrder(subscriptionId: string, userId: string) {
    const subscription = await this.db.subscription.findUnique({
      where: { id: subscriptionId },
      include: { plan: true, product: true },
    })
    if (!subscription) throw new Error('구독을 찾을 수 없습니다.')
    if (subscription.userId !== userId) throw new Error('접근 권한이 없습니다.')
    if (!['ACTIVE', 'EXPIRING'].includes(subscription.status)) {
      throw new Error('갱신 가능한 상태가 아닙니다.')
    }

    const idempotencyKey = `renewal-${subscriptionId}-${Date.now()}`

    return this.db.order.create({
      data: {
        userId,
        planId: subscription.planId,
        productId: subscription.productId,
        productNameSnapshot: subscription.product.name,
        planNameSnapshot: subscription.plan.name,
        durationDaysSnapshot: subscription.plan.durationDays,
        priceKrwSnapshot: subscription.plan.priceKrw,
        status: 'PENDING_PAYMENT',
        source: subscription.plan.priceKrw === 0 ? BusinessSource.DEMO : BusinessSource.MANUAL,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        idempotencyKey,
      },
    })
  }

  async applyRenewalPeriod(params: {
    subscriptionId: string
    orderId: string
    paymentId: string
    idempotencyKey: string
  }) {
    // Idempotency check
    const existingPeriod = await this.db.subscriptionPeriod.findFirst({
      where: { subscriptionId: params.subscriptionId, orderId: params.orderId },
    })
    if (existingPeriod) return existingPeriod

    const subscription = await this.db.subscription.findUnique({
      where: { id: params.subscriptionId },
      include: { plan: true },
    })
    if (!subscription) throw new Error('구독을 찾을 수 없습니다.')

    const currentEnd = subscription.currentPeriodEnd ?? new Date()
    const newEnd = new Date(currentEnd.getTime() + subscription.plan.durationDays * 24 * 60 * 60 * 1000)
    const now = new Date()

    const [period] = await this.db.$transaction([
      this.db.subscriptionPeriod.create({
        data: {
          subscriptionId: params.subscriptionId,
          orderId: params.orderId,
          paymentId: params.paymentId,
          planId: subscription.planId,
          startAt: currentEnd > now ? currentEnd : now,
          endAt: newEnd,
          durationDays: subscription.plan.durationDays,
          source: BusinessSource.MANUAL,
        },
      }),
      this.db.subscription.update({
        where: { id: params.subscriptionId },
        data: {
          expiresAt: newEnd,
          currentPeriodEnd: newEnd,
          status: SubscriptionStatus.ACTIVE,
        },
      }),
    ])

    return period
  }

  async processExpirations(): Promise<{ expired: number; expiring: number }> {
    const now = new Date()
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)

    const [expiredResult, expiringResult] = await Promise.all([
      this.db.subscription.updateMany({
        where: {
          status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.EXPIRING] },
          expiresAt: { lt: now },
        },
        data: { status: SubscriptionStatus.EXPIRED },
      }),
      this.db.subscription.updateMany({
        where: {
          status: SubscriptionStatus.ACTIVE,
          expiresAt: { gte: now, lte: threeDaysFromNow },
        },
        data: { status: SubscriptionStatus.EXPIRING },
      }),
    ])

    return { expired: expiredResult.count, expiring: expiringResult.count }
  }

  async createReclaimTasks(): Promise<number> {
    const expiredSubscriptions = await this.db.subscription.findMany({
      where: {
        status: SubscriptionStatus.EXPIRED,
        allocations: {
          some: {
            status: { in: [AllocationStatus.ACTIVE, AllocationStatus.INVITED] },
          },
        },
      },
      include: {
        allocations: {
          where: {
            status: { in: [AllocationStatus.ACTIVE, AllocationStatus.INVITED] },
          },
        },
      },
    })

    let taskCount = 0

    for (const subscription of expiredSubscriptions) {
      for (const allocation of subscription.allocations) {
        // Check if task already exists
        const existingTask = await this.db.operationTask.findFirst({
          where: {
            type: TaskType.SLOT_RECLAIM,
            subscriptionId: subscription.id,
            status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] },
          },
        })

        if (!existingTask) {
          await this.db.operationTask.create({
            data: {
              type: TaskType.SLOT_RECLAIM,
              subscriptionId: subscription.id,
              slotId: allocation.slotId,
              priority: 7,
              dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
              status: TaskStatus.PENDING,
            },
          })

          await this.db.allocation.update({
            where: { id: allocation.id },
            data: { status: AllocationStatus.PENDING_RECLAIM },
          })

          taskCount++
        }
      }
    }

    return taskCount
  }

  async sendRenewalReminders(): Promise<number> {
    const oneDayFromNow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)

    const expiringSubscriptions = await this.db.subscription.findMany({
      where: {
        status: SubscriptionStatus.EXPIRING,
        expiresAt: {
          gte: oneDayFromNow,
          lte: threeDaysFromNow,
        },
      },
      include: { user: true, product: true },
    })

    for (const sub of expiringSubscriptions) {
      const daysLeft = Math.ceil(
        (sub.expiresAt!.getTime() - Date.now()) / (24 * 60 * 60 * 1000),
      )

      await this.notificationService.createNotification({
        userId: sub.userId,
        type: 'RENEWAL_REMINDER',
        title: `구독 만료 ${daysLeft}일 전`,
        message: `${sub.product.name} 구독이 ${daysLeft}일 후 만료됩니다. 갱신을 진행하세요.`,
        relatedId: sub.id,
        relatedType: 'Subscription',
      })
    }

    return expiringSubscriptions.length
  }

  async getSubscriptionById(subscriptionId: string, userId?: string) {
    const subscription = await this.db.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        product: true,
        plan: true,
        order: true,
        allocations: {
          include: {
            slot: { include: { group: true } },
            invitations: true,
          },
        },
        periods: { orderBy: { startAt: 'desc' } },
      },
    })
    if (!subscription) return null
    if (userId && subscription.userId !== userId) return null
    return subscription
  }

  async listUserSubscriptions(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit
    const [subscriptions, total] = await Promise.all([
      this.db.subscription.findMany({
        where: { userId },
        include: { product: true, plan: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.db.subscription.count({ where: { userId } }),
    ])
    return { subscriptions, total, page, limit, totalPages: Math.ceil(total / limit) }
  }
}
