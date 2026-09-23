import { NextRequest } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth/session'
import prisma from '@/lib/db/prisma'
import { apiSuccess, apiError } from '@/lib/utils'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    const isAdmin = ['SUPER_ADMIN', 'OPERATOR', 'SUPPORT'].includes(user.role)

    const ticket = await prisma.ticket.findUnique({
      where: { id: params.id },
      include: {
        user: { select: { email: true, role: true } },
        messages: {
          where: isAdmin ? {} : { isInternal: false },
          include: { author: { select: { email: true, role: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!ticket) return apiError('티켓을 찾을 수 없습니다.', 404)
    if (!isAdmin && ticket.userId !== user.id) return apiError('권한이 없습니다.', 403)

    return apiSuccess(ticket)
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.message, error.code === 'UNAUTHORIZED' ? 401 : 403)
    }
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}
