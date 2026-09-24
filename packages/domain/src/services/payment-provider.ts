/**
 * Payment Provider Interface — PG 연동용 확장 포인트.
 *
 * - MANUAL: ManualBankPaymentProvider (무통장 입금 신고 → 관리자 확인)
 * - DEMO: DemoPaymentProvider (시연용 simulate — BUSINESS_MODE=DEMO 전용)
 * - PG: StubPgPaymentProvider (Toss/Nice 등 추후 구현)
 */

import type { PrismaClient, BusinessSource } from '@prisma/client'

export type PaymentCheckoutResult = {
  paymentId: string
  externalId?: string
  redirectUrl?: string
  status: 'PENDING' | 'REQUIRES_ACTION' | 'CONFIRMED' | 'FAILED'
  message?: string
}

export type PaymentWebhookResult = {
  externalId: string
  status: 'CONFIRMED' | 'FAILED' | 'CANCELLED' | 'REFUNDED'
  amountKrw?: number
  raw?: unknown
}

export type PaymentRefundResult = {
  externalId: string
  payoutRef?: string
  status: 'PENDING' | 'COMPLETED' | 'FAILED'
}

export interface PaymentProvider {
  /** Provider key stored on Payment.provider (e.g. 'manual', 'toss', 'demo') */
  readonly name: string

  /**
   * Start checkout for an order.
   * PG providers typically return a redirect URL; MANUAL creates a pending record.
   */
  createCheckout(input: {
    orderId: string
    amountKrw: number
    userId: string
    depositorName?: string
    notes?: string
    idempotencyKey: string
  }): Promise<PaymentCheckoutResult>

  /**
   * Handle provider webhook / callback. Optional for MANUAL.
   */
  handleWebhook?(
    rawBody: string | Buffer,
    headers: Record<string, string | undefined>,
  ): Promise<PaymentWebhookResult>

  /**
   * Provider-side refund. Optional until PG is wired.
   */
  refund?(input: {
    externalId: string
    amountKrw: number
    reason?: string
  }): Promise<PaymentRefundResult>
}

export class PaymentProviderNotImplementedError extends Error {
  constructor(provider: string, method: string) {
    super(
      `Payment provider "${provider}" does not implement ${method}. PG 연동 전까지 사용할 수 없습니다.`,
    )
    this.name = 'PaymentProviderNotImplementedError'
  }
}

/** Stub PG provider — throws until a real SDK is plugged in. */
export class StubPgPaymentProvider implements PaymentProvider {
  readonly name: string

  constructor(name = 'pg') {
    this.name = name
  }

  async createCheckout(): Promise<PaymentCheckoutResult> {
    throw new PaymentProviderNotImplementedError(this.name, 'createCheckout')
  }

  async handleWebhook(): Promise<PaymentWebhookResult> {
    throw new PaymentProviderNotImplementedError(this.name, 'handleWebhook')
  }

  async refund(): Promise<PaymentRefundResult> {
    throw new PaymentProviderNotImplementedError(this.name, 'refund')
  }
}

/**
 * Production bank-transfer provider.
 * Creates a PENDING MANUAL payment; admin confirmPayment completes it.
 */
export class ManualBankPaymentProvider implements PaymentProvider {
  readonly name = 'manual'

  constructor(private db: PrismaClient) {}

  async createCheckout(input: {
    orderId: string
    amountKrw: number
    userId: string
    depositorName?: string
    notes?: string
    idempotencyKey: string
  }): Promise<PaymentCheckoutResult> {
    if (!input.depositorName?.trim()) {
      throw new Error('입금자명을 입력하세요.')
    }

    const order = await this.db.order.findUnique({ where: { id: input.orderId } })
    if (!order) throw new Error('주문을 찾을 수 없습니다.')
    if (order.userId !== input.userId) throw new Error('접근 권한이 없습니다.')
    if (order.status !== 'PENDING_PAYMENT') throw new Error('결제 대기 상태가 아닙니다.')
    if (order.priceKrwSnapshot !== input.amountKrw) {
      throw new Error('주문 금액과 결제 금액이 일치하지 않습니다.')
    }

    const existing = await this.db.payment.findFirst({
      where: { orderId: order.id, status: { not: 'CANCELLED' } },
    })
    if (existing) throw new Error('이미 결제 정보가 존재합니다.')

    const payment = await this.db.payment.create({
      data: {
        orderId: order.id,
        amountKrw: input.amountKrw,
        status: 'PENDING',
        source: 'MANUAL' as BusinessSource,
        provider: this.name,
        depositorName: input.depositorName.trim(),
        notes: input.notes?.trim() || null,
        idempotencyKey: input.idempotencyKey,
      },
    })

    return {
      paymentId: payment.id,
      status: 'PENDING',
      message: '입금 신고가 접수되었습니다. 관리자 확인 후 처리됩니다.',
    }
  }
}

/** DEMO-only provider — intentionally thin; PaymentService.simulateDemoPayment remains for scenarios. */
export class DemoPaymentProvider implements PaymentProvider {
  readonly name = 'demo'

  async createCheckout(): Promise<PaymentCheckoutResult> {
    throw new Error('DEMO 결제는 /api/demo/payment/simulate 를 사용하세요.')
  }
}

export type PaymentProviderKind = 'manual' | 'demo' | 'pg'

/**
 * Resolve active provider from BUSINESS_MODE / PAYMENT_PROVIDER env.
 * - DEMO → demo (simulate)
 * - MANUAL (default) → manual bank transfer
 * - PAYMENT_PROVIDER=pg → stub (not implemented)
 */
export function resolvePaymentProviderKind(): PaymentProviderKind {
  const explicit = (process.env.PAYMENT_PROVIDER ?? '').toLowerCase()
  if (explicit === 'pg' || explicit === 'toss' || explicit === 'nice') return 'pg'
  if (explicit === 'demo' || process.env.BUSINESS_MODE === 'DEMO') return 'demo'
  return 'manual'
}

export function createPaymentProvider(
  db: PrismaClient,
  kind: PaymentProviderKind = resolvePaymentProviderKind(),
): PaymentProvider {
  if (kind === 'pg') return new StubPgPaymentProvider(process.env.PAYMENT_PROVIDER ?? 'pg')
  if (kind === 'demo') return new DemoPaymentProvider()
  return new ManualBankPaymentProvider(db)
}

/** @deprecated Use createPaymentProvider(db) */
export function createPaymentProviderStub(
  kind: PaymentProviderKind = resolvePaymentProviderKind(),
): PaymentProvider {
  if (kind === 'pg') return new StubPgPaymentProvider(process.env.PAYMENT_PROVIDER ?? 'pg')
  if (kind === 'demo') return new DemoPaymentProvider()
  // Without db, manual cannot create records — callers should use createPaymentProvider(db)
  return {
    name: 'manual',
    async createCheckout(): Promise<PaymentCheckoutResult> {
      throw new Error('createPaymentProvider(db)를 사용해 ManualBankPaymentProvider를 생성하세요.')
    },
  }
}
