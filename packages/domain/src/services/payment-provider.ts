/**
 * Payment Provider Interface — PG 연동용 확장 포인트.
 *
 * 실제 Toss/Nice/Stripe 등은 추후 이 인터페이스를 구현해
 * `createPaymentProvider()`에 등록하면 됩니다.
 * 현재는 MANUAL(무통장) + DEMO 스텁만 제공합니다.
 */

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

export function createPaymentProviderStub(
  kind: PaymentProviderKind = resolvePaymentProviderKind(),
): PaymentProvider {
  if (kind === 'pg') return new StubPgPaymentProvider(process.env.PAYMENT_PROVIDER ?? 'pg')
  // MANUAL / DEMO are handled by PaymentService + API routes (DB-backed).
  // This stub exists so call sites can depend on PaymentProvider without PG SDK.
  return {
    name: kind,
    async createCheckout(): Promise<PaymentCheckoutResult> {
      throw new PaymentProviderNotImplementedError(
        kind,
        'createCheckout via PaymentProvider — use PaymentService / bank-transfer API instead',
      )
    },
  }
}
