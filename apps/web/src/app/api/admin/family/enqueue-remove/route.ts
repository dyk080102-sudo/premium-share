import { NextRequest } from 'next/server'
import { requireRole, AuthError } from '@/lib/auth/session'
import prisma from '@/lib/db/prisma'
import { apiSuccess, apiError } from '@/lib/utils'
import { FamilyRemovalService } from '@premium-share/domain'
import { z } from 'zod'

const schema = z.object({
  groupId: z.string(),
  targetEmail: z.string().email(),
  allocationId: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole('SUPER_ADMIN', 'OPERATOR')
    const body = schema.parse(await request.json())

    const group = await prisma.subscriptionGroup.findUnique({
      where: { id: body.groupId },
    })
    if (!group) return apiError('그룹을 찾을 수 없습니다.', 404)

    const removal = new FamilyRemovalService(prisma)
    const job = await removal.enqueueRemove({
      groupId: body.groupId,
      targetEmail: body.targetEmail,
      allocationId: body.allocationId,
      actorId: user.id,
    })

    return apiSuccess(job)
  } catch (error) {
    if (error instanceof AuthError) return apiError(error.message, 403)
    if (error instanceof z.ZodError) return apiError('입력값이 올바르지 않습니다.', 400)
    if (error instanceof Error) return apiError(error.message, 400)
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}
