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
    await requireRole('SUPER_ADMIN', 'OPERATOR')
    const product = await prisma.product.findUnique({
      where: { id: params.id },
      include: {
        plans: { orderBy: { durationDays: 'asc' } },
        _count: { select: { orders: true, subscriptions: true, subscriptionGroups: true } },
      },
    })
    if (!product) return apiError('상품을 찾을 수 없습니다.', 404)
    return apiSuccess(product)
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
      reviewStatus: z.enum(['PENDING', 'APPROVED', 'BLOCKED']).optional(),
      reviewNote: z.string().optional(),
      isActive: z.boolean().optional(),
      sortOrder: z.number().int().optional(),
      onboardingGuide: z.string().optional(),
      maxSlotsPerGroup: z.number().int().positive().optional(),
    })
    const data = schema.parse(body)

    const updateData: Record<string, unknown> = { ...data }
    if (data.reviewStatus) {
      updateData.reviewedAt = new Date()
      updateData.reviewedBy = user.id
    }

    const product = await prisma.product.update({
      where: { id: params.id },
      data: updateData,
    })

    return apiSuccess(product)
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
