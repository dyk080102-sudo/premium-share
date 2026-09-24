import { NextRequest } from 'next/server'
import { requireRole, AuthError } from '@/lib/auth/session'
import prisma from '@/lib/db/prisma'
import { apiSuccess, apiError, getClientIp } from '@/lib/utils'
import { assertSameOrigin, CsrfError } from '@/lib/security'
import { z } from 'zod'

const ROLES = ['MEMBER', 'SUPPORT', 'OPERATOR', 'SUPER_ADMIN'] as const

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await requireRole('SUPER_ADMIN', 'OPERATOR', 'SUPPORT')
    const member = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        loginAttempts: true,
        lockedUntil: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            orders: true,
            subscriptions: true,
            refunds: true,
            tickets: true,
          },
        },
      },
    })
    if (!member) return apiError('회원을 찾을 수 없습니다.', 404)
    return apiSuccess(member)
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.message, error.code === 'UNAUTHORIZED' ? 401 : 403)
    }
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    assertSameOrigin(request)
    const actor = await requireRole('SUPER_ADMIN', 'OPERATOR')
    const body = await request.json()
    const schema = z.object({
      role: z.enum(ROLES).optional(),
      isActive: z.boolean().optional(),
      resetLoginAttempts: z.boolean().optional(),
    })
    const data = schema.parse(body)

    if (data.role !== undefined && actor.role !== 'SUPER_ADMIN') {
      return apiError('역할 변경은 최고 관리자만 가능합니다.', 403)
    }

    if (
      data.role === undefined &&
      data.isActive === undefined &&
      !data.resetLoginAttempts
    ) {
      return apiError('변경할 항목이 없습니다.', 400)
    }

    const target = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true, email: true, role: true, isActive: true },
    })
    if (!target) return apiError('회원을 찾을 수 없습니다.', 404)

    if (target.id === actor.id && data.isActive === false) {
      return apiError('본인 계정을 비활성화할 수 없습니다.', 400)
    }

    if (
      target.role === 'SUPER_ADMIN' &&
      ((data.role && data.role !== 'SUPER_ADMIN') || data.isActive === false)
    ) {
      const otherAdmins = await prisma.user.count({
        where: { role: 'SUPER_ADMIN', isActive: true, id: { not: target.id } },
      })
      if (otherAdmins === 0) {
        return apiError('유일한 최고 관리자는 강등·비활성화할 수 없습니다.', 400)
      }
    }

    if (actor.role === 'OPERATOR' && target.role === 'SUPER_ADMIN' && data.isActive === false) {
      return apiError('최고 관리자 계정은 운영자가 비활성화할 수 없습니다.', 403)
    }

    const updateData: Record<string, unknown> = {}
    if (data.role !== undefined) updateData.role = data.role
    if (data.isActive !== undefined) updateData.isActive = data.isActive
    if (data.resetLoginAttempts) {
      updateData.loginAttempts = 0
      updateData.lockedUntil = null
    }

    const before = { role: target.role, isActive: target.isActive }
    const member = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        loginAttempts: true,
        lockedUntil: true,
      },
    })

    const ip = getClientIp(request)
    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        actorRole: actor.role,
        targetType: 'User',
        targetId: member.id,
        action: 'MEMBER_PERMISSIONS_UPDATE',
        beforeJson: before,
        afterJson: { role: member.role, isActive: member.isActive },
        reason: data.role
          ? `역할 ${before.role} → ${member.role}`
          : data.isActive !== undefined
            ? `활성 ${before.isActive} → ${member.isActive}`
            : '로그인 잠금 해제',
        source: process.env.BUSINESS_MODE === 'DEMO' ? 'DEMO' : 'MANUAL',
        ipAddress: ip,
      },
    })

    return apiSuccess(member)
  } catch (error) {
    if (error instanceof CsrfError) return apiError(error.message, 403, 'CSRF')
    if (error instanceof AuthError) {
      return apiError(error.message, error.code === 'UNAUTHORIZED' ? 401 : 403)
    }
    if (error instanceof z.ZodError) {
      return apiError('입력값이 올바르지 않습니다.', 400)
    }
    console.error('Member PATCH error:', error)
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}
