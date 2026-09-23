import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth/session'
import { NotificationService } from '@premium-share/domain'
import prisma from '@/lib/db/prisma'
import { apiError } from '@/lib/utils'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') ?? '1')
    const limit = parseInt(url.searchParams.get('limit') ?? '20')
    const skip = (page - 1) * limit

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where: { userId: user.id } }),
      prisma.notification.count({ where: { userId: user.id, isRead: false } }),
    ])

    return NextResponse.json({
      success: true,
      data: { notifications, total, page, limit, unreadCount },
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.message, error.code === 'UNAUTHORIZED' ? 401 : 403)
    }
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}
