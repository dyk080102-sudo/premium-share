import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth/session'
import prisma from '@/lib/db/prisma'
import { apiError } from '@/lib/utils'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireAuth()

    const refund = await prisma.refund.findUnique({
      where: { id: params.id },
      include: { order: true, payment: true },
    })

    if (!refund) return apiError('환불을 찾을 수 없습니다.', 404)
    if (refund.userId !== user.id) return apiError('접근 권한이 없습니다.', 403)

    return NextResponse.json({ success: true, data: refund })
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.message, error.code === 'UNAUTHORIZED' ? 401 : 403)
    }
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}
