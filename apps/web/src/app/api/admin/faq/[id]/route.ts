import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import prisma from '@/lib/db/prisma'
import { apiSuccess, apiError } from '@/lib/utils'
import { z } from 'zod'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireRole('SUPER_ADMIN', 'OPERATOR')
    const body = await request.json()
    const schema = z.object({
      category: z.string().optional(),
      question: z.string().optional(),
      answer: z.string().optional(),
      sortOrder: z.number().int().optional(),
      isActive: z.boolean().optional(),
    })
    const data = schema.parse(body)

    const faq = await prisma.faq.update({
      where: { id: params.id },
      data,
    })

    return apiSuccess(faq)
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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireRole('SUPER_ADMIN')
    await prisma.faq.delete({ where: { id: params.id } })
    return apiSuccess({ deleted: true })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return apiError('권한이 없습니다.', 403)
    }
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}
