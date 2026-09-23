import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth/session'
import { Header } from '@/components/layout/header'
import prisma from '@/lib/db/prisma'
import { formatPrice } from '@/lib/utils'

export default async function ProductsPage() {
  const user = await getCurrentUser()
  const isDemoMode = process.env.BUSINESS_MODE === 'DEMO'

  const products = await prisma.product.findMany({
    where: { isActive: true, reviewStatus: 'APPROVED' },
    include: {
      plans: { where: { isActive: true }, orderBy: { durationDays: 'asc' } },
    },
    orderBy: { sortOrder: 'asc' },
  })

  return (
    <div className="min-h-screen">
      <Header user={user} isDemoMode={isDemoMode} />
      <main className="container mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-2">상품 목록</h1>
        <p className="text-muted-foreground mb-8">원하시는 구독 서비스를 선택하세요.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => {
            const minPlan = product.plans[0]
            return (
              <div key={product.id} className="rounded-lg border bg-card shadow-sm overflow-hidden">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-xl font-semibold">{product.name}</h2>
                      <p className="text-sm text-muted-foreground mt-1">{product.serviceType}</p>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-800 px-2.5 py-0.5 text-xs font-semibold">
                      {product.shareMethod}
                    </span>
                  </div>

                  {product.description && (
                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">{product.description}</p>
                  )}

                  <div className="space-y-2 mb-4">
                    {product.plans.map((plan) => (
                      <div key={plan.id} className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">{plan.name} ({plan.durationDays}일)</span>
                        <span className="font-semibold">{formatPrice(plan.priceKrw)}</span>
                      </div>
                    ))}
                  </div>

                  <Link
                    href={`/products/${product.id}`}
                    className="block w-full text-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
                  >
                    자세히 보기
                  </Link>
                </div>
              </div>
            )
          })}
        </div>

        {products.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            현재 판매 중인 상품이 없습니다.
          </div>
        )}
      </main>
    </div>
  )
}
