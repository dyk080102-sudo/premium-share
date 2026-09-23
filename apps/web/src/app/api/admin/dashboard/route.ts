import { NextRequest, NextResponse } from 'next/server'
import { requireRole, AuthError } from '@/lib/auth/session'
import prisma from '@/lib/db/prisma'
import { apiError } from '@/lib/utils'

export async function GET(request: NextRequest) {
  try {
    await requireRole('SUPER_ADMIN', 'OPERATOR', 'SUPPORT')

    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)

    const [
      totalMembers,
      activeSubscriptions,
      pendingPayments,
      pendingTasks,
      pendingRefunds,
      recentOrders,
      expiringSubscriptions,
      revenue30d,
      newMembers30d,
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'MEMBER', isActive: true } }),
      prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      prisma.payment.count({ where: { status: 'PENDING' } }),
      prisma.operationTask.count({ where: { status: { in: ['PENDING', 'IN_PROGRESS'] } } }),
      prisma.refund.count({ where: { status: { in: ['REQUESTED', 'REVIEWING'] } } }),
      prisma.order.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        select: { id: true, status: true, priceKrwSnapshot: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.subscription.count({
        where: {
          status: 'EXPIRING',
          expiresAt: { gte: now, lte: threeDaysFromNow },
        },
      }),
      prisma.payment.aggregate({
        where: {
          status: 'CONFIRMED',
          confirmedAt: { gte: thirtyDaysAgo },
        },
        _sum: { amountKrw: true },
      }),
      prisma.user.count({
        where: {
          role: 'MEMBER',
          createdAt: { gte: thirtyDaysAgo },
        },
      }),
    ])

    // Slot capacity stats
    const groups = await prisma.subscriptionGroup.findMany({
      where: { status: 'ACTIVE' },
      select: { totalCapacity: true, adminSlotsReserved: true },
    })
    const totalSlots = groups.reduce((sum, g) => sum + g.totalCapacity - g.adminSlotsReserved, 0)
    const occupiedSlots = await prisma.allocation.count({
      where: { status: { not: 'RECLAIMED' } },
    })

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalMembers,
          activeSubscriptions,
          pendingPayments,
          pendingTasks,
          pendingRefunds,
          expiringSubscriptions,
          revenue30d: revenue30d._sum.amountKrw ?? 0,
          newMembers30d,
        },
        slots: {
          total: totalSlots,
          occupied: occupiedSlots,
          available: Math.max(0, totalSlots - occupiedSlots),
          utilizationRate: totalSlots > 0 ? Math.round((occupiedSlots / totalSlots) * 100) : 0,
        },
        recentOrders,
        alerts: {
          hasPendingPayments: pendingPayments > 0,
          hasPendingTasks: pendingTasks > 0,
          hasPendingRefunds: pendingRefunds > 0,
          hasExpiringSubscriptions: expiringSubscriptions > 0,
        },
      },
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.message, error.code === 'UNAUTHORIZED' ? 401 : 403)
    }
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}
