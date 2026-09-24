import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'
import { runWorkerTick } from '@/server/worker-jobs'
import { apiError } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Vercel Cron entrypoint — runs expire/waitlist/outbox ticks on serverless.
 * Secure with CRON_SECRET (Authorization: Bearer <secret>) or Vercel Cron header.
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const isVercelCron = Boolean(request.headers.get('x-vercel-cron'))

  if (cronSecret) {
    const ok = auth === `Bearer ${cronSecret}` || isVercelCron
    if (!ok) return apiError('Unauthorized', 401)
  } else if (process.env.NODE_ENV === 'production' && !isVercelCron) {
    // Avoid public abuse when secret not set: only allow Vercel Cron invocations
    if (!isVercelCron) return apiError('CRON_SECRET not configured', 503)
  }

  try {
    const result = await runWorkerTick(prisma)
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('cron tick error:', error)
    return apiError(error instanceof Error ? error.message : 'cron failed', 500)
  }
}
