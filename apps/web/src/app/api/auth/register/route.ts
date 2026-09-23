import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/db/prisma'
import { hashPassword, validatePasswordStrength } from '@/lib/auth/password'
import { createSession, setSessionCookie } from '@/lib/auth/session'
import { apiError, getClientIp } from '@/lib/utils'

const registerSchema = z.object({
  email: z.string().email('유효한 이메일을 입력하세요.'),
  password: z.string().min(8, '비밀번호는 최소 8자 이상이어야 합니다.'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = registerSchema.safeParse(body)

    if (!parsed.success) {
      return apiError(parsed.error.errors[0].message, 400)
    }

    const { email, password } = parsed.data

    // Check password strength
    const strength = validatePasswordStrength(password)
    if (!strength.valid) {
      return apiError(strength.message!, 400)
    }

    // Check if email already exists
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return apiError('이미 사용 중인 이메일입니다.', 409)
    }

    const passwordHash = await hashPassword(password)

    const user = await prisma.user.create({
      data: { email, passwordHash, role: 'MEMBER' },
      select: { id: true, email: true, role: true },
    })

    const ip = getClientIp(request)
    const ua = request.headers.get('user-agent') ?? undefined
    const token = await createSession(user.id, ip, ua)

    const response = NextResponse.json({
      success: true,
      data: { user },
    }, { status: 201 })

    const cookie = setSessionCookie(token)
    response.cookies.set(cookie)

    return response
  } catch (error) {
    console.error('Register error:', error)
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}
