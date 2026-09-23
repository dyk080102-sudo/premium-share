import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import prisma from '@/lib/db/prisma'
import { apiSuccess, apiError } from '@/lib/utils'
import { z } from 'zod'

export async function GET(request: NextRequest) {
  try {
    await requireRole('SUPER_ADMIN', 'OPERATOR')
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') ?? '1')
    const limit = 30
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (productId) where.productId = productId
    if (status) where.status = status

    const [groups, total] = await Promise.all([
      prisma.subscriptionGroup.findMany({
        where,
        include: {
          product: { select: { name: true } },
          ownerAccount: { select: { email: true } },
          slots: { include: { allocations: { where: { status: { not: 'RECLAIMED' } } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.subscriptionGroup.count({ where }),
    ])

    return apiSuccess({ groups, total, page, limit })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return apiError('권한이 없습니다.', 403)
    }
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole('SUPER_ADMIN', 'OPERATOR')
    const body = await request.json()
    const schema = z.object({
      productId: z.string(),
      name: z.string().min(1),
      totalCapacity: z.number().int().positive(),
      adminSlotsReserved: z.number().int().min(0).default(1),
      country: z.string().default('KR'),
      ownerAccountId: z.string(),
      operatorNotes: z.string().optional(),
    })
    const data = schema.parse(body)

    const group = await prisma.$transaction(async (tx) => {
      const g = await tx.subscriptionGroup.create({
        data: {
          productId: data.productId,
          name: data.name,
          totalCapacity: data.totalCapacity,
          adminSlotsReserved: data.adminSlotsReserved,
          country: data.country,
          ownerAccountId: data.ownerAccountId,
          operatorNotes: data.operatorNotes ?? null,
          status: 'ACTIVE',
          supplyPaymentStatus: 'ACTIVE',
          policyVerified: false,
        },
      })

      // Create slots
      const slotData = Array.from({ length: data.totalCapacity }, (_, i) => ({
        groupId: g.id,
        slotIndex: i,
      }))
      await tx.slot.createMany({ data: slotData })

      return g
    })

    return apiSuccess(group, 201)
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
