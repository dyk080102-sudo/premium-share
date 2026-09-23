import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import prisma from '@/lib/db/prisma'
import { formatDateTime } from '@/lib/utils'

export default async function AdminProductsPage() {
  const user = await getCurrentUser()
  if (!user || !['SUPER_ADMIN', 'OPERATOR'].includes(user.role)) {
    redirect('/admin')
  }

  const products = await prisma.product.findMany({
    include: {
      plans: { where: { isActive: true } },
      _count: {
        select: { orders: true, subscriptions: true },
      },
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  })

  const REVIEW_CLASS: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    APPROVED: 'bg-green-100 text-green-800',
    BLOCKED: 'bg-red-100 text-red-800',
  }

  const REVIEW_LABEL: Record<string, string> = {
    PENDING: '검토 대기',
    APPROVED: '승인됨',
    BLOCKED: '차단됨',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">상품 관리</h1>
      </div>

      <div className="grid gap-4">
        {products.map((product) => (
          <div key={product.id} className="rounded-lg border bg-card p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-lg">{product.name}</span>
                  {!product.isActive && (
                    <span className="rounded-full bg-gray-100 text-gray-600 px-2 py-0.5 text-xs font-medium">비활성</span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground mt-1">{product.serviceType} · {product.shareMethod}</div>
              </div>
              <div className="flex gap-2">
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${REVIEW_CLASS[product.reviewStatus] ?? 'bg-gray-100 text-gray-800'}`}>
                  {REVIEW_LABEL[product.reviewStatus] ?? product.reviewStatus}
                </span>
              </div>
            </div>

            <p className="text-sm text-muted-foreground mb-3">{product.description}</p>

            <div className="flex items-center gap-6 text-sm">
              <div>
                <span className="text-muted-foreground">플랜: </span>
                <span className="font-medium">{product.plans.length}개</span>
              </div>
              <div>
                <span className="text-muted-foreground">주문: </span>
                <span className="font-medium">{product._count.orders}건</span>
              </div>
              <div>
                <span className="text-muted-foreground">구독: </span>
                <span className="font-medium">{product._count.subscriptions}건</span>
              </div>
              <div>
                <span className="text-muted-foreground">최대 슬롯: </span>
                <span className="font-medium">{product.maxSlotsPerGroup}</span>
              </div>
              {Array.isArray(product.countryCodes) && (product.countryCodes as string[]).length > 0 && (
                <div>
                  <span className="text-muted-foreground">국가: </span>
                  <span>{(product.countryCodes as string[]).join(', ')}</span>
                </div>
              )}
            </div>

            {product.plans.length > 0 && (
              <div className="mt-3 flex gap-2 flex-wrap">
                {product.plans.map((plan) => (
                  <span key={plan.id} className="rounded border px-2 py-0.5 text-xs">
                    {plan.name}: {plan.priceKrw.toLocaleString()}원/{plan.durationDays}일
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
