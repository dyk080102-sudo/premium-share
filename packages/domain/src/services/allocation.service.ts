import { PrismaClient, AllocationStatus, WaitlistStatus } from '@prisma/client'
import { AuditService } from './audit.service'

export class AllocationService {
  private audit: AuditService

  constructor(private db: PrismaClient) {
    this.audit = new AuditService(db)
  }

  /**
   * Find an available slot and allocate it to a subscription.
   * Uses SELECT FOR UPDATE SKIP LOCKED to prevent race conditions.
   */
  async allocateSlot(
    subscriptionId: string,
    productId: string,
    actorId?: string,
  ) {
    return this.db.$transaction(async (tx) => {
      // Check if already allocated
      const existingAllocation = await tx.allocation.findFirst({
        where: {
          subscriptionId,
          status: { not: AllocationStatus.RECLAIMED },
        },
      })
      if (existingAllocation) return existingAllocation

      // Find an available slot using raw SQL with row locking
      const slots = await tx.$queryRaw<{ id: string }[]>`
        SELECT s.id
        FROM slots s
        JOIN subscription_groups g ON s."groupId" = g.id
        WHERE g."productId" = ${productId}
          AND g.status = 'ACTIVE'
          AND g."policyVerified" = true
          AND NOT EXISTS (
            SELECT 1 FROM allocations a
            WHERE a."slotId" = s.id
              AND a.status != 'RECLAIMED'
          )
        ORDER BY g.id ASC, s."slotIndex" ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `

      if (slots.length === 0) {
        throw new Error('사용 가능한 슬롯이 없습니다.')
      }

      const slotId = slots[0].id

      const allocation = await tx.allocation.create({
        data: {
          slotId,
          subscriptionId,
          status: AllocationStatus.RESERVED,
        },
        include: { slot: { include: { group: true } } },
      })

      await this.audit.log({
        actorId,
        targetType: 'Allocation',
        targetId: allocation.id,
        action: 'SLOT_ALLOCATED',
        after: {
          slotId,
          subscriptionId,
          status: AllocationStatus.RESERVED,
        },
      })

      return allocation
    }, {
      isolationLevel: 'Serializable',
      timeout: 10000,
    })
  }

  async releaseSlot(
    allocationId: string,
    actorId: string,
    notes?: string,
  ) {
    const allocation = await this.db.allocation.findUnique({
      where: { id: allocationId },
    })
    if (!allocation) throw new Error('배정을 찾을 수 없습니다.')
    if (allocation.status === AllocationStatus.RECLAIMED) {
      throw new Error('이미 회수된 배정입니다.')
    }

    const updated = await this.db.allocation.update({
      where: { id: allocationId },
      data: {
        status: AllocationStatus.RECLAIMED,
        reclaimedAt: new Date(),
        reclaimedBy: actorId,
        reclaimNotes: notes,
      },
    })

    await this.audit.log({
      actorId,
      targetType: 'Allocation',
      targetId: allocationId,
      action: 'SLOT_RELEASED',
      before: { status: allocation.status },
      after: { status: AllocationStatus.RECLAIMED },
      reason: notes,
    })

    return updated
  }

  async processWaitlist(productId: string): Promise<number> {
    const waitlistEntries = await this.db.waitlistEntry.findMany({
      where: { productId, status: WaitlistStatus.WAITING },
      include: { subscription: true },
      orderBy: { createdAt: 'asc' },
      take: 10,
    })

    let allocated = 0

    for (const entry of waitlistEntries) {
      if (!entry.subscriptionId) continue

      try {
        await this.allocateSlot(entry.subscriptionId, productId)
        await this.db.waitlistEntry.update({
          where: { id: entry.id },
          data: { status: WaitlistStatus.ALLOCATED },
        })
        allocated++
      } catch {
        // No slots available, stop processing
        break
      }
    }

    return allocated
  }

  async getSlotCapacityByProduct(productId: string) {
    const groups = await this.db.subscriptionGroup.findMany({
      where: { productId, status: 'ACTIVE' },
      include: {
        slots: {
          include: {
            allocations: {
              where: { status: { not: AllocationStatus.RECLAIMED } },
            },
          },
        },
      },
    })

    let totalSlots = 0
    let occupiedSlots = 0
    let availableSlots = 0

    for (const group of groups) {
      const customerSlots = group.totalCapacity - group.adminSlotsReserved
      totalSlots += customerSlots

      for (const slot of group.slots) {
        if (slot.slotIndex < group.adminSlotsReserved) continue // admin slot
        if (slot.allocations.length > 0) {
          occupiedSlots++
        } else {
          availableSlots++
        }
      }
    }

    return { totalSlots, occupiedSlots, availableSlots }
  }
}
