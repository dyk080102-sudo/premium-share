import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import prisma from '@/lib/db/prisma'
import { apiSuccess, apiError } from '@/lib/utils'
import { z } from 'zod'

export async function GET(request: NextRequest) {
  try {
    await requireRole('SUPER_ADMIN', 'OPERATOR')
    const { searchParams } = new URL(request.url)
    const reviewStatus = searchParams.get('reviewStatus')

    const products = await prisma.product.findMany({
      where: reviewStatus ? { reviewStatus: reviewStatus as 'PENDING' | 'APPROVED' | 'BLOCKED' } : {},
      include: {
        plans: { where: { isActive: true } },
        _count: { select: { orders: true, subscriptions: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    })

    return apiSuccess(products)
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return apiError('권한이 없습니다.', 403)
    }
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole('SUPER_ADMIN', 'OPERATOR')
    const body = await request.json()
    const schema = z.object({
      name: z.string().min(1),
      description: z.string(),
      serviceType: z.string(),
      shareMethod: z.string(),
      countryCodes: z.array(z.string()).default([]),
      eligibilityInfo: z.string().optional(),
      isDemoOnly: z.boolean().default(false),
      maxSlotsPerGroup: z.number().int().positive().default(5),
      adminSlotsReserved: z.number().int().min(0).default(1),
      onboardingGuide: z.string().optional(),
    })
    const data = schema.parse(body)

    const product = await prisma.product.create({
      data: {
        ...data,
        reviewStatus: 'PENDING',
        isActive: false,
      },
    })

    return apiSuccess(product, 201)
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
