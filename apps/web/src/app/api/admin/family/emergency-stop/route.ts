import { NextRequest } from 'next/server'
import { requireRole, AuthError } from '@/lib/auth/session'
import prisma from '@/lib/db/prisma'
import { apiSuccess, apiError } from '@/lib/utils'
import { FamilyGateService } from '@premium-share/domain'
import { z } from 'zod'

const schema = z.object({
  stop: z.boolean().optional(),
  active: z.boolean().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole('SUPER_ADMIN', 'OPERATOR')
    const body = schema.parse(await request.json())
    const stop = body.stop ?? body.active
    if (typeof stop !== 'boolean') {
      return apiError('stop 또는 active 불리언이 필요합니다.', 400)
    }

    const gate = new FamilyGateService(prisma)
    await gate.setEmergencyStop(stop, user.id)

    await prisma.appSetting.upsert({
      where: { key: 'FAMILY_EMERGENCY_STOP' },
      create: {
        key: 'FAMILY_EMERGENCY_STOP',
        value: stop ? 'true' : 'false',
        description: '가족 자동화 전체 긴급 중지 (alias)',
        updatedBy: user.id,
      },
      update: {
        value: stop ? 'true' : 'false',
        updatedBy: user.id,
      },
    })

    return apiSuccess({ emergencyStop: stop })
  } catch (error) {
    if (error instanceof AuthError) return apiError(error.message, 403)
    if (error instanceof z.ZodError) return apiError('입력값이 올바르지 않습니다.', 400)
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}
