import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth, AuthError } from '@/lib/auth/session'
import prisma from '@/lib/db/prisma'
import { apiError, generateIdempotencyKey } from '@/lib/utils'
import { assertSameOrigin, CsrfError } from '@/lib/security'
import { AuditService, createPaymentProvider } from '@premium-share/domain'

const schema = z.object({
  depositorName: z
    .string()
    .trim()
    .min(1, '입금자명을 입력하세요.')
    .max(40, '입금자명은 40자 이하여야 합니다.'),
  notes: z.string().trim().max(200).optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    assertSameOrigin(request)
    const user = await requireAuth()
    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return apiError(parsed.error.errors[0].message, 400)

    const order = await prisma.order.findUnique({ where: { id: params.id } })
    if (!order) return apiError('주문을 찾을 수 없습니다.', 404)
    if (order.userId !== user.id) return apiError('접근 권한이 없습니다.', 403)
    if (order.status !== 'PENDING_PAYMENT') return apiError('결제 대기 상태가 아닙니다.', 400)

    const provider = createPaymentProvider(prisma, 'manual')
    const result = await provider.createCheckout({
      orderId: order.id,
      amountKrw: order.priceKrwSnapshot,
      userId: user.id,
      depositorName: parsed.data.depositorName,
      notes: parsed.data.notes,
      idempotencyKey: generateIdempotencyKey(),
    })

    const audit = new AuditService(prisma)
    await audit.log({
      actorId: user.id,
      targetType: 'Payment',
      targetId: result.paymentId,
      action: 'BANK_TRANSFER_REPORTED',
      after: {
        orderId: order.id,
        amountKrw: order.priceKrwSnapshot,
        depositorName: parsed.data.depositorName,
      },
      source: 'MANUAL',
    })

    return NextResponse.json(
      {
        success: true,
        data: result,
        message: result.message ?? '입금 신고가 접수되었습니다. 관리자 확인 후 처리됩니다.',
      },
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof CsrfError) return apiError(error.message, 403, 'CSRF')
    if (error instanceof AuthError) {
      return apiError(error.message, error.code === 'UNAUTHORIZED' ? 401 : 403)
    }
    if (error instanceof Error) return apiError(error.message, 400)
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}
