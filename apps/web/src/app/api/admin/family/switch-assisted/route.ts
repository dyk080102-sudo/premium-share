import { NextRequest } from 'next/server'
import { requireRole, AuthError } from '@/lib/auth/session'
import prisma from '@/lib/db/prisma'
import { apiSuccess, apiError } from '@/lib/utils'
import { AuditService } from '@premium-share/domain'
import { FamilyAutomationMode } from '@prisma/client'
import { z } from 'zod'

const schema = z.object({
  groupId: z.string(),
})

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole('SUPER_ADMIN', 'OPERATOR')
    const body = schema.parse(await request.json())

    const setting = await prisma.familyAutomationSetting.upsert({
      where: { groupId: body.groupId },
      create: {
        groupId: body.groupId,
        mode: FamilyAutomationMode.ASSISTED,
        authorizedEnabled: false,
        notes: 'Switched to ASSISTED — no real browser automation',
        approvedBy: user.id,
        approvedAt: new Date(),
      },
      update: {
        mode: FamilyAutomationMode.ASSISTED,
        authorizedEnabled: false,
        notes: 'Switched to ASSISTED — no real browser automation',
        approvedBy: user.id,
        approvedAt: new Date(),
      },
    })

    const audit = new AuditService(prisma)
    await audit.log({
      actorId: user.id,
      actorRole: user.role,
      targetType: 'FamilyAutomationSetting',
      targetId: setting.id,
      action: 'FAMILY_SWITCH_ASSISTED',
      after: { mode: setting.mode },
    })

    return apiSuccess(setting)
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
