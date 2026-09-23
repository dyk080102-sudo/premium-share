import { NextRequest, NextResponse } from 'next/server'
import { requireRole, AuthError } from '@/lib/auth/session'
import prisma from '@/lib/db/prisma'
import { apiError } from '@/lib/utils'

export async function GET() {
  try {
    await requireRole('SUPER_ADMIN', 'OPERATOR', 'SUPPORT')
    const groups = await prisma.subscriptionGroup.findMany({
      include: {
        ownerAccount: true,
        familyAutomationSetting: true,
        familyLink: { include: { externalMembers: true } },
        familyJobs: { orderBy: { requestedAt: 'desc' }, take: 5 },
        product: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    const emergency = await prisma.appSetting.findUnique({
      where: { key: 'FAMILY_EMERGENCY_STOP' },
    })

    return NextResponse.json({
      success: true,
      data: {
        emergencyStop: emergency?.value === 'true',
        groups,
        authorizedBrowserEnabled: process.env.AUTHORIZED_BROWSER_ENABLED === 'true',
        note: 'AUTHORIZED_BROWSER는 실 UI 미검증 시 잠금. 운영자 동의≠Google 공식 허가.',
      },
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.message, error.code === 'UNAUTHORIZED' ? 401 : 403)
    }
    return apiError('서버 오류', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireRole('SUPER_ADMIN', 'OPERATOR')
    const body = await request.json()
    if (body.action === 'emergency-stop') {
      await prisma.appSetting.upsert({
        where: { key: 'FAMILY_EMERGENCY_STOP' },
        create: {
          key: 'FAMILY_EMERGENCY_STOP',
          value: body.enabled ? 'true' : 'false',
          description: '가족 자동화 전체 긴급 중지',
          updatedBy: actor.id,
        },
        update: { value: body.enabled ? 'true' : 'false', updatedBy: actor.id },
      })
      return NextResponse.json({ success: true })
    }
    return apiError('unknown action', 400)
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.message, error.code === 'UNAUTHORIZED' ? 401 : 403)
    }
    return apiError('서버 오류', 500)
  }
}
