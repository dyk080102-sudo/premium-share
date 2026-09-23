import {
  PrismaClient,
  FamilyJobType,
  FamilyAutomationMode,
  AllocationStatus,
  InvitationStatus,
} from '@prisma/client'
import { FamilyJobService } from './job.service'
import { FamilyCapacityService } from './capacity.service'
import { FamilySheetsService } from './sheets.service'
import { AuditService } from '../audit.service'

/**
 * 기존 Allocation/대기열을 사용해 초대 작업을 큐잉한다.
 * 중복 초대 방지.
 */
export class FamilyInviteService {
  private jobs: FamilyJobService
  private capacity: FamilyCapacityService
  private sheets: FamilySheetsService
  private audit: AuditService

  constructor(private db: PrismaClient) {
    this.jobs = new FamilyJobService(db)
    this.capacity = new FamilyCapacityService(db)
    this.sheets = new FamilySheetsService(db)
    this.audit = new AuditService(db)
  }

  async enqueueInvite(params: {
    groupId: string
    allocationId: string
    actorId?: string
    idempotencyKey?: string
  }) {
    const allocation = await this.db.allocation.findUnique({
      where: { id: params.allocationId },
      include: {
        slot: true,
        subscription: { include: { user: true } },
        invitations: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    })
    if (!allocation) throw new Error('배정을 찾을 수 없습니다.')
    if (allocation.slot.groupId !== params.groupId) {
      throw new Error('배정이 해당 그룹에 속하지 않습니다.')
    }
    if (
      allocation.status !== AllocationStatus.RESERVED &&
      allocation.status !== AllocationStatus.INVITED
    ) {
      throw new Error('초대 가능한 배정 상태가 아닙니다.')
    }

    const inviteEmail =
      allocation.invitations[0]?.inviteEmail ??
      allocation.subscription.user.email

    // 중복: 동일 이메일에 대한 QUEUED/CLAIMED/IN_PROGRESS INVITE 작업
    const duplicate = await this.db.familyJob.findFirst({
      where: {
        groupId: params.groupId,
        type: FamilyJobType.INVITE,
        targetEmail: inviteEmail.toLowerCase(),
        status: {
          in: ['QUEUED', 'CLAIMED', 'IN_PROGRESS', 'AWAITING_HUMAN'],
        },
      },
    })
    if (duplicate) {
      return duplicate
    }

    // 이미 외부에서 가입/초대 관측된 경우 스킵
    const link = await this.db.familyGroupLink.findUnique({
      where: { subscriptionGroupId: params.groupId },
      include: { externalMembers: true },
    })
    if (link) {
      const already = link.externalMembers.find(
        (m) =>
          m.email.toLowerCase() === inviteEmail.toLowerCase() &&
          m.externalStatus !== 'REMOVED',
      )
      if (already) {
        throw new Error(
          `이미 외부에서 관측된 멤버/초대입니다: ${inviteEmail}`,
        )
      }
    }

    const cap = await this.capacity.getGroupCapacity(params.groupId)
    if (cap.contradictory) {
      throw new Error(
        `정원 모순으로 초대 보류: ${cap.reasons.join('; ')}`,
      )
    }
    if (cap.assignable < 1) {
      throw new Error('배정 가능한 외부 정원이 없습니다.')
    }

    const group = await this.db.subscriptionGroup.findUniqueOrThrow({
      where: { id: params.groupId },
    })
    const setting = await this.db.familyAutomationSetting.findUnique({
      where: { groupId: params.groupId },
    })

    const key =
      params.idempotencyKey ??
      `invite:${params.groupId}:${params.allocationId}:${inviteEmail.toLowerCase()}`

    const job = await this.jobs.enqueue({
      type: FamilyJobType.INVITE,
      groupId: params.groupId,
      ownerAccountId: group.ownerAccountId,
      allocationId: params.allocationId,
      subscriptionId: allocation.subscriptionId,
      targetEmail: inviteEmail.toLowerCase(),
      idempotencyKey: key,
      mode: setting?.mode ?? FamilyAutomationMode.DEMO,
      actorId: params.actorId,
      beforeJson: {
        allocationStatus: allocation.status,
        inviteEmail: inviteEmail.toLowerCase(),
        capacity: cap,
      },
    })

    await this.sheets.emitEvent({
      eventType: 'FAMILY_INVITE_QUEUED',
      groupId: params.groupId,
      payload: {
        jobId: job.id,
        email: inviteEmail.toLowerCase(),
        allocationId: params.allocationId,
        // 비밀번호/세션/쿠키 절대 포함 금지
      },
      actorId: params.actorId,
    })

    await this.audit.log({
      actorId: params.actorId,
      targetType: 'FamilyJob',
      targetId: job.id,
      action: 'FAMILY_INVITE_ENQUEUED',
      after: { email: inviteEmail.toLowerCase(), status: job.status },
    })

    return job
  }

  /**
   * 그룹 내 RESERVED 배정 중 초대 대기열에 올릴 수 있는 항목 나열
   */
  async listInviteCandidates(groupId: string) {
    const allocations = await this.db.allocation.findMany({
      where: {
        slot: { groupId },
        status: {
          in: [AllocationStatus.RESERVED, AllocationStatus.INVITED],
        },
      },
      include: {
        subscription: { include: { user: { select: { email: true } } } },
        invitations: {
          where: {
            status: {
              in: [
                InvitationStatus.PENDING_SEND,
                InvitationStatus.SENT,
                InvitationStatus.FAILED,
              ],
            },
          },
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    return allocations.map((a) => ({
      allocationId: a.id,
      subscriptionId: a.subscriptionId,
      status: a.status,
      email:
        a.invitations[0]?.inviteEmail ?? a.subscription.user.email,
    }))
  }
}
