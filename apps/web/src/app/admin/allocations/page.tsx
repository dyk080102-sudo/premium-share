import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import Link from 'next/link'
import prisma from '@/lib/db/prisma'
import { formatDateTime } from '@/lib/utils'

export default async function AdminAllocationsPage({
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

  const where = status
    ? {
        status: status as
          | 'RESERVED'
          | 'INVITED'
          | 'ACTIVE'
          | 'PENDING_RECLAIM'
          | 'RECLAIMED',
      }
    : {}

  const [allocations, total] = await Promise.all([
    prisma.allocation.findMany({
      where,
      include: {
        slot: { include: { group: { include: { product: { select: { name: true } } } } } },
        subscription: { include: { user: { select: { email: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.allocation.count({ where }),
  ])

  const totalPages = Math.ceil(total / limit)

  const STATUS_LABEL: Record<string, string> = {
    RESERVED: '예약',
    INVITED: '초대됨',
    ACTIVE: '활성',
    PENDING_RECLAIM: '회수 대기',
    RECLAIMED: '회수됨',
  }

  const STATUS_CLASS: Record<string, string> = {
    RESERVED: 'bg-yellow-100 text-yellow-800',
    INVITED: 'bg-blue-100 text-blue-800',
    ACTIVE: 'bg-green-100 text-green-800',
    PENDING_RECLAIM: 'bg-orange-100 text-orange-800',
    RECLAIMED: 'bg-gray-100 text-gray-800',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">슬롯 배정</h1>
        <div className="flex gap-2">
          {['', 'RESERVED', 'INVITED', 'ACTIVE', 'PENDING_RECLAIM', 'RECLAIMED'].map((s) => (
            <Link
              key={s || 'all'}
              href={s ? `/admin/allocations?status=${s}` : '/admin/allocations'}
              className={`rounded-md px-3 py-1.5 text-xs font-medium border ${
                (status ?? '') === s
                  ? 'bg-primary text-white border-primary'
                  : 'bg-card border-border hover:bg-muted'
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
              <th className="text-left px-4 py-3 font-medium">그룹</th>
              <th className="text-center px-4 py-3 font-medium">상태</th>
              <th className="text-right px-4 py-3 font-medium">배정일</th>
            </tr>
          </thead>
          <tbody>
            {allocations.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  배정 내역이 없습니다.
                </td>
              </tr>
            ) : (
              allocations.map((alloc) => (
                <tr key={alloc.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-3">{alloc.subscription.user.email}</td>
                  <td className="px-4 py-3">{alloc.slot.group.product.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{alloc.slot.group.name}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[alloc.status] ?? 'bg-gray-100 text-gray-800'}`}>
                      {STATUS_LABEL[alloc.status] ?? alloc.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                    {formatDateTime(alloc.createdAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/admin/allocations?${status ? `status=${status}&` : ''}page=${p}`}
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
