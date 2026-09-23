import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import Link from 'next/link'
import prisma from '@/lib/db/prisma'
import { formatDate } from '@/lib/utils'

const STATUS_LABEL: Record<string, string> = {
  WAITING: '슬롯 대기',
  ACTIVE: '이용중',
  EXPIRING: '만료 임박',
  EXPIRED: '만료됨',
  CANCELLED: '취소됨',
  SUSPENDED: '일시정지',
}

const STATUS_CLASS: Record<string, string> = {
  WAITING: 'bg-yellow-100 text-yellow-800',
  ACTIVE: 'bg-green-100 text-green-800',
  EXPIRING: 'bg-orange-100 text-orange-800',
  EXPIRED: 'bg-gray-100 text-gray-800',
  CANCELLED: 'bg-red-100 text-red-800',
  SUSPENDED: 'bg-purple-100 text-purple-800',
}

export default async function SubscriptionsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/login')

  const subscriptions = await prisma.subscription.findMany({
    where: { userId: user.id },
    include: {
      product: true,
      order: { include: { plan: true } },
      allocations: {
        where: { status: { in: ['RESERVED', 'INVITED', 'ACTIVE', 'PENDING_RECLAIM'] } },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">내 구독</h1>

      {subscriptions.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">
          <p className="mb-4">구독 내역이 없습니다.</p>
          <Link href="/products" className="inline-flex rounded-md bg-primary px-4 py-2 text-sm text-white">
            상품 보기
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {subscriptions.map((sub) => (
            <Link
              key={sub.id}
              href={`/subscriptions/${sub.id}`}
              className="rounded-lg border bg-card p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="font-semibold text-lg">{sub.product.name}</div>
                  <div className="text-sm text-muted-foreground">{sub.order.plan?.name}</div>
                  {sub.allocations.length > 0 && (
                    <div className="text-xs text-green-600 font-medium">슬롯 배정됨</div>
                  )}
                </div>
                <div className="text-right space-y-1">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLASS[sub.status] ?? 'bg-gray-100 text-gray-800'}`}>
                    {STATUS_LABEL[sub.status] ?? sub.status}
                  </span>
                  {sub.expiresAt && (
                    <div className="text-xs text-muted-foreground">만료: {formatDate(sub.expiresAt)}</div>
                  )}
                  {sub.startedAt && !sub.expiresAt && (
                    <div className="text-xs text-muted-foreground">시작: {formatDate(sub.startedAt)}</div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
