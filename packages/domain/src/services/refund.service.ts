import { PrismaClient, RefundStatus, BusinessSource, PaymentStatus } from '@prisma/client'
import { AuditService } from './audit.service'
import { NotificationService } from './notification.service'

export class RefundService {
  private audit: AuditService
  private notificationService: NotificationService

  constructor(private db: PrismaClient) {
    this.audit = new AuditService(db)
    this.notificationService = new NotificationService(db)
  }

  /**
   * Calculate refundable amount based on usage days
   */
  calculateRefundableAmount(params: {
    paidAmount: number
    startedAt: Date | null
    expiresAt: Date | null
    durationDays: number
    existingRefunds?: number
  }): number {
    const { paidAmount, startedAt, expiresAt, durationDays, existingRefunds = 0 } = params

    if (!startedAt || !expiresAt) {
      // Not started - full refund
      return Math.max(0, paidAmount - existingRefunds)
    }

    const now = new Date()
    const usedMs = Math.max(0, now.getTime() - startedAt.getTime())
    const totalMs = durationDays * 24 * 60 * 60 * 1000
    const usedFraction = Math.min(1, usedMs / totalMs)

    const usedAmount = Math.ceil(paidAmount * usedFraction)
    const refundable = Math.max(0, paidAmount - usedAmount - existingRefunds)

    return refundable
  }

  async requestRefund(params: {
    orderId: string
    userId: string
    reason: string
    notes?: string
  }) {
    const order = await this.db.order.findUnique({
      where: { id: params.orderId },
      include: {
        payments: { where: { status: PaymentStatus.CONFIRMED } },
        subscriptions: true,
      },
    })
    if (!order) throw new Error('주문을 찾을 수 없습니다.')
    if (order.userId !== params.userId) throw new Error('본인의 주문만 환불 신청할 수 있습니다.')
    if (order.payments.length === 0) throw new Error('확인된 결제가 없습니다.')

    // Check for existing pending refund
    const existingRefund = await this.db.refund.findFirst({
      where: {
        orderId: params.orderId,
        status: { in: [RefundStatus.REQUESTED, RefundStatus.REVIEWING, RefundStatus.APPROVED] },
      },
    })
    if (existingRefund) throw new Error('이미 진행 중인 환불 신청이 있습니다.')

    const payment = order.payments[0]
    const subscription = order.subscriptions[0]

    const existingRefunds = await this.db.refund.aggregate({
      where: {
        orderId: params.orderId,
        status: { in: [RefundStatus.APPROVED, RefundStatus.PENDING_PAYOUT, RefundStatus.PAID_OUT] },
      },
      _sum: { approvedAmountKrw: true },
    })

    const refundableAmount = this.calculateRefundableAmount({
      paidAmount: payment.amountKrw,
      startedAt: subscription?.startedAt ?? null,
      expiresAt: subscription?.expiresAt ?? null,
      durationDays: order.durationDaysSnapshot,
      existingRefunds: existingRefunds._sum.approvedAmountKrw ?? 0,
    })

    const refund = await this.db.refund.create({
      data: {
        userId: params.userId,
        orderId: params.orderId,
        paymentId: payment.id,
        subscriptionId: subscription?.id,
        requestedAmountKrw: refundableAmount,
        status: RefundStatus.REQUESTED,
        reason: params.reason,
        requestNotes: params.notes,
        source: payment.source,
      },
    })

    await this.audit.log({
      actorId: params.userId,
      targetType: 'Refund',
      targetId: refund.id,
      action: 'REFUND_REQUESTED',
      after: { status: refund.status, amount: refund.requestedAmountKrw },
    })

    return refund
  }

  async approveRefund(params: {
    refundId: string
    actorId: string
    approvedAmount: number
    notes?: string
  }) {
    return this.db.$transaction(async (tx) => {
      // Lock the refund row
      const refund = await tx.$queryRaw<{ id: string; status: string; orderId: string }[]>`
        SELECT id, status, "orderId" FROM refunds WHERE id = ${params.refundId} FOR UPDATE
      `
      if (!refund[0]) throw new Error('환불을 찾을 수 없습니다.')
      if (refund[0].status !== RefundStatus.REQUESTED && refund[0].status !== RefundStatus.REVIEWING) {
        throw new Error('승인 가능한 상태가 아닙니다.')
      }

      // Check total approved doesn't exceed paid amount
      const payment = await tx.payment.findFirst({
        where: { orderId: refund[0].orderId, status: PaymentStatus.CONFIRMED },
      })
      if (!payment) throw new Error('결제를 찾을 수 없습니다.')

      const totalApproved = await tx.refund.aggregate({
        where: {
          orderId: refund[0].orderId,
          id: { not: params.refundId },
          status: {
            in: [RefundStatus.APPROVED, RefundStatus.PENDING_PAYOUT, RefundStatus.PAID_OUT],
          },
        },
        _sum: { approvedAmountKrw: true },
      })

      const alreadyApproved = totalApproved._sum.approvedAmountKrw ?? 0
      if (alreadyApproved + params.approvedAmount > payment.amountKrw) {
        throw new Error('환불 총액이 결제액을 초과할 수 없습니다.')
      }

      const updated = await tx.refund.update({
        where: { id: params.refundId },
        data: {
          status: RefundStatus.APPROVED,
          approvedAmountKrw: params.approvedAmount,
          reviewedBy: params.actorId,
          reviewedAt: new Date(),
          reviewNotes: params.notes,
        },
      })

      return updated
    })
  }

  async completeDemoRefund(refundId: string, actorId: string) {
    if (process.env.BUSINESS_MODE !== 'DEMO') {
      throw new Error('DEMO 모드에서만 사용 가능합니다.')
    }

    const refund = await this.db.refund.findUnique({ where: { id: refundId } })
    if (!refund) throw new Error('환불을 찾을 수 없습니다.')
    if (refund.status !== RefundStatus.APPROVED) throw new Error('승인된 환불이 아닙니다.')

    return this.db.refund.update({
      where: { id: refundId },
      data: {
        status: RefundStatus.PAID_OUT,
        paidAt: new Date(),
        paidBy: actorId,
        paidNotes: 'DEMO 모드 자동 처리',
        source: BusinessSource.DEMO,
      },
    })
  }

  async recordManualPayout(params: {
    refundId: string
    actorId: string
    payoutRef: string
    notes?: string
  }) {
    const refund = await this.db.refund.findUnique({ where: { id: params.refundId } })
    if (!refund) throw new Error('환불을 찾을 수 없습니다.')
    if (refund.status !== RefundStatus.APPROVED && refund.status !== RefundStatus.PENDING_PAYOUT) {
      throw new Error('지급 기록 가능한 상태가 아닙니다.')
    }

    return this.db.refund.update({
      where: { id: params.refundId },
      data: {
        status: RefundStatus.PAID_OUT,
        paidAt: new Date(),
        paidBy: params.actorId,
        payoutRef: params.payoutRef,
        paidNotes: params.notes,
        source: BusinessSource.MANUAL,
      },
    })
  }

  async listUserRefunds(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit
    const [refunds, total] = await Promise.all([
      this.db.refund.findMany({
        where: { userId },
        include: { order: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.db.refund.count({ where: { userId } }),
    ])
    return { refunds, total, page, limit, totalPages: Math.ceil(total / limit) }
  }
}
