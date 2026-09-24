import type { PrismaClient } from '@prisma/client'
import type { CsvAccount } from './csv-allocator.types'

export type CsvFamilyPersistResult = {
  ownersUpserted: number
  groupsUpserted: number
  membersSynced: number
  ownerEmails: string[]
  groupIds: string[]
}

/**
 * Persist CSV family-share accounts into OwnerAccount / SubscriptionGroup /
 * FamilyGroupLink / FamilyExternalMember so they appear on the admin website.
 */
export class CsvFamilyPersistService {
  constructor(private readonly db: PrismaClient) {}

  async persistAccounts(
    accounts: CsvAccount[],
    options?: { productId?: string; actorId?: string },
  ): Promise<CsvFamilyPersistResult> {
    const product =
      (options?.productId
        ? await this.db.product.findUnique({ where: { id: options.productId } })
        : null) ??
      (await this.db.product.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
      }))

    if (!product) {
      throw new Error('활성 상품이 없어 가족 그룹을 생성할 수 없습니다.')
    }

    const byGroup = new Map<string, CsvAccount[]>()
    for (const acc of accounts) {
      if (!acc.family_group_id) continue
      if (acc.status === 'REFUNDED' || acc.status === 'BLOCKED_POLICY') continue
      const list = byGroup.get(acc.family_group_id) ?? []
      list.push(acc)
      byGroup.set(acc.family_group_id, list)
    }

    let ownersUpserted = 0
    let groupsUpserted = 0
    let membersSynced = 0
    const ownerEmails: string[] = []
    const groupIds: string[] = []

    for (const [csvGroupId, members] of byGroup) {
      const manager =
        members.find((m) => m.role === 'MANAGER') ??
        members.find((m) => m.status === 'PAID') ??
        members[0]

      if (!manager) continue

      let owner = await this.db.ownerAccount.findFirst({
        where: { email: manager.email },
      })

      if (!owner) {
        owner = await this.db.ownerAccount.create({
          data: {
            email: manager.email,
            serviceType: product.serviceType || product.name,
            country: 'KR',
            status: 'AVAILABLE',
            verifiedAt: new Date(),
            notes: `CSV import (${csvGroupId})`,
          },
        })
        ownersUpserted++
      } else {
        owner = await this.db.ownerAccount.update({
          where: { id: owner.id },
          data: {
            status: 'AVAILABLE',
            verifiedAt: owner.verifiedAt ?? new Date(),
            notes: `CSV import (${csvGroupId})`,
          },
        })
        ownersUpserted++
      }
      ownerEmails.push(owner.email)

      let link = await this.db.familyGroupLink.findFirst({
        where: { externalGroupKey: csvGroupId },
        include: { group: true },
      })

      let groupId: string
      if (link) {
        groupId = link.subscriptionGroupId
        await this.db.subscriptionGroup.update({
          where: { id: groupId },
          data: {
            ownerAccountId: owner.id,
            status: 'ACTIVE',
            supplyPaymentStatus: 'ACTIVE',
            name: link.group.name || `가족그룹 ${csvGroupId}`,
          },
        })
        await this.db.familyGroupLink.update({
          where: { id: link.id },
          data: {
            ownerAccountId: owner.id,
            adminEmailObserved: manager.email,
            planActiveConfirmed: true,
            planCheckedAt: new Date(),
            capacityTotal: Math.max(members.length, 6),
            lastInspectedAt: new Date(),
            lastInspectStatus: 'CSV_IMPORT',
            linkedAt: link.linkedAt ?? new Date(),
          },
        })
        groupsUpserted++
      } else {
        const capacity = Math.max(6, members.length)
        const group = await this.db.subscriptionGroup.create({
          data: {
            productId: product.id,
            ownerAccountId: owner.id,
            country: 'KR',
            totalCapacity: capacity,
            adminSlotsReserved: 1,
            name: `가족공유 · ${manager.email}`,
            supplyPaymentStatus: 'ACTIVE',
            status: 'ACTIVE',
            policyVerified: true,
            operatorNotes: `CSV family_group_id=${csvGroupId}`,
          },
        })
        groupId = group.id

        await this.db.slot.createMany({
          data: Array.from({ length: capacity }, (_, i) => ({
            groupId: group.id,
            slotIndex: i,
          })),
          skipDuplicates: true,
        })

        link = await this.db.familyGroupLink.create({
          data: {
            subscriptionGroupId: group.id,
            ownerAccountId: owner.id,
            externalGroupKey: csvGroupId,
            adminEmailObserved: manager.email,
            planActiveConfirmed: true,
            planCheckedAt: new Date(),
            capacityTotal: capacity,
            adminSeats: 1,
            lastInspectedAt: new Date(),
            lastInspectStatus: 'CSV_IMPORT',
            linkedAt: new Date(),
          },
          include: { group: true },
        })

        await this.db.familyAutomationSetting.upsert({
          where: { groupId: group.id },
          create: {
            groupId: group.id,
            mode: 'DEMO',
            autoInspect: true,
            autoCreateGroup: false,
            autoInvite: false,
            autoRemove: false,
            paused: false,
            authorizedEnabled: false,
            notes: 'CSV import',
            approvedBy: options?.actorId,
            approvedAt: options?.actorId ? new Date() : undefined,
          },
          update: {
            mode: 'DEMO',
            paused: false,
          },
        })

        groupsUpserted++
      }

      groupIds.push(groupId)

      // Sync external members from CSV rows
      for (const m of members) {
        const kind = m.role === 'MANAGER' ? 'ADMIN' : 'MEMBER'
        await this.db.familyExternalMember.upsert({
          where: {
            linkId_email_kind: {
              linkId: link!.id,
              email: m.email,
              kind,
            },
          },
          create: {
            linkId: link!.id,
            email: m.email,
            kind,
            externalStatus: 'JOINED',
            managedByUs: true,
            observedAt: new Date(),
          },
          update: {
            externalStatus: 'JOINED',
            managedByUs: true,
            observedAt: new Date(),
          },
        })
        membersSynced++
      }
    }

    // Persist last imported CSV snapshot for audit/download
    const csvLines = [
      'account_id,email,status,family_group_id,role,joined_at,updated_at',
      ...accounts.map((a) =>
        [
          a.account_id,
          a.email,
          a.status,
          a.family_group_id ?? '',
          a.role ?? '',
          a.joined_at ?? '',
          a.updated_at ?? '',
        ].join(','),
      ),
    ].join('\n')

    await this.db.appSetting.upsert({
      where: { key: 'family.csv_last_import' },
      create: {
        key: 'family.csv_last_import',
        value: csvLines,
        description: '마지막 CSV 가족공유 반영 스냅샷',
        updatedBy: options?.actorId,
      },
      update: {
        value: csvLines,
        updatedBy: options?.actorId,
      },
    })

    return {
      ownersUpserted,
      groupsUpserted,
      membersSynced,
      ownerEmails: Array.from(new Set(ownerEmails)),
      groupIds,
    }
  }
}
