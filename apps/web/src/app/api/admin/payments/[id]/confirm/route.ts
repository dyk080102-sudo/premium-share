import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole, AuthError } from '@/lib/auth/session'
import { PaymentService } from '@premium-share/domain'
import prisma from '@/lib/db/prisma'
import { apiError, generateIdempotencyKey } from '@/lib/utils'

const schema = z.object({
  notes: z.string().optional(),
  idempotencyKey: z.string().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const actor = await requireRole('SUPER_ADMIN', 'OPERATOR')
    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return apiError(parsed.error.errors[0].message, 400)

    const service = new PaymentService(prisma)
    const payment = await service.confirmPayment({
      paymentId: params.id,
      actorId: actor.id,
      notes: parsed.data.notes,
      idempotencyKey: parsed.data.idempotencyKey ?? generateIdempotencyKey(),
    })

    return NextResponse.json({ success: true, data: payment })
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.message, error.code === 'UNAUTHORIZED' ? 401 : 403)
    }
    if (error instanceof Error) return apiError(error.message, 400)
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}
