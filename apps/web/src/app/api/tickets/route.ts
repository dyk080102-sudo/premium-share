import { NextRequest } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth/session'
import prisma from '@/lib/db/prisma'
import { apiSuccess, apiError } from '@/lib/utils'
import { z } from 'zod'

const createTicketSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  orderId: z.string().optional(),
  subscriptionId: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') ?? '1')
    const limit = parseInt(searchParams.get('limit') ?? '20')
    const skip = (page - 1) * limit

    // Admin can see all tickets
    const isAdmin = ['SUPER_ADMIN', 'OPERATOR', 'SUPPORT'].includes(user.role)
    const where = isAdmin ? {} : { userId: user.id }

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        include: {
          user: { select: { email: true } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.ticket.count({ where }),
    ])

    return apiSuccess({ tickets, total, page, limit, totalPages: Math.ceil(total / limit) })
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.message, error.code === 'UNAUTHORIZED' ? 401 : 403, error.code)
    }
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await request.json()
    const data = createTicketSchema.parse(body)

    const ticket = await prisma.ticket.create({
      data: {
        userId: user.id,
        title: data.title,
        priority: data.priority,
        status: 'OPEN',
        orderId: data.orderId,
        subscriptionId: data.subscriptionId,
        messages: {
          create: {
            authorId: user.id,
            content: data.content,
            isInternal: false,
          },
        },
      },
      include: { messages: true },
    })

    return apiSuccess(ticket, 201)
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.message, error.code === 'UNAUTHORIZED' ? 401 : 403, error.code)
    }
    if (error instanceof z.ZodError) {
      return apiError('입력값이 올바르지 않습니다.', 400, 'VALIDATION_ERROR')
    }
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}
