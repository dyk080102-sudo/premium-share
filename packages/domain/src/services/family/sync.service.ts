import {
  PrismaClient,
  FamilyMemberKind,
  FamilyExternalStatus,
  AllocationStatus,
} from '@prisma/client'
import { AuditService } from '../audit.service'
import {
  FamilyCapacityService,
  calculateAssignableCapacity,
} from './capacity.service'

export type ExternalMemberSnapshot = {
  email: string
  displayName?: string | null
  kind: FamilyMemberKind
  externalStatus?: FamilyExternalStatus
}

export type SyncResult = {
  linkId: string
  upserted: number
  removedFromObservation: number
  capacity: ReturnType<typeof calculateAssignableCapacity>
  blockedNewAssignments: boolean
  notes: string[]
}

/**
 * 외부 스냅샷 → 내부 FamilyExternalMember 동기화.
 * 중복 점유 방지, 모순 시 신규 배정 보류.
 */
export class FamilySyncService {
  private audit: AuditService
  private capacity: FamilyCapacityService

  constructor(private db: PrismaClient) {
    this.audit = new AuditService(db)
    this.capacity = new FamilyCapacityService(db)
  }

  async applyExternalSnapshot(params: {
    groupId: string
    externalGroupKey?: string | null
    planActiveConfirmed?: boolean
    capacityTotal?: number | null
    adminSeats?: number
    members: ExternalMemberSnapshot[]
    actorId?: string
  }): Promise<SyncResult> {
    const notes: string[] = []
    const group = await this.db.subscriptionGroup.findUnique({
      where: { id: params.groupId },
    })
    if (!group) throw new Error('구독 그룹을 찾을 수 없습니다.')

    // 이메일 중복 검사 (동일 스냅샷 내)
    const emails = params.members.map((m) => m.email.toLowerCase())
    const dup = emails.filter((e, i) => emails.indexOf(e) !== i)
    if (dup.length > 0) {
      notes.push(`스냅샷 내 중복 이메일: ${[...new Set(dup)].join(', ')}`)
    }

    const link = await this.db.familyGroupLink.upsert({
      where: { subscriptionGroupId: params.groupId },
      create: {
        subscriptionGroupId: params.groupId,
        ownerAccountId: group.ownerAccountId,
        externalGroupKey: params.externalGroupKey ?? undefined,
        planActiveConfirmed: params.planActiveConfirmed ?? false,
        planCheckedAt: new Date(),
        capacityTotal: params.capacityTotal ?? group.totalCapacity,
        adminSeats:
          params.adminSeats !== undefined && params.adminSeats !== null
            ? params.adminSeats
            : group.adminSlotsReserved > 0
              ? group.adminSlotsReserved
              : 1,
        lastInspectedAt: new Date(),
        lastInspectStatus: 'OK',
        linkedAt: params.externalGroupKey ? new Date() : undefined,
      },
      update: {
        externalGroupKey:
          params.externalGroupKey !== undefined
            ? params.externalGroupKey
            : undefined,
        planActiveConfirmed:
          params.planActiveConfirmed !== undefined
            ? params.planActiveConfirmed
            : undefined,
        planCheckedAt: new Date(),
        capacityTotal:
          params.capacityTotal !== undefined
            ? params.capacityTotal
            : undefined,
        adminSeats:
          params.adminSeats !== undefined ? params.adminSeats : undefined,
        lastInspectedAt: new Date(),
        lastInspectStatus: 'OK',
        lastInspectError: null,
        linkedAt: params.externalGroupKey ? new Date() : undefined,
      },
    })

    // 기존 멤버 맵
    const existing = await this.db.familyExternalMember.findMany({
      where: { linkId: link.id },
    })
    const existingKey = (email: string, kind: FamilyMemberKind) =>
      `${email.toLowerCase()}::${kind}`

    const seen = new Set<string>()
    let upserted = 0

    for (const m of params.members) {
      const email = m.email.trim().toLowerCase()
      const kind = m.kind
      const key = existingKey(email, kind)
      seen.add(key)

      const status =
        m.externalStatus ??
        (kind === FamilyMemberKind.PENDING_INVITE
          ? FamilyExternalStatus.INVITED
          : kind === FamilyMemberKind.ADMIN
            ? FamilyExternalStatus.OBSERVED
            : FamilyExternalStatus.JOINED)

      await this.db.familyExternalMember.upsert({
        where: {
          linkId_email_kind: { linkId: link.id, email, kind },
        },
        create: {
          linkId: link.id,
          email,
          displayName: m.displayName ?? undefined,
          kind,
          externalStatus: status,
          observedAt: new Date(),
          managedByUs: false,
        },
        update: {
          displayName: m.displayName ?? undefined,
          externalStatus: status,
          observedAt: new Date(),
        },
      })
      upserted += 1
    }

    // 스냅샷에 없는 OBSERVED/JOINED 멤버는 REMOVED로 표시 (삭제하지 않음 — 감사)
    let removedFromObservation = 0
    for (const ex of existing) {
      const key = existingKey(ex.email, ex.kind)
      if (
        !seen.has(key) &&
        ex.externalStatus !== FamilyExternalStatus.REMOVED &&
        ex.kind !== FamilyMemberKind.PENDING_INVITE
      ) {
        await this.db.familyExternalMember.update({
          where: { id: ex.id },
          data: {
            externalStatus: FamilyExternalStatus.REMOVED,
            observedAt: new Date(),
          },
        })
        removedFromObservation += 1
      }
    }

    // 내부 할당과 외부 멤버 이메일 매칭 (중복 점유 방지 힌트)
    const activeAllocations = await this.db.allocation.findMany({
      where: {
        slot: { groupId: params.groupId },
        status: {
          in: [
            AllocationStatus.RESERVED,
            AllocationStatus.INVITED,
            AllocationStatus.ACTIVE,
            AllocationStatus.PENDING_RECLAIM,
          ],
        },
      },
      include: {
        subscription: { include: { user: true } },
        invitations: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    })

    for (const alloc of activeAllocations) {
      const inviteEmail =
        alloc.invitations[0]?.inviteEmail?.toLowerCase() ??
        alloc.subscription.user.email.toLowerCase()
      const match = await this.db.familyExternalMember.findFirst({
        where: {
          linkId: link.id,
          email: inviteEmail,
          kind: {
            in: [FamilyMemberKind.MEMBER, FamilyMemberKind.PENDING_INVITE],
          },
          externalStatus: { not: FamilyExternalStatus.REMOVED },
        },
      })
      if (match && !match.allocationId) {
        await this.db.familyExternalMember.update({
          where: { id: match.id },
          data: { allocationId: alloc.id, managedByUs: true },
        })
      } else if (match && match.allocationId && match.allocationId !== alloc.id) {
        notes.push(
          `중복 점유 의심: ${inviteEmail}이 다른 allocation과 연결됨 — 보류`,
        )
      }
    }

    const capacity = await this.capacity.getGroupCapacity(params.groupId)
    if (capacity.contradictory) {
      notes.push(...capacity.reasons)
    }

    await this.audit.log({
      actorId: params.actorId,
      targetType: 'FamilyGroupLink',
      targetId: link.id,
      action: 'FAMILY_SYNC_APPLIED',
      after: {
        upserted,
        removedFromObservation,
        assignable: capacity.assignable,
        contradictory: capacity.contradictory,
      },
    })

    return {
      linkId: link.id,
      upserted,
      removedFromObservation,
      capacity,
      blockedNewAssignments: capacity.contradictory || capacity.assignable === 0,
      notes,
    }
  }
}
