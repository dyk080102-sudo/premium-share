import { NextRequest } from 'next/server'
import { requireRole, AuthError } from '@/lib/auth/session'
import prisma from '@/lib/db/prisma'
import { apiSuccess, apiError } from '@/lib/utils'
import { assertSameOrigin, CsrfError } from '@/lib/security'
import { z } from 'zod'

export async function GET() {
  try {
    await requireRole('SUPER_ADMIN')
    const settings = await prisma.appSetting.findMany({ orderBy: { key: 'asc' } })
    return apiSuccess(settings)
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.message, error.code === 'UNAUTHORIZED' ? 401 : 403)
    }
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request)
    const user = await requireRole('SUPER_ADMIN')

    const contentType = request.headers.get('content-type') || ''
    let key: string
    let value: string

    if (contentType.includes('application/json')) {
      const body = await request.json()
      const parsed = z.object({ key: z.string().min(1), value: z.string() }).parse(body)
      key = parsed.key
      value = parsed.value
    } else {
      // Backward-compatible form posts
      const form = await request.formData()
      const parsed = z
        .object({ key: z.string().min(1), value: z.string() })
        .parse({
          key: String(form.get('key') ?? ''),
          value: String(form.get('value') ?? ''),
        })
      key = parsed.key
      value = parsed.value
    }

    const setting = await prisma.appSetting.upsert({
      where: { key },
      update: { value, updatedBy: user.id },
      create: { key, value, updatedBy: user.id },
    })

    return apiSuccess(setting)
  } catch (error) {
    if (error instanceof CsrfError) return apiError(error.message, 403, 'CSRF')
    if (error instanceof AuthError) {
      return apiError(error.message, error.code === 'UNAUTHORIZED' ? 401 : 403)
    }
    if (error instanceof z.ZodError) {
      return apiError('입력값이 올바르지 않습니다.', 400)
    }
    console.error('Settings POST error:', error)
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}
