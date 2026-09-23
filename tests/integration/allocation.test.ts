import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { AllocationService, PaymentService } from '@premium-share/domain'

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

describe.skipIf(skipIntegration)('동시성 - 슬롯 배정', () => {
  const allocationService = new AllocationService(prisma)

  let productId = ''
  let groupId = ''
  let ownerAccountId = ''
  let planId = ''
  let adminUserId = ''
  const userIds: string[] = []
  const orderIds: string[] = []
  const subscriptionIds: string[] = []

  beforeAll(async () => {
    if (!(await canConnect())) {
      throw new Error(`테스트 DB 연결 실패: ${databaseUrl}`)
    }

    const stamp = Date.now()
    const product = await prisma.product.create({
      data: {
        name: `Concurrent Product ${stamp}`,
        serviceType: 'TEST',
        shareMethod: 'TEST',
        reviewStatus: 'APPROVED',
        isActive: true,
        maxSlotsPerGroup: 1,
      },
    })
    productId = product.id

    const ownerAccount = await prisma.ownerAccount.create({
      data: {
        email: `owner-${stamp}@test.local`,
        serviceType: 'TEST',
        country: 'KR',
        status: 'AVAILABLE',
      },
    })
    ownerAccountId = ownerAccount.id

    const group = await prisma.subscriptionGroup.create({
      data: {
        productId,
        ownerAccountId: ownerAccount.id,
        country: 'KR',
        totalCapacity: 1,
        adminSlotsReserved: 0,
        name: `Test Group ${stamp}`,
        status: 'ACTIVE',
        policyVerified: true,
        supplyPaymentStatus: 'ACTIVE',
      },
    })
    groupId = group.id
    await prisma.slot.create({ data: { groupId, slotIndex: 0 } })

    const adminUser = await prisma.user.create({
      data: {
        email: `admin-test-${stamp}@test.local`,
        passwordHash: 'hash',
        role: 'SUPER_ADMIN',
      },
    })
    adminUserId = adminUser.id

    const plan = await prisma.plan.create({
      data: { productId, name: 'Test Plan', durationDays: 30, priceKrw: 1000 },
    })
    planId = plan.id

    for (let i = 0; i < 10; i++) {
      const user = await prisma.user.create({
        data: {
          email: `test-user-${stamp}-${i}@test.local`,
          passwordHash: 'hash',
          role: 'MEMBER',
        },
      })
      userIds.push(user.id)

      const order = await prisma.order.create({
        data: {
          userId: user.id,
          planId: plan.id,
          productId,
          productNameSnapshot: 'Test',
          planNameSnapshot: 'Test Plan',
          durationDaysSnapshot: 30,
          priceKrwSnapshot: 1000,
          status: 'CONFIRMED',
          source: 'DEMO',
          expiresAt: new Date(Date.now() + 86400000),
          idempotencyKey: `test-order-${stamp}-${i}`,
        },
      })
      orderIds.push(order.id)

      const sub = await prisma.subscription.create({
        data: {
          userId: user.id,
          orderId: order.id,
          productId,
          planId: plan.id,
          status: 'WAITING',
        },
      })
      subscriptionIds.push(sub.id)
    }
  }, 60000)

  afterAll(async () => {
    try {
      await prisma.allocation.deleteMany({ where: { slot: { groupId } } })
      await prisma.subscription.deleteMany({ where: { id: { in: subscriptionIds } } })
      await prisma.order.deleteMany({ where: { id: { in: orderIds } } })
      await prisma.slot.deleteMany({ where: { groupId } })
      await prisma.subscriptionGroup.deleteMany({ where: { id: groupId } })
      await prisma.plan.deleteMany({ where: { id: planId } })
      await prisma.ownerAccount.deleteMany({ where: { id: ownerAccountId } })
      await prisma.product.deleteMany({ where: { id: productId } })
      await prisma.user.deleteMany({ where: { id: { in: [...userIds, adminUserId] } } })
    } finally {
      await prisma.$disconnect()
    }
  })

  test('10개 동시 요청 중 1개만 성공 (슬롯 1개)', async () => {
    const results = await Promise.allSettled(
      subscriptionIds.map((subId) => allocationService.allocateSlot(subId, productId)),
    )

    const successes = results.filter((r) => r.status === 'fulfilled')
    const failures = results.filter((r) => r.status === 'rejected')

    expect(successes).toHaveLength(1)
    expect(failures).toHaveLength(9)

    const allocations = await prisma.allocation.findMany({
      where: { slot: { groupId }, status: { not: 'RECLAIMED' } },
    })
    expect(allocations).toHaveLength(1)
  }, 30000)
})

describe.skipIf(skipIntegration)('멱등성 - 결제 확인 중복', () => {
  test('같은 결제 확인을 두 번 호출해도 Payment는 1개만 CONFIRMED', async () => {
    if (!(await canConnect())) {
      throw new Error(`테스트 DB 연결 실패: ${databaseUrl}`)
    }

    const stamp = Date.now()
    const user = await prisma.user.create({
      data: {
        email: `idempotent-${stamp}@test.local`,
        passwordHash: 'hash',
        role: 'MEMBER',
      },
    })

    const adminUser = await prisma.user.create({
      data: {
        email: `admin-idempotent-${stamp}@test.local`,
        passwordHash: 'hash',
        role: 'SUPER_ADMIN',
      },
    })

    const product = await prisma.product.create({
      data: {
        name: `Idempotent Product ${stamp}`,
        serviceType: 'TEST',
        shareMethod: 'TEST',
        reviewStatus: 'APPROVED',
        isActive: true,
        maxSlotsPerGroup: 1,
      },
    })

    const plan = await prisma.plan.create({
      data: { productId: product.id, name: 'Test', durationDays: 30, priceKrw: 5000 },
    })

    // Provide a group/slot so allocation path does not fail loudly
    const owner = await prisma.ownerAccount.create({
      data: {
        email: `owner-idem-${stamp}@test.local`,
        serviceType: 'TEST',
        country: 'KR',
        status: 'AVAILABLE',
      },
    })
    const group = await prisma.subscriptionGroup.create({
      data: {
        productId: product.id,
        ownerAccountId: owner.id,
        country: 'KR',
        totalCapacity: 1,
        adminSlotsReserved: 0,
        name: `Idem Group ${stamp}`,
        status: 'ACTIVE',
        policyVerified: true,
        supplyPaymentStatus: 'ACTIVE',
      },
    })
    await prisma.slot.create({ data: { groupId: group.id, slotIndex: 0 } })

    const order = await prisma.order.create({
      data: {
        userId: user.id,
        planId: plan.id,
        productId: product.id,
        productNameSnapshot: 'Test',
        planNameSnapshot: 'Test',
        durationDaysSnapshot: 30,
        priceKrwSnapshot: 5000,
        status: 'PENDING_PAYMENT',
        source: 'DEMO',
        expiresAt: new Date(Date.now() + 86400000),
        idempotencyKey: `idempotent-order-${stamp}`,
      },
    })

    const idempotencyKey = `idempotent-payment-${stamp}`
    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        amountKrw: 5000,
        status: 'PENDING',
        source: 'DEMO',
        idempotencyKey,
      },
    })

    const paymentService = new PaymentService(prisma)
    const confirmKey = `confirm-${idempotencyKey}`

    const result1 = await paymentService.confirmPayment({
      paymentId: payment.id,
      actorId: adminUser.id,
      idempotencyKey: confirmKey,
    })

    const result2 = await paymentService.confirmPayment({
      paymentId: payment.id,
      actorId: adminUser.id,
      idempotencyKey: confirmKey,
    })

    expect(result1.id).toBe(result2.id)
    expect(result1.status).toBe('CONFIRMED')

    const confirmedPayments = await prisma.payment.findMany({
      where: { orderId: order.id, status: 'CONFIRMED' },
    })
    expect(confirmedPayments).toHaveLength(1)

    await prisma.operationTask.deleteMany({ where: { subscription: { orderId: order.id } } })
    await prisma.invitation.deleteMany({ where: { subscription: { orderId: order.id } } })
    await prisma.allocation.deleteMany({ where: { subscription: { orderId: order.id } } })
    await prisma.subscriptionPeriod.deleteMany({ where: { orderId: order.id } })
    await prisma.notification.deleteMany({ where: { userId: user.id } })
    await prisma.waitlistEntry.deleteMany({ where: { userId: user.id } })
    await prisma.subscription.deleteMany({ where: { orderId: order.id } })
    await prisma.payment.deleteMany({ where: { orderId: order.id } })
    await prisma.order.deleteMany({ where: { id: order.id } })
    await prisma.slot.deleteMany({ where: { groupId: group.id } })
    await prisma.subscriptionGroup.deleteMany({ where: { id: group.id } })
    await prisma.ownerAccount.deleteMany({ where: { id: owner.id } })
    await prisma.plan.deleteMany({ where: { id: plan.id } })
    await prisma.product.deleteMany({ where: { id: product.id } })
    await prisma.auditLog.deleteMany({
      where: { actorId: { in: [user.id, adminUser.id] } },
    })
    await prisma.user.deleteMany({ where: { id: { in: [user.id, adminUser.id] } } })
  }, 60000)
})
