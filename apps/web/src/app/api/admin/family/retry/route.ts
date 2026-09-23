import { NextRequest } from 'next/server'
import { requireRole, AuthError } from '@/lib/auth/session'
import prisma from '@/lib/db/prisma'
import { apiSuccess, apiError } from '@/lib/utils'
import { FamilyJobService } from '@premium-share/domain'
import { z } from 'zod'

const schema = z.object({
  jobId: z.string(),
})

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole('SUPER_ADMIN', 'OPERATOR')
    const body = schema.parse(await request.json())
    const jobs = new FamilyJobService(prisma)
    const updated = await jobs.retry(body.jobId, user.id)
    return apiSuccess(updated)
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.message, error.code === 'UNAUTHORIZED' ? 401 : 403)
    }
    if (error instanceof z.ZodError) {
      return apiError('입력값이 올바르지 않습니다.', 400)
    }
    if (error instanceof Error) {
      return apiError(error.message, 400)
    }
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}
