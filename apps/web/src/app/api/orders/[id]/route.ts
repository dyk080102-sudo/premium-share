import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth/session'
import { OrderService } from '@premium-share/domain'
import prisma from '@/lib/db/prisma'
import { apiError } from '@/lib/utils'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth()
    const orderService = new OrderService(prisma)
    const order = await orderService.getOrderById(params.id, user.id)

    if (!order) return apiError('주문을 찾을 수 없습니다.', 404)
    return NextResponse.json({ success: true, data: order })
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.message, error.code === 'UNAUTHORIZED' ? 401 : 403)
    }
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth()
    const orderService = new OrderService(prisma)

    const order = await orderService.getOrderById(params.id, user.id)
    if (!order) return apiError('주문을 찾을 수 없습니다.', 404)

    const cancelled = await orderService.cancelOrder(params.id, user.id, '사용자 직접 취소')
    return NextResponse.json({ success: true, data: cancelled })
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.message, error.code === 'UNAUTHORIZED' ? 401 : 403)
    }
    if (error instanceof Error) return apiError(error.message, 400)
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}
