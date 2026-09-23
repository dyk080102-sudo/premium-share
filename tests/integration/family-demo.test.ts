import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient, FamilyAutomationMode, FamilyJobType } from '@prisma/client'
import {
  calculateAssignableCapacity,
  FamilyJobService,
  FamilyGateService,
} from '@premium-share/domain'

const databaseUrl =
  process.env.DATABASE_TEST_URL ??
  process.env.DATABASE_URL ??
  'postgresql://psuser:pspassword@localhost:5433/premiumshare_test'

const prisma = new PrismaClient({
  datasources: { db: { url: databaseUrl } },
})

const skipIntegration = process.env.SKIP_INTEGRATION === '1'

async function canConnect(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`
    return true
  } catch {
    return false
  }
}

describe.skipIf(skipIntegration)('가족 자동화 DEMO / capacity', () => {
  let connected = false
  let groupId = ''
  let ownerAccountId = ''
  let adminUserId = ''

  beforeAll(async () => {
    connected = await canConnect()
    if (!connected) {
      console.warn(`SKIP family integration: DB unreachable at ${databaseUrl}`)
      return
    }

    try {
      await prisma.$queryRaw`SELECT 1 FROM family_jobs LIMIT 1`
    } catch {
      console.warn('SKIP: family_jobs table missing — run family migration first')
      connected = false
      return
    }

    const stamp = Date.now()
    const admin = await prisma.user.create({
      data: {
        email: `fam-admin-${stamp}@test.local`,
        passwordHash: 'x',
        role: 'SUPER_ADMIN',
      },
    })
    adminUserId = admin.id

    const product = await prisma.product.create({
      data: {
        name: `Fam Product ${stamp}`,
        serviceType: 'TEST',
        shareMethod: 'FAMILY',
        reviewStatus: 'APPROVED',
        isActive: true,
        maxSlotsPerGroup: 5,
      },
    })

    const owner = await prisma.ownerAccount.create({
      data: {
        email: `fam-owner-${stamp}@test.local`,
        serviceType: 'TEST',
        country: 'KR',
        status: 'AVAILABLE',
      },
    })
    ownerAccountId = owner.id

    const group = await prisma.subscriptionGroup.create({
      data: {
        productId: product.id,
        ownerAccountId: owner.id,
        country: 'KR',
        totalCapacity: 5,
        adminSlotsReserved: 1,
        name: `Fam Group ${stamp}`,
        status: 'ACTIVE',
        policyVerified: true,
        supplyPaymentStatus: 'ACTIVE',
      },
    })
    groupId = group.id

    await prisma.familyAutomationSetting.create({
      data: {
        groupId,
        mode: FamilyAutomationMode.DEMO,
        autoInvite: true,
        authorizedEnabled: false,
      },
    })

    await prisma.familyOwnerConsent.create({
      data: {
        ownerAccountId,
        consentedBy: adminUserId,
        scopeNote: 'DEMO only',
        evidenceNote:
          'NON-GOOGLE-OFFICIAL: 데모 운영 동의. Google/YouTube 공식 허가 아님.',
      },
    })

    await prisma.appSetting.upsert({
      where: { key: 'family.global_emergency_stop' },
      create: { key: 'family.global_emergency_stop', value: 'false' },
      update: { value: 'false' },
    })
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  test('capacity contradiction blocks assignable', () => {
    if (!connected) return
    const r = calculateAssignableCapacity({
      capacityTotal: 4,
      adminSeats: 1,
      joinedMembers: 2,
      pendingInvites: 1,
      internalReservations: 1,
      removalPending: 1,
      unmanagedMembers: 0,
    })
    expect(r.contradictory).toBe(true)
    expect(r.assignable).toBe(0)
  })

  test('DEMO job enqueue succeeds with consent', async () => {
    if (!connected) return
    const jobService = new FamilyJobService(prisma)
    const job = await jobService.enqueue({
      type: FamilyJobType.INSPECT,
      groupId,
      ownerAccountId,
      actorId: adminUserId,
      idempotencyKey: `test-inspect-${Date.now()}`,
    })
    expect(job.status).toBe('QUEUED')
    expect(job.mode).toBe('DEMO')
  })

  test('AUTHORIZED_BROWSER gated even if setting forced', async () => {
    if (!connected) return
    await prisma.familyAutomationSetting.update({
      where: { groupId },
      data: { mode: FamilyAutomationMode.AUTHORIZED_BROWSER, authorizedEnabled: false },
    })
    const gate = new FamilyGateService(prisma)
    const result = await gate.assertCanRun({
      groupId,
      jobType: FamilyJobType.INSPECT,
    })
    expect(result.ok).toBe(false)
    expect(
      result.errorCode === 'POLICY_BLOCKED' || result.errorCode === 'REAL_UI_UNVERIFIED',
    ).toBe(true)
    await prisma.familyAutomationSetting.update({
      where: { groupId },
      data: { mode: FamilyAutomationMode.DEMO, authorizedEnabled: false },
    })
  })
})
