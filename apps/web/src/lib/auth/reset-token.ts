import crypto from 'crypto'
import { createHash } from 'crypto'
import prisma from '@/lib/db/prisma'
import { AuthTokenType } from '@prisma/client'

const TOKEN_EXPIRY_MS = 60 * 60 * 1000 // 1 hour

export function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function createPasswordResetToken(userId: string): Promise<string> {
  const token = generateResetToken()
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS)

  // Invalidate existing tokens
  await prisma.authToken.updateMany({
    where: {
      userId,
      type: AuthTokenType.PASSWORD_RESET,
      usedAt: null,
    },
    data: { usedAt: new Date() },
  })

  await prisma.authToken.create({
    data: {
      userId,
      type: AuthTokenType.PASSWORD_RESET,
      tokenHash,
      expiresAt,
    },
  })

  return token
}

export async function validatePasswordResetToken(token: string) {
  const tokenHash = hashToken(token)

  const authToken = await prisma.authToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  })

  if (!authToken) return null
  if (authToken.usedAt) return null
  if (authToken.expiresAt < new Date()) return null
  if (authToken.type !== AuthTokenType.PASSWORD_RESET) return null

  return authToken
}

export async function consumePasswordResetToken(tokenId: string): Promise<void> {
  await prisma.authToken.update({
    where: { id: tokenId },
    data: { usedAt: new Date() },
  })
}
