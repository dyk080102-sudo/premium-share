import { NextRequest } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/db/prisma'
import { createPasswordResetToken } from '@/lib/auth/reset-token'
import { apiError } from '@/lib/utils'
import { NextResponse } from 'next/server'

const schema = z.object({
  email: z.string().email(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return apiError('유효한 이메일을 입력하세요.', 400)

    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } })

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({
        success: true,
        message: '이메일이 존재하면 재설정 링크를 발송합니다.',
      })
    }

    const token = await createPasswordResetToken(user.id)

    // Queue outbox message
    await prisma.outboxMessage.create({
      data: {
        type: 'PASSWORD_RESET',
        recipientUserId: user.id,
        recipientContact: user.email,
        subject: '[PremiumShare] 비밀번호 재설정',
        content: `비밀번호 재설정 링크: ${process.env.NEXTAUTH_URL}/auth/reset-password?token=${token}`,
        templateKey: 'password-reset',
        variables: { token, email: user.email },
        source: 'DEMO',
      },
    })

    return NextResponse.json({
      success: true,
      message: '이메일이 존재하면 재설정 링크를 발송합니다.',
    })
  } catch (error) {
    console.error('Reset password request error:', error)
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}
