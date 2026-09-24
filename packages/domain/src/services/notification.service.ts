import { PrismaClient, BusinessSource, OutboxStatus } from '@prisma/client'

export class NotificationService {
  constructor(private db: PrismaClient) {}

  async createNotification(params: {
    userId: string
    type: string
    title: string
    message: string
    relatedId?: string
    relatedType?: string
  }) {
    return this.db.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        relatedId: params.relatedId,
        relatedType: params.relatedType,
      },
    })
  }

  async createOutboxMessage(params: {
    type: string
    userId?: string
    recipientContact: string
    subject: string
    content: string
    templateKey?: string
    variables?: Record<string, unknown>
    source?: BusinessSource
    scheduledAt?: Date
  }) {
    return this.db.outboxMessage.create({
      data: {
        type: params.type,
        recipientUserId: params.userId,
        recipientContact: params.recipientContact,
        subject: params.subject,
        content: params.content,
        templateKey: params.templateKey,
        variables: params.variables ? JSON.parse(JSON.stringify(params.variables)) : undefined,
        source:
          params.source ??
          (process.env.BUSINESS_MODE === 'DEMO' ? BusinessSource.DEMO : BusinessSource.MANUAL),
        scheduledAt: params.scheduledAt ?? new Date(),
        status: OutboxStatus.PENDING,
      },
    })
  }

  async markRead(notificationId: string, userId: string) {
    const notif = await this.db.notification.findFirst({
      where: { id: notificationId, userId },
    })
    if (!notif) throw new Error('알림을 찾을 수 없습니다.')

    return this.db.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    })
  }

  async markAllRead(userId: string) {
    return this.db.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    })
  }

  async getPendingOutboxMessages(limit = 50) {
    return this.db.outboxMessage.findMany({
      where: {
        status: OutboxStatus.PENDING,
        scheduledAt: { lte: new Date() },
      },
      take: limit,
      orderBy: { scheduledAt: 'asc' },
    })
  }

  async markOutboxSent(id: string) {
    return this.db.outboxMessage.update({
      where: { id },
      data: { status: OutboxStatus.SENT, processedAt: new Date() },
    })
  }

  async markOutboxFailed(id: string, error: string) {
    return this.db.outboxMessage.update({
      where: { id },
      data: { status: OutboxStatus.FAILED, processedAt: new Date(), error },
    })
  }
}
