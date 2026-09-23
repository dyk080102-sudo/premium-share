import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/auth/session'
import prisma from '@/lib/db/prisma'
import { apiSuccess, apiError } from '@/lib/utils'
import { z } from 'zod'

export async function GET() {
  try {
    await requireRole('SUPER_ADMIN')
    const settings = await prisma.appSetting.findMany({ orderBy: { key: 'asc' } })
    return apiSuccess(settings)
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return apiError('권한이 없습니다.', 403)
    }
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole('SUPER_ADMIN')
    const body = await request.json()
    const { key, value } = z.object({ key: z.string(), value: z.string() }).parse(body)

    const setting = await prisma.appSetting.upsert({
      where: { key },
      update: { value, updatedBy: user.id },
      create: { key, value, updatedBy: user.id },
    })

    return apiSuccess(setting)
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
