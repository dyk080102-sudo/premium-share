import { NextRequest, NextResponse } from 'next/server'
import { requireRole, AuthError } from '@/lib/auth/session'
import prisma from '@/lib/db/prisma'
import { apiError } from '@/lib/utils'

export async function GET(request: NextRequest) {
  try {
    await requireRole('SUPER_ADMIN', 'OPERATOR')

    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') ?? '1')
    const limit = parseInt(url.searchParams.get('limit') ?? '20')
    const status = url.searchParams.get('status')
    const skip = (page - 1) * limit

    const where = status ? { status: status as 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'REFUNDED' } : {}

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          order: { include: { user: { select: { id: true, email: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.payment.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: { payments, total, page, limit, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.message, error.code === 'UNAUTHORIZED' ? 401 : 403)
    }
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}
