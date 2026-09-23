import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validatePasswordResetToken, consumePasswordResetToken } from '@/lib/auth/reset-token'
import { hashPassword, validatePasswordStrength } from '@/lib/auth/password'
import prisma from '@/lib/db/prisma'
import { apiError } from '@/lib/utils'

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return apiError(parsed.error.errors[0].message, 400)

    const strength = validatePasswordStrength(parsed.data.password)
    if (!strength.valid) return apiError(strength.message!, 400)

    const authToken = await validatePasswordResetToken(parsed.data.token)
    if (!authToken) return apiError('유효하지 않거나 만료된 재설정 링크입니다.', 400)

    const passwordHash = await hashPassword(parsed.data.password)

    await prisma.$transaction([
      prisma.user.update({
        where: { id: authToken.userId },
        data: { passwordHash, loginAttempts: 0, lockedUntil: null },
      }),
      prisma.session.deleteMany({ where: { userId: authToken.userId } }),
    ])

    await consumePasswordResetToken(authToken.id)

    return NextResponse.json({ success: true, message: '비밀번호가 재설정되었습니다.' })
  } catch (error) {
    console.error('Reset confirm error:', error)
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}
