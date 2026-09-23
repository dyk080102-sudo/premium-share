import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth, AuthError } from '@/lib/auth/session'
import { RefundService } from '@premium-share/domain'
import prisma from '@/lib/db/prisma'
import { apiError } from '@/lib/utils'

const schema = z.object({
  orderId: z.string().min(1),
  reason: z.string().min(1, '환불 사유를 입력하세요.'),
  notes: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return apiError(parsed.error.errors[0].message, 400)

    const service = new RefundService(prisma)
    const refund = await service.requestRefund({
      orderId: parsed.data.orderId,
      userId: user.id,
      reason: parsed.data.reason,
      notes: parsed.data.notes,
    })

    return NextResponse.json({ success: true, data: refund }, { status: 201 })
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.message, error.code === 'UNAUTHORIZED' ? 401 : 403)
    }
    if (error instanceof Error) return apiError(error.message, 400)
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') ?? '1')
    const limit = parseInt(url.searchParams.get('limit') ?? '20')

    const service = new RefundService(prisma)
    const result = await service.listUserRefunds(user.id, page, limit)

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.message, error.code === 'UNAUTHORIZED' ? 401 : 403)
    }
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}
