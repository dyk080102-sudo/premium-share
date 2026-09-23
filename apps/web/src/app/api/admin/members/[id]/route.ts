import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import prisma from '@/lib/db/prisma'
import { apiSuccess, apiError } from '@/lib/utils'
import { z } from 'zod'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
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
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return apiError('권한이 없습니다.', 403)
    }
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireRole('SUPER_ADMIN', 'OPERATOR')
    const body = await request.json()
    const schema = z.object({
      role: z.enum(['MEMBER', 'SUPPORT', 'OPERATOR', 'SUPER_ADMIN']).optional(),
      isActive: z.boolean().optional(),
      // Unlock account
      resetLoginAttempts: z.boolean().optional(),
    })
    const data = schema.parse(body)

    // Only SUPER_ADMIN can change roles
    if (data.role && user.role !== 'SUPER_ADMIN') {
      return apiError('역할 변경은 최고 관리자만 가능합니다.', 403)
    }

    const updateData: Record<string, unknown> = {}
    if (data.role !== undefined) updateData.role = data.role
    if (data.isActive !== undefined) updateData.isActive = data.isActive
    if (data.resetLoginAttempts) {
      updateData.loginAttempts = 0
      updateData.lockedUntil = null
    }

    const member = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
      select: { id: true, email: true, role: true, isActive: true, loginAttempts: true },
    })

    return apiSuccess(member)
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return apiError('권한이 없습니다.', 403)
    }
    if (error instanceof z.ZodError) {
      return apiError('입력값이 올바르지 않습니다.', 400)
    }
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}
