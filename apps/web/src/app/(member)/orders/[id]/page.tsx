import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import Link from 'next/link'
import prisma from '@/lib/db/prisma'
import { formatDate, formatDateTime, formatPrice } from '@/lib/utils'
import { DemoPayButton } from '@/components/demo-pay-button'

const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: '결제 대기',
  CONFIRMED: '확인됨',
  CANCELLED: '취소됨',
  EXPIRED: '만료됨',
}

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/login')

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      product: true,
      plan: true,
      payments: { orderBy: { createdAt: 'desc' } },
      subscriptions: { include: { allocations: true } },
    },
  })

  if (!order || order.userId !== user.id) notFound()

  const isDemoMode = process.env.BUSINESS_MODE === 'DEMO'
  const pendingPayment = order.payments.find((p) => p.status === 'PENDING')
  const confirmedPayment = order.payments.find((p) => p.status === 'CONFIRMED')

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/orders" className="text-sm text-muted-foreground hover:underline">← 주문 목록</Link>
        <h1 className="text-2xl font-bold">주문 상세</h1>
      </div>

      {/* Order Info */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">주문 정보</h2>
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
            order.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' :
            order.status === 'PENDING_PAYMENT' ? 'bg-yellow-100 text-yellow-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {ORDER_STATUS_LABEL[order.status] ?? order.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">주문번호</div>
            <div className="font-mono font-medium">{order.id.slice(-12).toUpperCase()}</div>
          </div>
          <div>
            <div className="text-muted-foreground">주문일</div>
            <div>{formatDateTime(order.createdAt)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">상품</div>
            <div className="font-medium">{order.productNameSnapshot}</div>
          </div>
          <div>
            <div className="text-muted-foreground">플랜</div>
            <div>{order.planNameSnapshot} ({order.durationDaysSnapshot}일)</div>
          </div>
          <div>
            <div className="text-muted-foreground">결제 금액</div>
            <div className="font-bold text-lg">{formatPrice(order.priceKrwSnapshot)}</div>
          </div>
          {order.expiresAt && order.status === 'PENDING_PAYMENT' && (
            <div>
              <div className="text-muted-foreground">결제 마감</div>
              <div className="text-orange-600">{formatDateTime(order.expiresAt)}</div>
            </div>
          )}
        </div>
      </div>

      {/* Payment Section */}
      {order.status === 'PENDING_PAYMENT' && (
        <div className="rounded-lg border bg-yellow-50 border-yellow-200 p-6 space-y-4">
          <h2 className="font-semibold text-yellow-800">결제 안내</h2>

          {isDemoMode ? (
            <div className="space-y-3">
              <p className="text-sm text-yellow-700">DEMO 모드: 가상 결제를 진행합니다.</p>
              <DemoPayButton orderId={order.id} />
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-yellow-700">아래 계좌로 입금 후 입금 신고를 해주세요.</p>
              <div className="bg-white rounded p-4 text-sm space-y-2 border border-yellow-200">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">은행</span>
                  <span className="font-medium">국민은행</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">계좌번호</span>
                  <span className="font-medium font-mono">000-00-000000</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">예금주</span>
                  <span className="font-medium">PremiumShare</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">입금액</span>
                  <span className="font-bold text-primary">{formatPrice(order.priceKrwSnapshot)}</span>
                </div>
              </div>
              <Link
                href={`/orders/${order.id}/payment`}
                className="block w-full text-center rounded-md bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
              >
                입금 신고하기
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Payment History */}
      {order.payments.length > 0 && (
        <div className="rounded-lg border bg-card p-6">
          <h2 className="font-semibold mb-4">결제 내역</h2>
          <div className="space-y-3">
            {order.payments.map((payment) => (
              <div key={payment.id} className="flex items-center justify-between text-sm">
                <div>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    payment.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' :
                    payment.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {payment.status === 'CONFIRMED' ? '확인됨' :
                     payment.status === 'PENDING' ? '확인 대기' :
                     payment.status === 'CANCELLED' ? '취소됨' : '환불됨'}
                  </span>
                  {payment.confirmedAt && (
                    <span className="ml-2 text-muted-foreground">{formatDateTime(payment.confirmedAt)}</span>
                  )}
                </div>
                <span className="font-medium">{formatPrice(payment.amountKrw)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Subscription Status */}
      {order.subscriptions.length > 0 && (
        <div className="rounded-lg border bg-card p-6">
          <h2 className="font-semibold mb-4">구독 현황</h2>
          {order.subscriptions.map((sub) => (
            <div key={sub.id} className="flex items-center justify-between">
              <div className="text-sm">
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  sub.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                  sub.status === 'WAITING' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {sub.status === 'WAITING' ? '슬롯 대기' :
                   sub.status === 'ACTIVE' ? '이용중' :
                   sub.status === 'EXPIRING' ? '만료 임박' : sub.status}
                </span>
                {sub.expiresAt && (
                  <span className="ml-2 text-muted-foreground text-xs">만료: {formatDate(sub.expiresAt)}</span>
                )}
              </div>
              <Link href={`/subscriptions/${sub.id}`} className="text-sm text-primary hover:underline">
                상세 보기
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {order.status === 'CONFIRMED' && (
          <Link
            href="/refunds"
            className="inline-flex rounded-md border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            환불 신청
          </Link>
        )}
        <Link href="/orders" className="inline-flex rounded-md border px-4 py-2 text-sm hover:bg-muted">
          목록으로
        </Link>
      </div>
    </div>
  )
}
