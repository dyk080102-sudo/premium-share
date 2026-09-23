import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import prisma from '@/lib/db/prisma'
import { apiSuccess, apiError } from '@/lib/utils'

export async function GET(request: NextRequest) {
  try {
    await requireRole('SUPER_ADMIN', 'OPERATOR')
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const jobType = searchParams.get('jobType')
    const page = parseInt(searchParams.get('page') ?? '1')
    const limit = parseInt(searchParams.get('limit') ?? '50')
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (jobType) where.jobType = jobType

    const [jobs, total] = await Promise.all([
      prisma.jobExecution.findMany({
        where,
        orderBy: { scheduledAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.jobExecution.count({ where }),
    ])

    return apiSuccess({ jobs, total, page, limit, totalPages: Math.ceil(total / limit) })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return apiError('권한이 없습니다.', 403)
    }
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}
