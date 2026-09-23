import { cookies } from 'next/headers'
import crypto from 'crypto'
import { createHash } from 'crypto'
import prisma from '@/lib/db/prisma'
import type { UserRole } from '@prisma/client'

export const SESSION_COOKIE_NAME = 'ps_session'
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function createSession(
  userId: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<string> {
  const token = generateSessionToken()
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)

  await prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      ipAddress,
      userAgent,
    },
  })

  return token
}

export async function getSession(token: string) {
  const tokenHash = hashToken(token)

  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
        },
      },
    },
  })

  if (!session) return null
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } })
    return null
  }
  if (!session.user.isActive) return null

  // Update lastSeenAt (no await for performance)
  prisma.session
    .update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
    })
    .catch(() => {})

  return session
}

export async function deleteSession(token: string): Promise<void> {
  const tokenHash = hashToken(token)
  await prisma.session.deleteMany({ where: { tokenHash } })
}

export async function getCurrentUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null

  const session = await getSession(token)
  return session?.user ?? null
}

export interface SessionUser {
  id: string
  email: string
  role: UserRole
  isActive: boolean
}

export async function requireAuth(): Promise<SessionUser> {
  const user = await getCurrentUser()
  if (!user) {
    throw new AuthError('UNAUTHORIZED', '로그인이 필요합니다.')
  }
  return user
}

export async function requireRole(...roles: UserRole[]): Promise<SessionUser> {
  const user = await requireAuth()
  if (!roles.includes(user.role)) {
    throw new AuthError('FORBIDDEN', '접근 권한이 없습니다.')
  }
  return user
}

export class AuthError extends Error {
  constructor(
    public code: 'UNAUTHORIZED' | 'FORBIDDEN',
    message: string,
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

export function setSessionCookie(token: string) {
  const isProduction = process.env.NODE_ENV === 'production'
  return {
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    maxAge: SESSION_DURATION_MS / 1000,
    path: '/',
  }
}
