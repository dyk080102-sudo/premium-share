import {
  PrismaClient,
  AllocationStatus,
  FamilyMemberKind,
  FamilyExternalStatus,
} from '@prisma/client'

export type CapacityBreakdown = {
  capacityTotal: number
  adminSeats: number
  joinedMembers: number
  pendingInvites: number
  internalReservations: number
  removalPending: number
  unmanagedMembers: number
  unknownOccupancy: number
  assignable: number
  contradictory: boolean
  reasons: string[]
}

/**
 * 외부 정원 안에서 내부 슬롯 배정 가능 수량을 계산한다.
 * Google 정원을 늘리는 기능이 아니다.
 */
export function calculateAssignableCapacity(input: {
  capacityTotal: number | null | undefined
  adminSeats?: number
  joinedMembers: number
  pendingInvites: number
  internalReservations: number
  removalPending: number
  unmanagedMembers: number
  unknownOccupancy?: number
}): CapacityBreakdown {
  const reasons: string[] = []
  const capacityTotal = input.capacityTotal ?? null
  const adminSeats = input.adminSeats ?? 1
  const unknownOccupancy = input.unknownOccupancy ?? 0

  if (capacityTotal == null || capacityTotal < 0) {
    return {
      capacityTotal: 0,
      adminSeats,
      joinedMembers: input.joinedMembers,
      pendingInvites: input.pendingInvites,
      internalReservations: input.internalReservations,
      removalPending: input.removalPending,
      unmanagedMembers: input.unmanagedMembers,
      unknownOccupancy,
      assignable: 0,
      contradictory: true,
      reasons: ['정원 정보 없음 또는 유효하지 않음 — 신규 배정 보류'],
    }
  }

  if (unknownOccupancy > 0) {
    reasons.push('최근 조회 실패 등으로 점유 불명 — 빈 슬롯으로 간주하지 않음')
  }

  const occupied =
    adminSeats +
    input.joinedMembers +
    input.pendingInvites +
    input.internalReservations +
    input.removalPending +
    input.unmanagedMembers +
    unknownOccupancy

  let contradictory = false
  if (occupied > capacityTotal) {
    contradictory = true
    reasons.push('외부 점유+내부 예약 합이 정원을 초과 — 정합성 확인 필요')
  }
  if (input.joinedMembers < 0 || input.pendingInvites < 0) {
    contradictory = true
    reasons.push('음수 점유 값')
  }

  const assignable = contradictory ? 0 : Math.max(0, capacityTotal - occupied)

  return {
    capacityTotal,
    adminSeats,
    joinedMembers: input.joinedMembers,
    pendingInvites: input.pendingInvites,
    internalReservations: input.internalReservations,
    removalPending: input.removalPending,
    unmanagedMembers: input.unmanagedMembers,
    unknownOccupancy,
    assignable,
    contradictory,
    reasons,
  }
}

export class FamilyCapacityService {
  constructor(private db: PrismaClient) {}

  /**
   * 그룹의 외부 점유 + 유효 초대 + 내부 예약 + 제거 대기를 합산해 배정 가능 수를 산출한다.
   * 모순이면 assignable=0, contradictory=true.
   */
  async getGroupCapacity(groupId: string): Promise<CapacityBreakdown> {
    const group = await this.db.subscriptionGroup.findUnique({
      where: { id: groupId },
      include: {
        familyLink: { include: { externalMembers: true } },
        slots: {
          include: {
            allocations: {
              where: {
                status: {
                  in: [
                    AllocationStatus.RESERVED,
                    AllocationStatus.INVITED,
                    AllocationStatus.ACTIVE,
                    AllocationStatus.PENDING_RECLAIM,
                  ],
                },
              },
            },
          },
        },
      },
    })

    if (!group) {
      return calculateAssignableCapacity({
        capacityTotal: null,
        joinedMembers: 0,
        pendingInvites: 0,
        internalReservations: 0,
        removalPending: 0,
        unmanagedMembers: 0,
      })
    }

    const link = group.familyLink
    const members = link?.externalMembers ?? []

    const joinedMembers = members.filter(
      (m) =>
        m.kind === FamilyMemberKind.MEMBER &&
        (m.externalStatus === FamilyExternalStatus.JOINED ||
          m.externalStatus === FamilyExternalStatus.OBSERVED),
    ).length

    const pendingInvites = members.filter(
      (m) =>
        m.kind === FamilyMemberKind.PENDING_INVITE ||
        m.externalStatus === FamilyExternalStatus.INVITED,
    ).length

    const removalPending = members.filter(
      (m) => m.externalStatus === FamilyExternalStatus.REMOVAL_PENDING,
    ).length

    const unmanagedMembers = members.filter(
      (m) => m.kind === FamilyMemberKind.UNMANAGED,
    ).length

    const linkedAllocationIds = new Set(
      members.map((m) => m.allocationId).filter(Boolean) as string[],
    )

    let internalReservations = 0
    for (const slot of group.slots) {
      for (const alloc of slot.allocations) {
        if (
          (alloc.status === AllocationStatus.RESERVED ||
            alloc.status === AllocationStatus.INVITED) &&
          !linkedAllocationIds.has(alloc.id)
        ) {
          internalReservations += 1
        }
      }
    }

    const unknownOccupancy =
      link?.lastInspectStatus === 'FAILED' || link?.lastInspectStatus === 'UNKNOWN'
        ? 1
        : 0

    return calculateAssignableCapacity({
      capacityTotal: link?.capacityTotal ?? group.totalCapacity,
      adminSeats:
        link?.adminSeats != null
          ? link.adminSeats
          : group.adminSlotsReserved > 0
            ? group.adminSlotsReserved
            : 1,
      joinedMembers,
      pendingInvites,
      internalReservations,
      removalPending,
      unmanagedMembers,
      unknownOccupancy,
    })
  }
}
