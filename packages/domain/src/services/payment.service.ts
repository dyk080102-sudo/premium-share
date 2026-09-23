import {
  PrismaClient,
  PaymentStatus,
  OrderStatus,
  BusinessSource,
  SubscriptionStatus,
  MatchStatus,
} from '@prisma/client'
import { AuditService } from './audit.service'
import { AllocationService } from './allocation.service'
import { SubscriptionService } from './subscription.service'
import { NotificationService } from './notification.service'

export class PaymentService {
  private audit: AuditService
  private allocationService: AllocationService
  private notificationService: NotificationService

  constructor(private db: PrismaClient) {
    this.audit = new AuditService(db)
    this.allocationService = new AllocationService(db)
    this.notificationService = new NotificationService(db)
  }

  async confirmPayment(params: {
    paymentId: string
    actorId: string
    notes?: string
    idempotencyKey: string
  }) {
    // Idempotency check
    const existing = await this.db.payment.findUnique({
      where: { id: params.paymentId },
    })
    if (!existing) throw new Error('결제를 찾을 수 없습니다.')
    if (existing.status === PaymentStatus.CONFIRMED) return existing

    const payment = await this.db.$transaction(async (tx) => {
      const p = await tx.payment.findUnique({
        where: { id: params.paymentId },
        include: { order: { include: { plan: true } } },
      })
      if (!p) throw new Error('결제를 찾을 수 없습니다.')
      if (p.status !== PaymentStatus.PENDING) {
        throw new Error('확인 가능한 상태가 아닙니다.')
      }

      const updated = await tx.payment.update({
        where: { id: params.paymentId },
        data: {
          status: PaymentStatus.CONFIRMED,
          confirmedAt: new Date(),
          confirmedBy: params.actorId,
          confirmNotes: params.notes,
        },
      })

      // Update order status
      await tx.order.update({
        where: { id: p.orderId },
        data: { status: OrderStatus.CONFIRMED },
      })

      // Find or create subscription
      let subscription = await tx.subscription.findFirst({
        where: { orderId: p.orderId },
      })

      if (!subscription) {
        const now = new Date()
        const endAt = new Date(now.getTime() + p.order.durationDaysSnapshot * 24 * 60 * 60 * 1000)

        subscription = await tx.subscription.create({
          data: {
            userId: p.order.userId,
            orderId: p.orderId,
            productId: p.order.productId,
            planId: p.order.planId,
            status: SubscriptionStatus.WAITING,
            currentPeriodStart: now,
            currentPeriodEnd: endAt,
          },
        })

        await tx.subscriptionPeriod.create({
          data: {
            subscriptionId: subscription.id,
            orderId: p.orderId,
            paymentId: p.id,
            planId: p.order.planId,
            startAt: now,
            endAt,
            durationDays: p.order.durationDaysSnapshot,
            source: p.source,
          },
        })
      }

      return updated
    })

    // Allocate slot (outside transaction to use row-level locking)
    const subscription = await this.db.subscription.findFirst({
      where: { orderId: existing.orderId },
    })

    if (subscription) {
      try {
        const allocation = await this.allocationService.allocateSlot(
          subscription.id,
          subscription.productId,
        )

        // Create invitation task
        const subscriptionService = new SubscriptionService(this.db)
        await subscriptionService.createInvitationTask(subscription.id, allocation.id, params.actorId)
      } catch {
        // No slot available - add to waitlist
        const order = await this.db.order.findUnique({ where: { id: existing.orderId } })
        if (order) {
          await this.db.waitlistEntry.create({
            data: {
              userId: order.userId,
              productId: order.productId,
              planId: order.planId,
              subscriptionId: subscription.id,
              status: 'WAITING',
            },
          })
        }
      }

      await this.notificationService.createNotification({
        userId: subscription.userId,
        type: 'PAYMENT_CONFIRMED',
        title: '결제가 확인되었습니다',
        message: '결제가 확인되어 슬롯 배정이 시작됩니다.',
        relatedId: subscription.id,
        relatedType: 'Subscription',
      })
    }

    await this.audit.log({
      actorId: params.actorId,
      targetType: 'Payment',
      targetId: params.paymentId,
      action: 'PAYMENT_CONFIRMED',
      before: { status: existing.status },
      after: { status: PaymentStatus.CONFIRMED },
      reason: params.notes,
    })

    return payment
  }

  async simulateDemoPayment(params: {
    orderId: string
    scenario: 'success' | 'fail' | 'cancel'
    actorId: string
  }) {
    if (process.env.BUSINESS_MODE !== 'DEMO') {
      throw new Error('DEMO 모드에서만 사용 가능합니다.')
    }

    const order = await this.db.order.findUnique({ where: { id: params.orderId } })
    if (!order) throw new Error('주문을 찾을 수 없습니다.')
    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new Error('결제 대기 상태가 아닙니다.')
    }
    if (order.userId !== params.actorId) {
      throw new Error('본인의 주문만 결제할 수 있습니다.')
    }

    const idempotencyKey = `demo-${params.orderId}-${Date.now()}`

    if (params.scenario === 'fail') {
      await this.audit.log({
        actorId: params.actorId,
        targetType: 'Order',
        targetId: params.orderId,
        action: 'DEMO_PAYMENT_FAILED',
        source: BusinessSource.DEMO,
      })
      return { success: false, message: '결제가 실패했습니다. (시뮬레이션)' }
    }

    if (params.scenario === 'cancel') {
      await this.db.order.update({
        where: { id: params.orderId },
        data: { status: OrderStatus.CANCELLED },
      })
      return { success: false, message: '결제가 취소되었습니다. (시뮬레이션)' }
    }

    // Success scenario
    const payment = await this.db.payment.create({
      data: {
        orderId: params.orderId,
        amountKrw: order.priceKrwSnapshot,
        status: PaymentStatus.PENDING,
        source: BusinessSource.DEMO,
        idempotencyKey,
      },
    })

    return this.confirmPayment({
      paymentId: payment.id,
      actorId: params.actorId,
      notes: 'DEMO 결제 시뮬레이션',
      idempotencyKey: `confirm-${idempotencyKey}`,
    })
  }

  async processBankCsvImport(importId: string, actorId: string) {
    const bankImport = await this.db.bankImport.findUnique({
      where: { id: importId },
      include: { transactions: true },
    })
    if (!bankImport) throw new Error('가져오기를 찾을 수 없습니다.')

    let matched = 0
    let unmatched = 0

    for (const tx of bankImport.transactions) {
      if (tx.matchStatus !== MatchStatus.UNMATCHED) continue

      // Try to match by amount and depositor
      const pendingPayment = await this.db.payment.findFirst({
        where: {
          status: PaymentStatus.PENDING,
          source: BusinessSource.MANUAL,
          order: { priceKrwSnapshot: tx.amountKrw },
        },
        include: { order: true },
      })

      if (pendingPayment) {
        await this.db.bankTransaction.update({
          where: { id: tx.id },
          data: {
            matchStatus: MatchStatus.MATCHED,
            matchedPaymentId: pendingPayment.id,
          },
        })
        matched++
      } else {
        unmatched++
      }
    }

    return { matched, unmatched, total: bankImport.transactions.length }
  }
}
