import { NextRequest, NextResponse } from 'next/server'
import {
  createPaymentProviderStub,
  PaymentProviderNotImplementedError,
  resolvePaymentProviderKind,
} from '@premium-share/domain'
import { apiError } from '@/lib/utils'

/**
 * Future PG webhook endpoint.
 * Currently returns 501 — plug in a real PaymentProvider implementation later.
 *
 * POST /api/payments/webhook
 * Header: optional x-payment-provider
 */
export async function POST(request: NextRequest) {
  const kind = resolvePaymentProviderKind()
  if (kind !== 'pg') {
    return apiError(
      'PG 웹훅은 PAYMENT_PROVIDER=pg 설정 및 실제 프로바이더 구현 후 사용합니다.',
      501,
      'PG_NOT_CONFIGURED',
    )
  }

  try {
    const providerName = request.headers.get('x-payment-provider') ?? process.env.PAYMENT_PROVIDER ?? 'pg'
    const provider = createPaymentProviderStub('pg')
    // Preserve provider name for error message clarity
    void providerName

    const rawBody = await request.text()
    const headers: Record<string, string | undefined> = {}
    request.headers.forEach((value, key) => {
      headers[key] = value
    })

    if (!provider.handleWebhook) {
      throw new PaymentProviderNotImplementedError(provider.name, 'handleWebhook')
    }

    const result = await provider.handleWebhook(rawBody, headers)
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    if (error instanceof PaymentProviderNotImplementedError) {
      return apiError(error.message, 501, 'PG_NOT_IMPLEMENTED')
    }
    console.error('Payment webhook error:', error)
    return apiError('웹훅 처리 실패', 500)
  }
}
