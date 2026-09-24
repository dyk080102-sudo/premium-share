import { cookies } from 'next/headers'
import prisma from '@/lib/db/prisma'

export type BankAccountSettings = {
  bankName: string
  account: string
  accountHolder: string
}

const DEFAULTS: BankAccountSettings = {
  bankName: '국민은행',
  account: '000-0000-0000',
  accountHolder: '(주)프리미엄쉐어',
}

/** Load bank deposit info from AppSetting (admin-editable). */
export async function getBankAccountSettings(): Promise<BankAccountSettings> {
  const rows = await prisma.appSetting.findMany({
    where: {
      key: { in: ['bank.name', 'bank.account', 'bank.account_holder'] },
    },
  })
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  return {
    bankName: map['bank.name'] || DEFAULTS.bankName,
    account: map['bank.account'] || DEFAULTS.account,
    accountHolder: map['bank.account_holder'] || DEFAULTS.accountHolder,
  }
}

/** Escape user text for safe HTML rendering (XSS defense for any HTML email/templates). */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * CSRF defense for cookie-authenticated mutating requests.
 * SameSite=Lax covers most cases; this rejects cross-site Origin mismatches.
 */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')
  const host = request.headers.get('host')
  const allowed = process.env.NEXTAUTH_URL || process.env.APP_URL || (host ? `http://${host}` : null)

  if (!origin && !referer) {
    // Non-browser clients (curl, server-to-server) — allow when no Origin
    return
  }

  const candidate = origin || (referer ? new URL(referer).origin : '')
  if (!candidate || !allowed) return

  try {
    const allowedOrigin = new URL(allowed).origin
    const requestOrigin = new URL(candidate).origin
    if (requestOrigin !== allowedOrigin) {
      throw new CsrfError('잘못된 요청 출처입니다.')
    }
  } catch (e) {
    if (e instanceof CsrfError) throw e
    throw new CsrfError('잘못된 요청 출처입니다.')
  }
}

export class CsrfError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CsrfError'
  }
}

/** Simple in-memory rate limiter (per-process). Enough for single-instance deploy. */
const rateBuckets = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now()
  const bucket = rateBuckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true }
  }
  if (bucket.count >= limit) {
    return { ok: false, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) }
  }
  bucket.count += 1
  return { ok: true }
}

export async function getSessionTokenFromCookies(): Promise<string | null> {
  const store = await cookies()
  return store.get('ps_session')?.value ?? null
}
