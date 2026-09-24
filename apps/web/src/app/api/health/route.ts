import { NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Liveness + DB connectivity for Vercel / ops. */
export async function GET() {
  const started = Date.now()
  const payload: Record<string, unknown> = {
    ok: false,
    service: 'premium-share',
    businessMode: process.env.BUSINESS_MODE ?? null,
    paymentProvider: process.env.PAYMENT_PROVIDER ?? null,
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    region: process.env.VERCEL_REGION ?? null,
  }

  try {
    await prisma.$queryRaw`SELECT 1`
    const [products, users] = await Promise.all([
      prisma.product.count(),
      prisma.user.count(),
    ])
    payload.ok = true
    payload.db = { connected: true, products, users }
    payload.latencyMs = Date.now() - started
    return NextResponse.json(payload, { status: 200 })
  } catch (error) {
    payload.db = {
      connected: false,
      error: error instanceof Error ? error.message : String(error),
    }
    payload.latencyMs = Date.now() - started
    return NextResponse.json(payload, { status: 503 })
  }
}
