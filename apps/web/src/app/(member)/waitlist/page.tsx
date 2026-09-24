import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth/session'
import prisma from '@/lib/db/prisma'
import { formatDateTime, formatPrice } from '@/lib/utils'

const STATUS_LABEL: Record<string, string> = {
  WAITING: '대기 중',
  ALLOCATED: '배정됨',
  CANCELLED: '취소',
  EXPIRED: '만료',
}

export default async function WaitlistPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/login')

  const entries = await prisma.waitlistEntry.findMany({
    where: { userId: user.id },
    include: {
      product: { select: { id: true, name: true } },
      plan: { select: { id: true, name: true, priceKrw: true, durationDays: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">대기열</h1>
        <Link href="/products" className="text-sm text-primary hover:underline">
          상품 보기
        </Link>
      </div>

      <p className="text-sm text-muted-foreground">
        슬롯이 부족할 때 자동 또는 수동으로 등록된 대기 목록입니다. 자리가 나면 알림으로 안내됩니다.
      </p>

      {entries.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          등록된 대기열이 없습니다.
        </div>
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) => (
            <li key={entry.id} className="rounded-lg border bg-card p-4 flex items-center justify-between gap-4">
              <div>
                <div className="font-medium">{entry.product.name}</div>
                <div className="text-sm text-muted-foreground">
                  {entry.plan.name} · {entry.plan.durationDays}일 · {formatPrice(entry.plan.priceKrw)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  등록: {formatDateTime(entry.createdAt)}
                </div>
              </div>
              <span className="inline-flex rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-semibold text-yellow-800">
                {STATUS_LABEL[entry.status] ?? entry.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
