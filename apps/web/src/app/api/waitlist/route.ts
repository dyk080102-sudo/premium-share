import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth, AuthError } from '@/lib/auth/session'
import prisma from '@/lib/db/prisma'
import { apiError } from '@/lib/utils'
import { assertSameOrigin, CsrfError } from '@/lib/security'

const createSchema = z.object({
  productId: z.string().min(1),
  planId: z.string().min(1),
})

/** List current user's waitlist entries */
export async function GET() {
  try {
    const user = await requireAuth()
    const entries = await prisma.waitlistEntry.findMany({
      where: { userId: user.id },
      include: {
        product: { select: { id: true, name: true } },
        plan: { select: { id: true, name: true, priceKrw: true, durationDays: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ success: true, data: entries })
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.message, error.code === 'UNAUTHORIZED' ? 401 : 403)
    }
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}

/** Join waitlist for a product/plan (when no slots available after payment, system also auto-adds) */
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request)
    const user = await requireAuth()
    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return apiError(parsed.error.errors[0].message, 400)

    const product = await prisma.product.findUnique({ where: { id: parsed.data.productId } })
    if (!product || !product.isActive) return apiError('상품을 찾을 수 없습니다.', 404)

    const plan = await prisma.plan.findUnique({ where: { id: parsed.data.planId } })
    if (!plan || plan.productId !== product.id || !plan.isActive) {
      return apiError('플랜을 찾을 수 없습니다.', 404)
    }

    const existing = await prisma.waitlistEntry.findFirst({
      where: {
        userId: user.id,
        productId: product.id,
        status: 'WAITING',
      },
    })
    if (existing) {
      return NextResponse.json({ success: true, data: existing, message: '이미 대기열에 등록되어 있습니다.' })
    }

    const entry = await prisma.waitlistEntry.create({
      data: {
        userId: user.id,
        productId: product.id,
        planId: plan.id,
        status: 'WAITING',
      },
    })

    return NextResponse.json({ success: true, data: entry }, { status: 201 })
  } catch (error) {
    if (error instanceof CsrfError) return apiError(error.message, 403, 'CSRF')
    if (error instanceof AuthError) {
      return apiError(error.message, error.code === 'UNAUTHORIZED' ? 401 : 403)
    }
    if (error instanceof Error) return apiError(error.message, 400)
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}
