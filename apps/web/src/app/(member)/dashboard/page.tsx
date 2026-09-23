import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import Link from 'next/link'
import prisma from '@/lib/db/prisma'
import { formatDate, formatPrice } from '@/lib/utils'

export default async function DashboardPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/login')

  const [subscriptions, recentOrders, unreadNotifications] = await Promise.all([
    prisma.subscription.findMany({
      where: { userId: user.id, status: { in: ['ACTIVE', 'WAITING', 'EXPIRING'] } },
      include: { product: true, plan: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.order.findMany({
      where: { userId: user.id },
      include: { plan: true, product: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.notification.count({ where: { userId: user.id, isRead: false } }),
  ])

  const statusLabel: Record<string, string> = {
    WAITING: '슬롯 대기',
    ACTIVE: '이용중',
    EXPIRING: '만료 임박',
    EXPIRED: '만료',
    CANCELLED: '취소',
    SUSPENDED: '일시정지',
  }

  const statusColor: Record<string, string> = {
    WAITING: 'bg-yellow-100 text-yellow-800',
    ACTIVE: 'bg-green-100 text-green-800',
    EXPIRING: 'bg-orange-100 text-orange-800',
    EXPIRED: 'bg-gray-100 text-gray-800',
    CANCELLED: 'bg-red-100 text-red-800',
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">내 대시보드</h1>
        {unreadNotifications > 0 && (
          <Link href="/notifications" className="flex items-center gap-2 text-sm text-primary">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white text-xs">
              {unreadNotifications}
            </span>
            읽지 않은 알림
          </Link>
        )}
      </div>

      {/* Active Subscriptions */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">활성 구독</h2>
          <Link href="/subscriptions" className="text-sm text-primary hover:underline">전체 보기</Link>
        </div>

        {subscriptions.length === 0 ? (
          <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
            <p className="mb-4">활성 구독이 없습니다.</p>
            <Link href="/products" className="inline-flex rounded-md bg-primary px-4 py-2 text-sm text-white">
              상품 둘러보기
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {subscriptions.map((sub) => (
              <Link key={sub.id} href={`/subscriptions/${sub.id}`}
                className="rounded-lg border bg-card p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{sub.product.name}</div>
                    <div className="text-sm text-muted-foreground">{sub.plan.name}</div>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColor[sub.status] ?? 'bg-gray-100 text-gray-800'}`}>
                      {statusLabel[sub.status] ?? sub.status}
                    </span>
                    {sub.expiresAt && (
                      <div className="text-xs text-muted-foreground mt-1">
                        만료: {formatDate(sub.expiresAt)}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Recent Orders */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">최근 주문</h2>
          <Link href="/orders" className="text-sm text-primary hover:underline">전체 보기</Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="rounded-lg border bg-card p-6 text-center text-muted-foreground">
            주문 내역이 없습니다.
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">상품</th>
                  <th className="text-right px-4 py-3 font-medium">금액</th>
                  <th className="text-right px-4 py-3 font-medium">상태</th>
                  <th className="text-right px-4 py-3 font-medium">날짜</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link href={`/orders/${order.id}`} className="hover:underline">
                        {order.productNameSnapshot}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right">{formatPrice(order.priceKrwSnapshot)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium
                        ${order.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' :
                          order.status === 'PENDING_PAYMENT' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'}`}>
                        {order.status === 'PENDING_PAYMENT' ? '결제대기' :
                         order.status === 'CONFIRMED' ? '확인' :
                         order.status === 'CANCELLED' ? '취소' : '만료'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {formatDate(order.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
