import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/session'
import { verifyPassword, hashPassword, validatePasswordStrength } from '@/lib/auth/password'
import prisma from '@/lib/db/prisma'
import { apiError } from '@/lib/utils'
import { AuthError } from '@/lib/auth/session'

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
})

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return apiError(parsed.error.errors[0].message, 400)

    const strength = validatePasswordStrength(parsed.data.newPassword)
    if (!strength.valid) return apiError(strength.message!, 400)

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
    if (!dbUser) return apiError('사용자를 찾을 수 없습니다.', 404)

    const isValid = await verifyPassword(dbUser.passwordHash, parsed.data.currentPassword)
    if (!isValid) return apiError('현재 비밀번호가 올바르지 않습니다.', 401)

    const passwordHash = await hashPassword(parsed.data.newPassword)
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } })

    // Invalidate all other sessions
    await prisma.session.deleteMany({ where: { userId: user.id } })

    return NextResponse.json({ success: true, message: '비밀번호가 변경되었습니다.' })
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.message, error.code === 'UNAUTHORIZED' ? 401 : 403)
    }
    console.error('Password change error:', error)
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}
