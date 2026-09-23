import { NextRequest } from 'next/server'
import { requireRole, AuthError } from '@/lib/auth/session'
import prisma from '@/lib/db/prisma'
import { apiSuccess, apiError } from '@/lib/utils'
import { z } from 'zod'
import { FamilyAutomationMode } from '@prisma/client'
import { AuditService } from '@premium-share/domain'

export async function GET(request: NextRequest) {
  try {
    await requireRole('SUPER_ADMIN', 'OPERATOR', 'SUPPORT')
    const groupId = request.nextUrl.searchParams.get('groupId')

    if (groupId) {
      const setting = await prisma.familyAutomationSetting.findUnique({
        where: { groupId },
      })
      return apiSuccess(setting)
    }

    const settings = await prisma.familyAutomationSetting.findMany({
      include: {
        group: {
          select: {
            id: true,
            name: true,
            ownerAccountId: true,
            totalCapacity: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })
    return apiSuccess(settings)
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.message, error.code === 'UNAUTHORIZED' ? 401 : 403)
    }
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}

const putSchema = z.object({
  groupId: z.string(),
  mode: z.nativeEnum(FamilyAutomationMode).optional(),
  autoInspect: z.boolean().optional(),
  autoCreateGroup: z.boolean().optional(),
  autoInvite: z.boolean().optional(),
  autoRemove: z.boolean().optional(),
  paused: z.boolean().optional(),
  notes: z.string().optional(),
})

export async function PUT(request: NextRequest) {
  try {
    const user = await requireRole('SUPER_ADMIN', 'OPERATOR')
    const body = putSchema.parse(await request.json())

    // AUTHORIZED_BROWSER로 전환 시도 시 잠금 유지 — authorizedEnabled는 항상 false로 강제
    if (body.mode === FamilyAutomationMode.AUTHORIZED_BROWSER) {
      return apiError(
        'AUTHORIZED_BROWSER는 실 UI 미검증으로 잠겨 있습니다. ASSISTED 또는 DEMO만 허용됩니다.',
        400,
        'POLICY_BLOCKED',
      )
    }

    const setting = await prisma.familyAutomationSetting.upsert({
      where: { groupId: body.groupId },
      create: {
        groupId: body.groupId,
        mode: body.mode ?? FamilyAutomationMode.DEMO,
        autoInspect: body.autoInspect ?? true,
        autoCreateGroup: body.autoCreateGroup ?? false,
        autoInvite: body.autoInvite ?? false,
        autoRemove: body.autoRemove ?? false,
        paused: body.paused ?? false,
        authorizedEnabled: false,
        notes: body.notes,
        approvedBy: user.id,
        approvedAt: new Date(),
      },
      update: {
        ...(body.mode !== undefined ? { mode: body.mode } : {}),
        ...(body.autoInspect !== undefined ? { autoInspect: body.autoInspect } : {}),
        ...(body.autoCreateGroup !== undefined
          ? { autoCreateGroup: body.autoCreateGroup }
          : {}),
        ...(body.autoInvite !== undefined ? { autoInvite: body.autoInvite } : {}),
        ...(body.autoRemove !== undefined ? { autoRemove: body.autoRemove } : {}),
        ...(body.paused !== undefined ? { paused: body.paused } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
        authorizedEnabled: false,
      },
    })

    const audit = new AuditService(prisma)
    await audit.log({
      actorId: user.id,
      actorRole: user.role,
      targetType: 'FamilyAutomationSetting',
      targetId: setting.id,
      action: 'FAMILY_SETTINGS_UPDATED',
      after: {
        mode: setting.mode,
        paused: setting.paused,
        authorizedEnabled: setting.authorizedEnabled,
      },
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
