import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import prisma from '@/lib/db/prisma'
import { apiSuccess, apiError } from '@/lib/utils'
import { z } from 'zod'

const messageSchema = z.object({
  content: z.string().min(1),
  isInternal: z.boolean().default(false),
})

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    const isAdmin = ['SUPER_ADMIN', 'OPERATOR', 'SUPPORT'].includes(user.role)

    const ticket = await prisma.ticket.findUnique({ where: { id: params.id } })
    if (!ticket) return apiError('티켓을 찾을 수 없습니다.', 404)
    if (!isAdmin && ticket.userId !== user.id) return apiError('권한이 없습니다.', 403)
    if (ticket.status === 'CLOSED') return apiError('종료된 티켓에는 메시지를 추가할 수 없습니다.', 400)

    const body = await request.json()
    const data = messageSchema.parse(body)

    // Only admins can post internal messages
    const isInternal = isAdmin && data.isInternal

    const [message] = await prisma.$transaction([
      prisma.ticketMessage.create({
        data: {
          ticketId: ticket.id,
          authorId: user.id,
          content: data.content,
          isInternal,
        },
        include: { author: { select: { email: true, role: true } } },
      }),
      prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          status: isAdmin && ticket.status === 'OPEN' ? 'IN_PROGRESS' : ticket.status,
          updatedAt: new Date(),
        },
      }),
    ])

    return apiSuccess(message, 201)
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return apiError('로그인이 필요합니다.', 401)
    }
    if (error instanceof z.ZodError) {
      return apiError('입력값이 올바르지 않습니다.', 400)
    }
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}
