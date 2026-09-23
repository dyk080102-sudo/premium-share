import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth/session'
import { SubscriptionService } from '@premium-share/domain'
import prisma from '@/lib/db/prisma'
import { apiError } from '@/lib/utils'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth()
    const service = new SubscriptionService(prisma)
    const subscription = await service.getSubscriptionById(params.id, user.id)

    if (!subscription) return apiError('구독을 찾을 수 없습니다.', 404)
    return NextResponse.json({ success: true, data: subscription })
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.message, error.code === 'UNAUTHORIZED' ? 401 : 403)
    }
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}
