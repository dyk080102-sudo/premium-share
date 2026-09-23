import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/db/prisma'
import { verifyPassword } from '@/lib/auth/password'
import { createSession, setSessionCookie } from '@/lib/auth/session'
import { apiError, getClientIp } from '@/lib/utils'

const MAX_LOGIN_ATTEMPTS = 5
const LOCK_DURATION_MS = 15 * 60 * 1000 // 15 minutes

const loginSchema = z.object({
  email: z.string().email('유효한 이메일을 입력하세요.'),
  password: z.string().min(1, '비밀번호를 입력하세요.'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = loginSchema.safeParse(body)

    if (!parsed.success) {
      return apiError(parsed.error.errors[0].message, 400)
    }

    const { email, password } = parsed.data

    const user = await prisma.user.findUnique({ where: { email } })

    if (!user) {
      return apiError('이메일 또는 비밀번호가 올바르지 않습니다.', 401)
    }

    if (!user.isActive) {
      return apiError('비활성화된 계정입니다. 관리자에게 문의하세요.', 403)
    }

    // Check lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000)
      return apiError(`계정이 잠겼습니다. ${minutesLeft}분 후 다시 시도하세요.`, 423)
    }

    const isValid = await verifyPassword(user.passwordHash, password)

    if (!isValid) {
      const newAttempts = user.loginAttempts + 1
      const shouldLock = newAttempts >= MAX_LOGIN_ATTEMPTS

      await prisma.user.update({
        where: { id: user.id },
        data: {
          loginAttempts: newAttempts,
          lockedUntil: shouldLock ? new Date(Date.now() + LOCK_DURATION_MS) : null,
        },
      })

      if (shouldLock) {
        return apiError('로그인 실패가 5회를 초과했습니다. 15분 후 다시 시도하세요.', 423)
      }

      return apiError('이메일 또는 비밀번호가 올바르지 않습니다.', 401)
    }

    // Reset login attempts on success
    await prisma.user.update({
      where: { id: user.id },
      data: { loginAttempts: 0, lockedUntil: null },
    })

    const ip = getClientIp(request)
    const ua = request.headers.get('user-agent') ?? undefined
    const token = await createSession(user.id, ip, ua)

    const response = NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      },
    })

    const cookie = setSessionCookie(token)
    response.cookies.set(cookie)

    return response
  } catch (error) {
    console.error('Login error:', error)
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}
