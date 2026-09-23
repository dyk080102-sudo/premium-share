import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth, AuthError } from '@/lib/auth/session'
import prisma from '@/lib/db/prisma'
import { OrderService } from '@premium-share/domain'
import { apiError, generateIdempotencyKey } from '@/lib/utils'

const createOrderSchema = z.object({
  planId: z.string().min(1),
  idempotencyKey: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await request.json()
    const parsed = createOrderSchema.safeParse(body)
    if (!parsed.success) return apiError(parsed.error.errors[0].message, 400)

    const orderService = new OrderService(prisma)
    const order = await orderService.createOrder({
      userId: user.id,
      planId: parsed.data.planId,
      idempotencyKey: parsed.data.idempotencyKey ?? generateIdempotencyKey(),
      source: process.env.BUSINESS_MODE === 'DEMO' ? 'DEMO' : 'MANUAL',
    })

    return NextResponse.json({ success: true, data: order }, { status: 201 })
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.message, error.code === 'UNAUTHORIZED' ? 401 : 403)
    }
    if (error instanceof Error) return apiError(error.message, 400)
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') ?? '1')
    const limit = parseInt(url.searchParams.get('limit') ?? '20')

    const orderService = new OrderService(prisma)
    const result = await orderService.listUserOrders(user.id, page, limit)

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.message, error.code === 'UNAUTHORIZED' ? 401 : 403)
    }
    return apiError('서버 오류가 발생했습니다.', 500)
  }
}
