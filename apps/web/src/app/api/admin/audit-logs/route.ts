import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import prisma from '@/lib/db/prisma'
import { apiSuccess, apiError } from '@/lib/utils'

export async function GET(request: NextRequest) {
  try {
    await requireRole('SUPER_ADMIN', 'OPERATOR')
    const { searchParams } = new URL(request.url)
    const targetType = searchParams.get('targetType')
    const action = searchParams.get('action')
    const actorId = searchParams.get('actorId')
    const page = parseInt(searchParams.get('page') ?? '1')
    const limit = parseInt(searchParams.get('limit') ?? '50')
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (targetType) where.targetType = targetType
    if (action) where.action = { contains: action, mode: 'insensitive' }
    if (actorId) where.actorId = actorId

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { actor: { select: { email: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ])

    return apiSuccess({ logs, total, page, limit, totalPages: Math.ceil(total / limit) })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return apiError('권한이 없습니다.', 403)
    }
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}
