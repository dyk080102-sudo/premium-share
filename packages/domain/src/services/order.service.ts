import { PrismaClient, OrderStatus, BusinessSource } from '@prisma/client'
import { AuditService } from './audit.service'

export class OrderService {
  private audit: AuditService

  constructor(private db: PrismaClient) {
    this.audit = new AuditService(db)
  }

  async createOrder(params: {
    userId: string
    planId: string
    idempotencyKey: string
    source?: BusinessSource
  }) {
    // Idempotency check
    const existing = await this.db.order.findUnique({
      where: { idempotencyKey: params.idempotencyKey },
    })
    if (existing) return existing

    const plan = await this.db.plan.findUnique({
      where: { id: params.planId },
      include: { product: true },
    })
    if (!plan) throw new Error('플랜을 찾을 수 없습니다.')
    if (!plan.isActive) throw new Error('비활성화된 플랜입니다.')
    if (!plan.product.isActive) throw new Error('비활성화된 상품입니다.')
    if (plan.product.reviewStatus !== 'APPROVED') throw new Error('판매 승인되지 않은 상품입니다.')

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    const order = await this.db.order.create({
      data: {
        userId: params.userId,
        planId: params.planId,
        productId: plan.productId,
        productNameSnapshot: plan.product.name,
        planNameSnapshot: plan.name,
        durationDaysSnapshot: plan.durationDays,
        priceKrwSnapshot: plan.priceKrw,
        status: OrderStatus.PENDING_PAYMENT,
        source: params.source ?? BusinessSource.DEMO,
        expiresAt,
        idempotencyKey: params.idempotencyKey,
      },
    })

    await this.audit.log({
      actorId: params.userId,
      targetType: 'Order',
      targetId: order.id,
      action: 'ORDER_CREATED',
      after: { status: order.status, priceKrw: order.priceKrwSnapshot },
      source: params.source ?? BusinessSource.DEMO,
    })

    return order
  }

  async cancelOrder(orderId: string, actorId: string, reason?: string) {
    const order = await this.db.order.findUnique({ where: { id: orderId } })
    if (!order) throw new Error('주문을 찾을 수 없습니다.')
    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new Error('취소 가능한 상태가 아닙니다.')
    }

    const updated = await this.db.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.CANCELLED },
    })

    await this.audit.log({
      actorId,
      targetType: 'Order',
      targetId: orderId,
      action: 'ORDER_CANCELLED',
      before: { status: order.status },
      after: { status: updated.status },
      reason,
    })

    return updated
  }

  async expireUnpaidOrders(): Promise<number> {
    const result = await this.db.order.updateMany({
      where: {
        status: OrderStatus.PENDING_PAYMENT,
        expiresAt: { lt: new Date() },
      },
      data: { status: OrderStatus.EXPIRED },
    })

    return result.count
  }

  async getOrderById(orderId: string, userId?: string) {
    const order = await this.db.order.findUnique({
      where: { id: orderId },
      include: {
        plan: true,
        product: true,
        payments: true,
        subscriptions: true,
      },
    })
    if (!order) return null
    if (userId && order.userId !== userId) return null
    return order
  }

  async listUserOrders(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit
    const [orders, total] = await Promise.all([
      this.db.order.findMany({
        where: { userId },
        include: { plan: true, product: true, payments: { take: 1 } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.db.order.count({ where: { userId } }),
    ])
    return { orders, total, page, limit, totalPages: Math.ceil(total / limit) }
  }
}
