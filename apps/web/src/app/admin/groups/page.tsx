import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import prisma from '@/lib/db/prisma'
import Link from 'next/link'

export default async function AdminGroupsPage({
  searchParams,
}: {
  searchParams: { status?: string; page?: string }
}) {
  const user = await getCurrentUser()
  if (!user || !['SUPER_ADMIN', 'OPERATOR'].includes(user.role)) {
    redirect('/admin')
  }

  const page = parseInt(searchParams.page ?? '1')
  const status = searchParams.status
  const limit = 30
  const skip = (page - 1) * limit

  const where = status ? { status: status as 'ACTIVE' | 'SUSPENDED' | 'CLOSED' } : {}

  const [groups, total] = await Promise.all([
    prisma.subscriptionGroup.findMany({
      where,
      include: {
        product: { select: { name: true } },
        ownerAccount: { select: { email: true } },
        slots: {
          include: {
            allocations: {
              where: { status: { not: 'RECLAIMED' } },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.subscriptionGroup.count({ where }),
  ])

  const totalPages = Math.ceil(total / limit)

  const STATUS_CLASS: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-800',
    SUSPENDED: 'bg-yellow-100 text-yellow-800',
    CLOSED: 'bg-gray-100 text-gray-800',
  }

  const SUPPLY_STATUS_CLASS: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-800',
    EXPIRING: 'bg-orange-100 text-orange-800',
    SUSPENDED: 'bg-red-100 text-red-800',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">그룹 관리</h1>
        <div className="flex gap-2">
          {['', 'ACTIVE', 'SUSPENDED', 'CLOSED'].map((s) => (
            <Link
              key={s || 'all'}
              href={s ? `/admin/groups?status=${s}` : '/admin/groups'}
              className={`rounded-md px-3 py-1.5 text-xs font-medium border ${
                (status ?? '') === s ? 'bg-primary text-white border-primary' : 'bg-card border-border hover:bg-muted'
              }`}
            >
              {s || '전체'}
            </Link>
          ))}
        </div>
      </div>

      <div className="text-sm text-muted-foreground">총 {total}개 그룹</div>

      <div className="grid gap-4">
        {groups.map((group) => {
          const usedSlots = group.slots.filter((s) => s.allocations.length > 0).length
          const totalSlots = group.totalCapacity
          return (
            <div key={group.id} className="rounded-lg border bg-card p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-semibold">{group.name}</div>
                  <div className="text-sm text-muted-foreground">{group.product.name}</div>
                  {group.ownerAccount && (
                    <div className="text-xs text-muted-foreground">{group.ownerAccount.email}</div>
                  )}
                </div>
                <div className="flex gap-2">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASS[group.status] ?? 'bg-gray-100 text-gray-800'}`}>
                    {group.status}
                  </span>
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${SUPPLY_STATUS_CLASS[group.supplyPaymentStatus] ?? 'bg-gray-100 text-gray-800'}`}>
                    공급: {group.supplyPaymentStatus}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-6 text-sm">
                <div>
                  <span className="text-muted-foreground">슬롯: </span>
                  <span className="font-medium">{usedSlots}/{totalSlots}</span>
                </div>
                {group.country && (
                  <div>
                    <span className="text-muted-foreground">국가: </span>
                    <span>{group.country}</span>
                  </div>
                )}
                {group.supplyNextRenewalAt && (
                  <div>
                    <span className="text-muted-foreground">공급 갱신: </span>
                    <span>{new Date(group.supplyNextRenewalAt).toLocaleDateString('ko-KR')}</span>
                  </div>
                )}
                <div>
                  <span className={`inline-flex h-2 w-2 rounded-full mr-1 ${group.policyVerified ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-muted-foreground">{group.policyVerified ? '정책 확인됨' : '정책 미확인'}</span>
                </div>
              </div>

              {group.operatorNotes && (
                <div className="mt-3 text-xs text-muted-foreground border-t pt-3">{group.operatorNotes}</div>
              )}
            </div>
          )
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/admin/groups?${status ? `status=${status}&` : ''}page=${p}`}
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
