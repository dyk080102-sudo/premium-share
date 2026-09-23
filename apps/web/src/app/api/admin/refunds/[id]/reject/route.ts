import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole, AuthError } from '@/lib/auth/session'
import prisma from '@/lib/db/prisma'
import { apiError } from '@/lib/utils'

const schema = z.object({
  notes: z.string().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const actor = await requireRole('SUPER_ADMIN', 'OPERATOR')
    const body = await request.json().catch(() => ({}))
    const parsed = schema.safeParse(body)
    if (!parsed.success) return apiError(parsed.error.errors[0].message, 400)

    const refund = await prisma.refund.findUnique({ where: { id: params.id } })
    if (!refund) return apiError('환불을 찾을 수 없습니다.', 404)
    if (!['REQUESTED', 'REVIEWING'].includes(refund.status)) {
      return apiError('거절 가능한 상태가 아닙니다.', 400)
    }

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.refund.update({
        where: { id: params.id },
        data: {
          status: 'REJECTED',
          reviewedBy: actor.id,
          reviewedAt: new Date(),
          reviewNotes: parsed.data.notes,
        },
      })
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actorRole: actor.role,
          targetType: 'Refund',
          targetId: params.id,
          action: 'REFUND_REJECTED',
          reason: parsed.data.notes,
          source: refund.source as 'DEMO' | 'MANUAL',
        },
      })
      return u
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.message, error.code === 'UNAUTHORIZED' ? 401 : 403)
    }
    if (error instanceof Error) return apiError(error.message, 400)
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}
