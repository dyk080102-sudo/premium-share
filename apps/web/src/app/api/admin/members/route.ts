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
    const search = url.searchParams.get('search')
    const skip = (page - 1) * limit

    const where = search
      ? { email: { contains: search, mode: 'insensitive' as const } }
      : {}

    const [members, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          loginAttempts: true,
          lockedUntil: true,
          _count: { select: { orders: true, subscriptions: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: { members, total, page, limit, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.message, error.code === 'UNAUTHORIZED' ? 401 : 403)
    }
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}
