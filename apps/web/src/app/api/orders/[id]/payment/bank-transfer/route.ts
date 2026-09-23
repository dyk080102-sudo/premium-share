import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth, AuthError } from '@/lib/auth/session'
import prisma from '@/lib/db/prisma'
import { apiError, generateIdempotencyKey } from '@/lib/utils'

const schema = z.object({
  depositorName: z.string().min(1, '입금자명을 입력하세요.'),
  notes: z.string().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth()
    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return apiError(parsed.error.errors[0].message, 400)

    const order = await prisma.order.findUnique({ where: { id: params.id } })
    if (!order) return apiError('주문을 찾을 수 없습니다.', 404)
    if (order.userId !== user.id) return apiError('접근 권한이 없습니다.', 403)
    if (order.status !== 'PENDING_PAYMENT') return apiError('결제 대기 상태가 아닙니다.', 400)

    // Check existing payment
    const existingPayment = await prisma.payment.findFirst({
      where: { orderId: order.id, status: { not: 'CANCELLED' } },
    })
    if (existingPayment) return apiError('이미 결제 정보가 존재합니다.', 409)

    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        amountKrw: order.priceKrwSnapshot,
        status: 'PENDING',
        source: 'MANUAL',
        idempotencyKey: generateIdempotencyKey(),
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: payment,
        message: '입금 신고가 접수되었습니다. 관리자 확인 후 처리됩니다.',
      },
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.message, error.code === 'UNAUTHORIZED' ? 401 : 403)
    }
    if (error instanceof Error) return apiError(error.message, 400)
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}
