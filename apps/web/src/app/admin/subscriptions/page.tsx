import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import Link from 'next/link'
import prisma from '@/lib/db/prisma'
import { formatDate } from '@/lib/utils'

export default async function AdminSubscriptionsPage({
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

  const where = status ? { status: status as 'WAITING' | 'ACTIVE' | 'EXPIRING' | 'EXPIRED' | 'CANCELLED' | 'SUSPENDED' } : {}

  const [subs, total] = await Promise.all([
    prisma.subscription.findMany({
      where,
      include: {
        user: { select: { email: true } },
        product: { select: { name: true } },
        allocations: {
          where: { status: { in: ['RESERVED', 'INVITED', 'ACTIVE'] } },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.subscription.count({ where }),
  ])

  const totalPages = Math.ceil(total / limit)

  const STATUS_LABEL: Record<string, string> = {
    WAITING: '대기',
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">구독 관리</h1>
        <div className="flex flex-wrap gap-2">
          {['', 'WAITING', 'ACTIVE', 'EXPIRING', 'EXPIRED', 'CANCELLED'].map((s) => (
            <Link
              key={s || 'all'}
              href={s ? `/admin/subscriptions?status=${s}` : '/admin/subscriptions'}
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
              <th className="text-left px-4 py-3 font-medium">회원</th>
              <th className="text-left px-4 py-3 font-medium">상품</th>
              <th className="text-center px-4 py-3 font-medium">상태</th>
              <th className="text-center px-4 py-3 font-medium">슬롯</th>
              <th className="text-right px-4 py-3 font-medium">만료일</th>
            </tr>
          </thead>
          <tbody>
            {subs.map((sub) => (
              <tr key={sub.id} className="border-t hover:bg-muted/30">
                <td className="px-4 py-3 text-muted-foreground">{sub.user.email}</td>
                <td className="px-4 py-3">{sub.product.name}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[sub.status] ?? 'bg-gray-100 text-gray-800'}`}>
                    {STATUS_LABEL[sub.status] ?? sub.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    sub.allocations.length > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {sub.allocations.length > 0 ? '배정됨' : '미배정'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground text-xs">
                  {sub.expiresAt ? formatDate(sub.expiresAt) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/admin/subscriptions?${status ? `status=${status}&` : ''}page=${p}`}
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
