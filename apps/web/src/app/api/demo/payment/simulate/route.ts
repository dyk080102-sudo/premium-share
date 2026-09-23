import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth, AuthError } from '@/lib/auth/session'
import { PaymentService } from '@premium-share/domain'
import prisma from '@/lib/db/prisma'
import { apiError } from '@/lib/utils'

const schema = z.object({
  orderId: z.string().min(1),
  scenario: z.enum(['success', 'fail', 'cancel']),
})

export async function POST(request: NextRequest) {
  if (process.env.BUSINESS_MODE !== 'DEMO') {
    return NextResponse.json({ error: 'DEMO 모드에서만 사용 가능합니다.' }, { status: 405 })
  }

  try {
    const user = await requireAuth()
    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return apiError(parsed.error.errors[0].message, 400)

    const paymentService = new PaymentService(prisma)
    const result = await paymentService.simulateDemoPayment({
      orderId: parsed.data.orderId,
      scenario: parsed.data.scenario,
      actorId: user.id,
    })

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.message, error.code === 'UNAUTHORIZED' ? 401 : 403)
    }
    if (error instanceof Error) return apiError(error.message, 400)
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}
