import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { apiError } from '@/lib/utils'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const product = await prisma.product.findUnique({
    where: { id: params.id, isActive: true, reviewStatus: 'APPROVED' },
    include: {
      plans: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
      refundPolicies: { where: { isActive: true }, take: 1 },
    },
  })

  if (!product) return apiError('상품을 찾을 수 없습니다.', 404)
  return NextResponse.json({ success: true, data: product })
}
