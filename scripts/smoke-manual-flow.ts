/**
 * Production MANUAL flow smoke test against a live Postgres.
 *
 * Usage:
 *   BUSINESS_MODE=MANUAL DATABASE_URL=... npx tsx scripts/smoke-manual-flow.ts
 */
import { PrismaClient } from '@prisma/client'
import {
  OrderService,
  PaymentService,
  createPaymentProvider,
} from '../packages/domain/src/index'

async function main() {
  process.env.BUSINESS_MODE = process.env.BUSINESS_MODE ?? 'MANUAL'
  const db = new PrismaClient()

  const email = `smoke-${Date.now()}@premiumshare.test`
  const passwordHash =
    '$argon2id$v=19$m=65536,t=3,p=4$c21va2VzbW9rZXNtb2tl$+m6Y8z9u0d9yQ0v0v0v0v0v0v0v0v0v0v0v0v0v0' // placeholder — we only need a user row

  // Prefer an existing seed member if present
  let user = await db.user.findFirst({ where: { email: 'member1@premiumshare.demo' } })
  if (!user) {
    user = await db.user.create({
      data: {
        email,
        passwordHash: passwordHash.slice(0, 80),
        role: 'MEMBER',
      },
    })
  }

  const plan = await db.plan.findFirst({
    where: { isActive: true, product: { isActive: true, reviewStatus: 'APPROVED' } },
    include: { product: true },
  })
  if (!plan) throw new Error('No active plan — run npm run db:seed first')

  const orderService = new OrderService(db)
  const order = await orderService.createOrder({
    userId: user.id,
    planId: plan.id,
    idempotencyKey: `smoke-${Date.now()}`,
    source: 'MANUAL',
  })
  if (order.source !== 'MANUAL') throw new Error(`Expected MANUAL order, got ${order.source}`)

  const provider = createPaymentProvider(db, 'manual')
  const checkout = await provider.createCheckout({
    orderId: order.id,
    amountKrw: order.priceKrwSnapshot,
    userId: user.id,
    depositorName: '스모크테스터',
    notes: 'smoke-manual-flow',
    idempotencyKey: `pay-${Date.now()}`,
  })
  if (checkout.status !== 'PENDING') throw new Error('Expected PENDING checkout')

  const payment = await db.payment.findUniqueOrThrow({ where: { id: checkout.paymentId } })
  if (payment.depositorName !== '스모크테스터') throw new Error('depositorName not persisted')
  if (payment.provider !== 'manual') throw new Error('provider should be manual')
  if (payment.source !== 'MANUAL') throw new Error('source should be MANUAL')

  const paymentService = new PaymentService(db)
  const admin = await db.user.findFirst({
    where: { role: { in: ['SUPER_ADMIN', 'OPERATOR'] } },
  })
  if (!admin) throw new Error('No admin user for confirm')

  const confirmed = await paymentService.confirmPayment({
    paymentId: payment.id,
    actorId: admin.id,
    notes: 'smoke confirm',
    idempotencyKey: `confirm-${payment.id}`,
  })
  if (confirmed.status !== 'CONFIRMED') throw new Error('Payment not confirmed')

  const updatedOrder = await db.order.findUniqueOrThrow({ where: { id: order.id } })
  if (updatedOrder.status !== 'CONFIRMED') throw new Error('Order not confirmed')

  const subscription = await db.subscription.findFirst({ where: { orderId: order.id } })
  if (!subscription) throw new Error('Subscription not created')

  console.log(
    JSON.stringify(
      {
        ok: true,
        orderId: order.id,
        paymentId: payment.id,
        subscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
        businessMode: process.env.BUSINESS_MODE,
      },
      null,
      2,
    ),
  )

  await db.$disconnect()
}

main().catch(async (err) => {
  console.error('SMOKE FAILED:', err)
  process.exit(1)
})
