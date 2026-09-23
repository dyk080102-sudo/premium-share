import { NextRequest } from 'next/server'
import { requireRole, AuthError } from '@/lib/auth/session'
import prisma from '@/lib/db/prisma'
import { apiSuccess, apiError } from '@/lib/utils'
import { FamilyJobService } from '@premium-share/domain'
import { FamilyJobType, FamilyAutomationMode } from '@prisma/client'
import { z } from 'zod'

const schema = z.object({
  groupId: z.string(),
})

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole('SUPER_ADMIN', 'OPERATOR')
    const { groupId } = schema.parse(await request.json())

    const group = await prisma.subscriptionGroup.findUnique({
      where: { id: groupId },
    })
    if (!group) return apiError('그룹을 찾을 수 없습니다.', 404)

    const setting = await prisma.familyAutomationSetting.findUnique({
      where: { groupId },
    })

    const jobs = new FamilyJobService(prisma)
    const job = await jobs.enqueue({
      type: FamilyJobType.INSPECT,
      groupId,
      ownerAccountId: group.ownerAccountId,
      idempotencyKey: `inspect:${groupId}:${Date.now()}`,
      mode: setting?.mode ?? FamilyAutomationMode.DEMO,
      actorId: user.id,
    })

    return apiSuccess(job)
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.message, error.code === 'UNAUTHORIZED' ? 401 : 403)
    }
    if (error instanceof z.ZodError) {
      return apiError('입력값이 올바르지 않습니다.', 400)
    }
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}
