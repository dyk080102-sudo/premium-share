import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import Link from 'next/link'
import prisma from '@/lib/db/prisma'
import { formatDateTime, formatPrice } from '@/lib/utils'

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: { status?: string; page?: string }
}) {
  const user = await getCurrentUser()
  if (!user || !['SUPER_ADMIN', 'OPERATOR', 'SUPPORT'].includes(user.role)) {
    redirect('/admin')
  }

  const page = parseInt(searchParams.page ?? '1')
  const status = searchParams.status
  const limit = 30
  const skip = (page - 1) * limit

  const where = status ? { status: status as 'PENDING_PAYMENT' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED' } : {}

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { user: { select: { email: true } }, product: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.order.count({ where }),
  ])

  const totalPages = Math.ceil(total / limit)

  const STATUS_LABEL: Record<string, string> = {
    PENDING_PAYMENT: '결제 대기',
    CONFIRMED: '확인됨',
    CANCELLED: '취소됨',
    EXPIRED: '만료됨',
  }

  const STATUS_CLASS: Record<string, string> = {
    PENDING_PAYMENT: 'bg-yellow-100 text-yellow-800',
    CONFIRMED: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-red-100 text-red-800',
    EXPIRED: 'bg-gray-100 text-gray-800',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">주문 관리</h1>
        <div className="flex gap-2">
          {['', 'PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED', 'EXPIRED'].map((s) => (
            <Link
              key={s || 'all'}
              href={s ? `/admin/orders?status=${s}` : '/admin/orders'}
              className={`rounded-md px-3 py-1.5 text-xs font-medium border ${
                (status ?? '') === s ? 'bg-primary text-white border-primary' : 'bg-card border-border hover:bg-muted'
              }`}
            >
              {s ? (STATUS_LABEL[s] ?? s) : '전체'}
            </Link>
          ))}
        </div>
      </div>

      <div className="text-sm text-muted-foreground">총 {total}건</div>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium">주문번호</th>
              <th className="text-left px-4 py-3 font-medium">회원</th>
              <th className="text-left px-4 py-3 font-medium">상품</th>
              <th className="text-right px-4 py-3 font-medium">금액</th>
              <th className="text-center px-4 py-3 font-medium">상태</th>
              <th className="text-right px-4 py-3 font-medium">날짜</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-t hover:bg-muted/30">
                <td className="px-4 py-3 font-mono text-xs">{order.id.slice(-10).toUpperCase()}</td>
                <td className="px-4 py-3 text-muted-foreground">{order.user.email}</td>
                <td className="px-4 py-3">{order.productNameSnapshot}</td>
                <td className="px-4 py-3 text-right font-medium">{formatPrice(order.priceKrwSnapshot)}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[order.status] ?? 'bg-gray-100 text-gray-800'}`}>
                    {STATUS_LABEL[order.status] ?? order.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground text-xs">{formatDateTime(order.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/admin/orders?${status ? `status=${status}&` : ''}page=${p}`}
              className={`rounded px-3 py-1.5 text-sm ${p === page ? 'bg-primary text-white' : 'border hover:bg-muted'}`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
