import { notFound } from 'next/navigation'
import Link from 'next/link'
import prisma from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth/session'
import { formatPrice } from '@/lib/utils'
import { Header } from '@/components/layout/header'
import { OrderButton } from '@/components/order-button'

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser()

  const product = await prisma.product.findUnique({
    where: { id: params.id, isActive: true, reviewStatus: 'APPROVED' },
    include: {
      plans: { where: { isActive: true }, orderBy: { durationDays: 'asc' } },
    },
  })

  if (!product) notFound()

  const DURATION_LABEL: Record<number, string> = {
    30: '1개월',
    90: '3개월',
    180: '6개월',
    365: '1년',
  }

  const isDemoMode = process.env.BUSINESS_MODE === 'DEMO'

  return (
    <div className="min-h-screen">
      <Header user={user} isDemoMode={isDemoMode} />
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="mb-6">
        <Link href="/products" className="text-sm text-muted-foreground hover:underline">← 상품 목록</Link>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Product Info */}
        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                {product.serviceType}
              </span>
              {Array.isArray(product.countryCodes) && (product.countryCodes as string[]).length > 0 && (
                <span className="text-xs text-muted-foreground">{(product.countryCodes as string[]).join(', ')}</span>
              )}
            </div>
            <h1 className="text-3xl font-bold">{product.name}</h1>
            <p className="mt-3 text-muted-foreground">{product.description}</p>
          </div>

          {product.shareMethod && (
            <div className="rounded-lg border bg-card p-4">
              <h3 className="font-semibold mb-2">공유 방식</h3>
              <p className="text-sm text-muted-foreground">{product.shareMethod}</p>
            </div>
          )}

          {product.eligibilityInfo && (
            <div className="rounded-lg border bg-amber-50 border-amber-200 p-4">
              <h3 className="font-semibold mb-2 text-amber-800">이용 자격 안내</h3>
              <p className="text-sm text-amber-700">{product.eligibilityInfo}</p>
            </div>
          )}

          {product.onboardingGuide && (
            <div className="rounded-lg border bg-blue-50 border-blue-200 p-4">
              <h3 className="font-semibold mb-2 text-blue-800">이용 안내</h3>
              <p className="text-sm text-blue-700 whitespace-pre-wrap">{product.onboardingGuide}</p>
            </div>
          )}
        </div>

        {/* Plans */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold">요금제 선택</h2>

          {product.plans.length === 0 ? (
            <div className="rounded-lg border bg-card p-6 text-center text-muted-foreground">
              현재 판매 중인 요금제가 없습니다.
            </div>
          ) : (
            <div className="space-y-3">
              {product.plans.map((plan) => (
                <div
                  key={plan.id}
                  className="rounded-lg border bg-card p-5 hover:border-primary hover:shadow-sm transition-all"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="font-semibold">{plan.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {DURATION_LABEL[plan.durationDays] ?? `${plan.durationDays}일`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary">{formatPrice(plan.priceKrw)}</div>
                      <div className="text-xs text-muted-foreground">
                        월 {formatPrice(Math.round(plan.priceKrw / (plan.durationDays / 30)))}
                      </div>
                    </div>
                  </div>

                  {user ? (
                    <OrderButton planId={plan.id} />
                  ) : (
                    <Link
                      href={`/auth/login?redirect=/products/${product.id}`}
                      className="block w-full text-center rounded-md border border-primary py-2.5 text-sm font-semibold text-primary hover:bg-primary/5"
                    >
                      로그인 후 주문
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Process Guide */}
          <div className="rounded-lg border bg-card p-5">
            <h3 className="font-semibold mb-3">이용 절차</h3>
            <ol className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2"><span className="text-primary font-bold">1.</span> 요금제 선택 & 주문</li>
              <li className="flex gap-2"><span className="text-primary font-bold">2.</span> 결제 완료</li>
              <li className="flex gap-2"><span className="text-primary font-bold">3.</span> 슬롯 자동 배정</li>
              <li className="flex gap-2"><span className="text-primary font-bold">4.</span> 운영자가 초대장 발송</li>
              <li className="flex gap-2"><span className="text-primary font-bold">5.</span> 서비스 이용 시작</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
    </div>
  )
}
