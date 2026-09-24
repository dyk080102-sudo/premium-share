import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { apiError } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(_request: NextRequest) {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true, reviewStatus: 'APPROVED' },
      include: {
        plans: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { sortOrder: 'asc' },
    })

    return NextResponse.json({ success: true, data: products })
  } catch (error) {
    console.error('GET /api/products error:', error)
    return apiError(
      error instanceof Error ? error.message : '상품을 불러오지 못했습니다.',
      503,
      'DB_UNAVAILABLE',
    )
  }
}
