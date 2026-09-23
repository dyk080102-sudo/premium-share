import { NextRequest, NextResponse } from 'next/server'
import { requireRole, AuthError } from '@/lib/auth/session'
import prisma from '@/lib/db/prisma'
import { apiError } from '@/lib/utils'

export async function GET(request: NextRequest) {
  try {
    await requireRole('SUPER_ADMIN', 'OPERATOR', 'SUPPORT')

    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') ?? '1')
    const limit = parseInt(url.searchParams.get('limit') ?? '20')
    const status = url.searchParams.get('status')
    const skip = (page - 1) * limit

    const where = status ? { status: status as 'RESERVED' | 'INVITED' | 'ACTIVE' | 'PENDING_RECLAIM' | 'RECLAIMED' } : {}

    const [allocations, total] = await Promise.all([
      prisma.allocation.findMany({
        where,
        include: {
          slot: { include: { group: { include: { product: true } } } },
          subscription: { include: { user: { select: { email: true } } } },
          invitations: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.allocation.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: { allocations, total, page, limit, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.message, error.code === 'UNAUTHORIZED' ? 401 : 403)
    }
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}
