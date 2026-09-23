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
    const group = await prisma.subscriptionGroup.findUnique({
      where: { id: params.id },
      include: {
        product: true,
        ownerAccount: true,
        slots: {
          include: {
            allocations: {
              include: {
                subscription: { include: { user: { select: { email: true } } } },
                invitations: { orderBy: { createdAt: 'desc' }, take: 1 },
              },
              where: { status: { not: 'RECLAIMED' } },
            },
          },
          orderBy: { slotIndex: 'asc' },
        },
        expenses: { orderBy: { paidAt: 'desc' }, take: 10 },
      },
    })
    if (!group) return apiError('그룹을 찾을 수 없습니다.', 404)
    return apiSuccess(group)
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
      status: z.enum(['ACTIVE', 'SUSPENDED', 'CLOSED']).optional(),
      supplyPaymentStatus: z.enum(['ACTIVE', 'EXPIRING', 'SUSPENDED']).optional(),
      supplyNextRenewalAt: z.string().datetime().optional().nullable(),
      policyVerified: z.boolean().optional(),
      operatorNotes: z.string().optional(),
    })
    const data = schema.parse(body)

    const group = await prisma.subscriptionGroup.update({
      where: { id: params.id },
      data,
    })

    return apiSuccess(group)
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
