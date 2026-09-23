import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth/session'
import { SubscriptionService } from '@premium-share/domain'
import prisma from '@/lib/db/prisma'
import { apiError } from '@/lib/utils'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth()
    const service = new SubscriptionService(prisma)
    const order = await service.createRenewalOrder(params.id, user.id)

    return NextResponse.json({ success: true, data: order }, { status: 201 })
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.message, error.code === 'UNAUTHORIZED' ? 401 : 403)
    }
    if (error instanceof Error) return apiError(error.message, 400)
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}
