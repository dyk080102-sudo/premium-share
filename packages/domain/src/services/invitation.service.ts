import {
  PrismaClient,
  InvitationStatus,
  AllocationStatus,
  SubscriptionStatus,
  TaskStatus,
} from '@prisma/client'
import { AuditService } from './audit.service'
import { NotificationService } from './notification.service'

export class InvitationService {
  private audit: AuditService
  private notificationService: NotificationService

  constructor(private db: PrismaClient) {
    this.audit = new AuditService(db)
    this.notificationService = new NotificationService(db)
  }

  async recordInviteSent(invitationId: string, actorId: string, notes?: string) {
    const invitation = await this.db.invitation.findUnique({
      where: { id: invitationId },
    })
    if (!invitation) throw new Error('초대를 찾을 수 없습니다.')
    if (invitation.status !== InvitationStatus.PENDING_SEND) {
      throw new Error('발송 가능한 상태가 아닙니다.')
    }

    const updated = await this.db.invitation.update({
      where: { id: invitationId },
      data: {
        status: InvitationStatus.SENT,
        sentAt: new Date(),
        sentBy: actorId,
      },
    })

    // Update related task
    await this.db.operationTask.updateMany({
      where: {
        invitationId,
        status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] },
        type: 'INVITE_SEND',
      },
      data: { status: TaskStatus.DONE, resolvedAt: new Date(), resultNotes: notes },
    })

    await this.notificationService.createNotification({
      userId: invitation.subscriptionId,
      type: 'INVITATION_SENT',
      title: '초대가 발송되었습니다',
      message: `${invitation.inviteEmail}로 구독 초대가 발송되었습니다.`,
      relatedId: invitation.id,
      relatedType: 'Invitation',
    })

    await this.audit.log({
      actorId,
      targetType: 'Invitation',
      targetId: invitationId,
      action: 'INVITE_SENT',
      before: { status: invitation.status },
      after: { status: InvitationStatus.SENT },
    })

    return updated
  }

  async reportCustomerAccepted(invitationId: string, userId: string) {
    const invitation = await this.db.invitation.findUnique({
      where: { id: invitationId },
      include: { subscription: true },
    })
    if (!invitation) throw new Error('초대를 찾을 수 없습니다.')
    if (invitation.subscription.userId !== userId) throw new Error('접근 권한이 없습니다.')
    if (invitation.status !== InvitationStatus.SENT) {
      throw new Error('수락 신고 가능한 상태가 아닙니다.')
    }

    const updated = await this.db.invitation.update({
      where: { id: invitationId },
      data: {
        status: InvitationStatus.CUSTOMER_ACCEPTED,
        acceptedReportedAt: new Date(),
      },
    })

    // Create operator confirmation task
    await this.db.operationTask.create({
      data: {
        type: 'INVITE_ACTIVATE',
        subscriptionId: invitation.subscriptionId,
        invitationId,
        priority: 6,
        dueAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
        status: TaskStatus.PENDING,
      },
    })

    return updated
  }

  async confirmActivation(invitationId: string, actorId: string, notes?: string) {
    const invitation = await this.db.invitation.findUnique({
      where: { id: invitationId },
      include: { allocation: true },
    })
    if (!invitation) throw new Error('초대를 찾을 수 없습니다.')
    if (invitation.status !== InvitationStatus.CUSTOMER_ACCEPTED) {
      throw new Error('활성화 확인 가능한 상태가 아닙니다.')
    }

    await this.db.$transaction([
      this.db.invitation.update({
        where: { id: invitationId },
        data: {
          status: InvitationStatus.ACTIVATED,
          activatedAt: new Date(),
          activatedBy: actorId,
          activationNotes: notes,
        },
      }),
      this.db.allocation.update({
        where: { id: invitation.allocationId },
        data: {
          status: AllocationStatus.ACTIVE,
          activatedAt: new Date(),
        },
      }),
      this.db.subscription.update({
        where: { id: invitation.subscriptionId },
        data: {
          status: SubscriptionStatus.ACTIVE,
          startedAt: new Date(),
        },
      }),
      this.db.operationTask.updateMany({
        where: {
          invitationId,
          type: 'INVITE_ACTIVATE',
          status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] },
        },
        data: { status: TaskStatus.DONE, resolvedAt: new Date(), resultNotes: notes },
      }),
    ])

    const subscription = await this.db.subscription.findUnique({
      where: { id: invitation.subscriptionId },
    })

    if (subscription) {
      await this.notificationService.createNotification({
        userId: subscription.userId,
        type: 'SUBSCRIPTION_ACTIVATED',
        title: '구독이 활성화되었습니다',
        message: '운영자가 활성화를 확인했습니다. 이제 서비스를 이용하실 수 있습니다.',
        relatedId: subscription.id,
        relatedType: 'Subscription',
      })
    }

    await this.audit.log({
      actorId,
      targetType: 'Invitation',
      targetId: invitationId,
      action: 'INVITATION_ACTIVATED',
      reason: notes,
    })

    return invitation
  }

  async confirmReclaim(invitationId: string, actorId: string, notes?: string) {
    const invitation = await this.db.invitation.findUnique({
      where: { id: invitationId },
      include: { allocation: true },
    })
    if (!invitation) throw new Error('초대를 찾을 수 없습니다.')

    await this.db.$transaction([
      this.db.invitation.update({
        where: { id: invitationId },
        data: { status: InvitationStatus.CANCELLED },
      }),
      this.db.allocation.update({
        where: { id: invitation.allocationId },
        data: {
          status: AllocationStatus.RECLAIMED,
          reclaimedAt: new Date(),
          reclaimedBy: actorId,
          reclaimNotes: notes,
        },
      }),
      this.db.operationTask.updateMany({
        where: {
          invitationId,
          status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] },
        },
        data: { status: TaskStatus.DONE, resolvedAt: new Date(), resultNotes: notes },
      }),
    ])

    await this.audit.log({
      actorId,
      targetType: 'Invitation',
      targetId: invitationId,
      action: 'SLOT_RECLAIMED',
      reason: notes,
    })
  }
}
