import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import prisma from '@/lib/db/prisma'
import { apiSuccess, apiError } from '@/lib/utils'
import { z } from 'zod'

export async function GET() {
  try {
    await requireRole('SUPER_ADMIN', 'OPERATOR')
    const faqs = await prisma.faq.findMany({
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    })
    return apiSuccess(faqs)
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
      category: z.string().min(1),
      question: z.string().min(1),
      answer: z.string().min(1),
      sortOrder: z.number().int().default(0),
      isActive: z.boolean().default(true),
    })
    const data = schema.parse(body)

    const faq = await prisma.faq.create({ data })
    return apiSuccess(faq, 201)
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
