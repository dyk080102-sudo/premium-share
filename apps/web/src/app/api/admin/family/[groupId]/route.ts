import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole, AuthError } from '@/lib/auth/session'
import prisma from '@/lib/db/prisma'
import { apiError } from '@/lib/utils'
import {
  FamilyJobService,
  FamilyInviteService,
  FamilyRemovalService,
} from '@premium-share/domain'
import { FamilyAutomationMode, FamilyJobType } from '@prisma/client'

export async function GET(
  _request: NextRequest,
  { params }: { params: { groupId: string } },
) {
  try {
    await requireRole('SUPER_ADMIN', 'OPERATOR', 'SUPPORT')
    const group = await prisma.subscriptionGroup.findUnique({
      where: { id: params.groupId },
      include: {
        ownerAccount: true,
        familyAutomationSetting: true,
        familyLink: { include: { externalMembers: true } },
        familyJobs: { orderBy: { requestedAt: 'desc' }, take: 50 },
        familyApprovals: { orderBy: { approvedAt: 'desc' }, take: 20 },
      },
    })
    if (!group) return apiError('그룹 없음', 404)
    return NextResponse.json({ success: true, data: group })
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.message, error.code === 'UNAUTHORIZED' ? 401 : 403)
    }
    return apiError('서버 오류', 500)
  }
}

const patchSchema = z.object({
  action: z.enum([
    'update-settings',
    'pause',
    'enqueue-inspect',
    'enqueue-link',
    'enqueue-invite',
    'enqueue-remove',
    'approve',
    'switch-assisted',
    'record-consent',
  ]),
  mode: z.nativeEnum(FamilyAutomationMode).optional(),
  autoInspect: z.boolean().optional(),
  autoCreateGroup: z.boolean().optional(),
  autoInvite: z.boolean().optional(),
  autoRemove: z.boolean().optional(),
  paused: z.boolean().optional(),
  allocationId: z.string().optional(),
  targetEmail: z.string().optional(),
  jobType: z.nativeEnum(FamilyJobType).optional(),
  scopeNote: z.string().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: { groupId: string } },
) {
  try {
    const actor = await requireRole('SUPER_ADMIN', 'OPERATOR')
    const body = patchSchema.parse(await request.json())
    const group = await prisma.subscriptionGroup.findUnique({
      where: { id: params.groupId },
    })
    if (!group) return apiError('그룹 없음', 404)

    if (body.action === 'update-settings' || body.action === 'pause' || body.action === 'switch-assisted') {
      const mode =
        body.action === 'switch-assisted' ? FamilyAutomationMode.ASSISTED : body.mode

      if (mode === FamilyAutomationMode.AUTHORIZED_BROWSER && process.env.AUTHORIZED_BROWSER_ENABLED !== 'true') {
        return apiError('AUTHORIZED_BROWSER는 실 UI 미검증으로 활성화할 수 없습니다.', 400)
      }

      const setting = await prisma.familyAutomationSetting.upsert({
        where: { groupId: params.groupId },
        create: {
          groupId: params.groupId,
          mode: mode ?? FamilyAutomationMode.DEMO,
          autoInspect: body.autoInspect ?? true,
          autoCreateGroup: body.autoCreateGroup ?? false,
          autoInvite: body.autoInvite ?? false,
          autoRemove: body.autoRemove ?? false,
          paused: body.paused ?? false,
          authorizedEnabled: mode === FamilyAutomationMode.AUTHORIZED_BROWSER,
          approvedBy: actor.id,
          approvedAt: new Date(),
        },
        update: {
          ...(mode ? { mode } : {}),
          ...(body.autoInspect != null ? { autoInspect: body.autoInspect } : {}),
          ...(body.autoCreateGroup != null ? { autoCreateGroup: body.autoCreateGroup } : {}),
          ...(body.autoInvite != null ? { autoInvite: body.autoInvite } : {}),
          ...(body.autoRemove != null ? { autoRemove: body.autoRemove } : {}),
          ...(body.paused != null ? { paused: body.paused } : {}),
          authorizedEnabled: mode === FamilyAutomationMode.AUTHORIZED_BROWSER,
          approvedBy: actor.id,
          approvedAt: new Date(),
        },
      })
      return NextResponse.json({ success: true, data: setting })
    }

    if (body.action === 'record-consent') {
      const consent = await prisma.familyOwnerConsent.create({
        data: {
          ownerAccountId: group.ownerAccountId,
          consentedBy: actor.id,
          scopeNote: body.scopeNote ?? '운영 계정 가족 관리 자동화 범위',
          evidenceNote:
            '본 동의는 플랫폼 운영 동의이며 Google/YouTube의 공식 허가가 아닙니다.',
          isActive: true,
        },
      })
      return NextResponse.json({ success: true, data: consent })
    }

    if (body.action === 'approve' && body.jobType) {
      const approval = await prisma.familyApproval.create({
        data: {
          groupId: params.groupId,
          jobType: body.jobType,
          scopeJson: { note: body.scopeNote ?? 'operator approval' },
          approvedBy: actor.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
        },
      })
      return NextResponse.json({ success: true, data: approval })
    }

    const jobService = new FamilyJobService(prisma)
    if (body.action === 'enqueue-inspect' || body.action === 'enqueue-link') {
      const job = await jobService.enqueue({
        type:
          body.action === 'enqueue-link'
            ? FamilyJobType.LINK_OR_CREATE_GROUP
            : FamilyJobType.INSPECT,
        groupId: params.groupId,
        ownerAccountId: group.ownerAccountId,
        actorId: actor.id,
        idempotencyKey: `${body.action}-${params.groupId}-${Date.now()}`,
      })
      return NextResponse.json({ success: true, data: job })
    }

    if (body.action === 'enqueue-invite') {
      if (!body.allocationId) return apiError('allocationId 필요', 400)
      const orch = new FamilyInviteService(prisma)
      const job = await orch.enqueueInvite({
        groupId: params.groupId,
        allocationId: body.allocationId,
        actorId: actor.id,
        idempotencyKey: `invite-${body.allocationId}-${Date.now()}`,
      })
      return NextResponse.json({ success: true, data: job })
    }

    if (body.action === 'enqueue-remove') {
      if (!body.targetEmail) return apiError('targetEmail 필요', 400)
      const orch = new FamilyRemovalService(prisma)
      const job = await orch.enqueueRemove({
        groupId: params.groupId,
        targetEmail: body.targetEmail,
        allocationId: body.allocationId,
        actorId: actor.id,
        idempotencyKey: `remove-${params.groupId}-${body.targetEmail}-${Date.now()}`,
      })
      return NextResponse.json({ success: true, data: job })
    }

    return apiError('unknown action', 400)
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.message, error.code === 'UNAUTHORIZED' ? 401 : 403)
    }
    if (error instanceof z.ZodError) return apiError(error.errors[0].message, 400)
    if (error instanceof Error) return apiError(error.message, 400)
    return apiError('서버 오류', 500)
  }
}
