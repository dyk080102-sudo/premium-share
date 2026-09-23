import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const products = await prisma.product.findMany({
    where: { isActive: true, reviewStatus: 'APPROVED' },
    include: {
      plans: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
    },
    orderBy: { sortOrder: 'asc' },
  })

  return NextResponse.json({ success: true, data: products })
}
