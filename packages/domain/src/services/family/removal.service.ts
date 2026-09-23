import {
  PrismaClient,
  FamilyJobType,
  FamilyAutomationMode,
  FamilyExternalStatus,
  AllocationStatus,
} from '@prisma/client'
import { FamilyJobService } from './job.service'
import { FamilySheetsService } from './sheets.service'
import { AuditService } from '../audit.service'

/**
 * 멤버 제거: 제거 전 갱신 충돌 검사, 외부 확인 전 Allocation을 FREE(RECLAIMED)로 만들지 않음.
 */
export class FamilyRemovalService {
  private jobs: FamilyJobService
  private sheets: FamilySheetsService
  private audit: AuditService

  constructor(private db: PrismaClient) {
    this.jobs = new FamilyJobService(db)
    this.sheets = new FamilySheetsService(db)
    this.audit = new AuditService(db)
  }

  async enqueueRemove(params: {
    groupId: string
    targetEmail: string
    allocationId?: string
    actorId?: string
    idempotencyKey?: string
    observedAt?: Date
  }) {
    const email = params.targetEmail.trim().toLowerCase()
    const link = await this.db.familyGroupLink.findUnique({
      where: { subscriptionGroupId: params.groupId },
      include: { externalMembers: true },
    })
    if (!link) throw new Error('가족 그룹 링크가 없습니다. 먼저 조회하세요.')

    const member = link.externalMembers.find(
      (m) =>
        m.email.toLowerCase() === email &&
        m.externalStatus !== FamilyExternalStatus.REMOVED,
    )
    if (!member) {
      throw new Error(`외부에서 관측된 멤버가 아닙니다: ${email}`)
    }

    // 갱신 충돌: 최근 조회 이후 멤버가 변경됐는지
    if (
      params.observedAt &&
      member.observedAt &&
      member.observedAt.getTime() > params.observedAt.getTime()
    ) {
      throw new Error(
        '외부 멤버 상태가 요청 시점 이후 갱신됨 — 충돌. 재조회 후 제거하세요.',
      )
    }

    if (link.lastInspectedAt == null) {
      throw new Error('최근 조회 기록이 없습니다. 제거 전 INSPECT가 필요합니다.')
    }

    // Allocation을 여기서 RECLAIMED로 바꾸지 않음 — VERIFY_REMOVAL 성공 후에만
    if (params.allocationId || member.allocationId) {
      const allocId = params.allocationId ?? member.allocationId!
      const alloc = await this.db.allocation.findUnique({
        where: { id: allocId },
      })
      if (alloc && alloc.status === AllocationStatus.RECLAIMED) {
        throw new Error(
          '이미 RECLAIMED된 배정입니다. 외부 제거 확인 전 FREE 금지 위반 가능성 — 수동 확인 필요',
        )
      }
      // PENDING_RECLAIM으로만 표시 (선택)
      if (
        alloc &&
        alloc.status !== AllocationStatus.PENDING_RECLAIM &&
        alloc.status !== AllocationStatus.RECLAIMED
      ) {
        await this.db.allocation.update({
          where: { id: alloc.id },
          data: { status: AllocationStatus.PENDING_RECLAIM },
        })
      }
    }

    await this.db.familyExternalMember.update({
      where: { id: member.id },
      data: { externalStatus: FamilyExternalStatus.REMOVAL_PENDING },
    })

    const group = await this.db.subscriptionGroup.findUniqueOrThrow({
      where: { id: params.groupId },
    })
    const setting = await this.db.familyAutomationSetting.findUnique({
      where: { groupId: params.groupId },
    })

    const key =
      params.idempotencyKey ??
      `remove:${params.groupId}:${email}:${Date.now()}`

    const job = await this.jobs.enqueue({
      type: FamilyJobType.REMOVE_MEMBER,
      groupId: params.groupId,
      ownerAccountId: group.ownerAccountId,
      allocationId: params.allocationId ?? member.allocationId ?? undefined,
      targetEmail: email,
      idempotencyKey: key,
      mode: setting?.mode ?? FamilyAutomationMode.DEMO,
      actorId: params.actorId,
      beforeJson: {
        memberId: member.id,
        previousStatus: member.externalStatus,
        observedAt: member.observedAt.toISOString(),
      },
    })

    await this.sheets.emitEvent({
      eventType: 'FAMILY_REMOVE_QUEUED',
      groupId: params.groupId,
      payload: {
        jobId: job.id,
        email,
        // 비밀번호 제외
      },
      actorId: params.actorId,
    })

    await this.audit.log({
      actorId: params.actorId,
      targetType: 'FamilyJob',
      targetId: job.id,
      action: 'FAMILY_REMOVE_ENQUEUED',
      after: { email, status: job.status },
    })

    return job
  }

  /**
   * 외부에서 제거가 확인된 뒤에만 Allocation을 RECLAIMED로 전환.
   */
  async confirmRemovalVerified(params: {
    groupId: string
    targetEmail: string
    allocationId?: string
    actorId?: string
  }) {
    const email = params.targetEmail.trim().toLowerCase()
    const link = await this.db.familyGroupLink.findUnique({
      where: { subscriptionGroupId: params.groupId },
      include: { externalMembers: true },
    })
    if (!link) throw new Error('가족 그룹 링크가 없습니다.')

    const member = link.externalMembers.find(
      (m) => m.email.toLowerCase() === email,
    )
    if (!member) throw new Error('멤버 기록을 찾을 수 없습니다.')

    await this.db.familyExternalMember.update({
      where: { id: member.id },
      data: {
        externalStatus: FamilyExternalStatus.REMOVED,
        observedAt: new Date(),
      },
    })

    const allocId = params.allocationId ?? member.allocationId
    if (allocId) {
      await this.db.allocation.update({
        where: { id: allocId },
        data: {
          status: AllocationStatus.RECLAIMED,
          reclaimedAt: new Date(),
          reclaimedBy: params.actorId,
          reclaimNotes: 'Family VERIFY_REMOVAL confirmed — external removal verified',
        },
      })
    }

    await this.audit.log({
      actorId: params.actorId,
      targetType: 'FamilyExternalMember',
      targetId: member.id,
      action: 'FAMILY_REMOVAL_VERIFIED',
      after: { email, allocationId: allocId },
    })

    return { email, allocationId: allocId }
  }
}
