import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import Link from 'next/link'
import prisma from '@/lib/db/prisma'
import { formatDate, formatPrice } from '@/lib/utils'

const STATUS_LABEL: Record<string, string> = {
  REQUESTED: '검토 요청',
  REVIEWING: '검토중',
  APPROVED: '승인됨',
  PENDING_PAYOUT: '지급 처리중',
  PAID_OUT: '지급 완료',
  REJECTED: '거절됨',
  CANCELLED: '취소됨',
}

const STATUS_CLASS: Record<string, string> = {
  REQUESTED: 'bg-yellow-100 text-yellow-800',
  REVIEWING: 'bg-blue-100 text-blue-800',
  APPROVED: 'bg-green-100 text-green-800',
  PENDING_PAYOUT: 'bg-indigo-100 text-indigo-800',
  PAID_OUT: 'bg-green-200 text-green-900',
  REJECTED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
}

export default async function RefundsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/login')

  const refunds = await prisma.refund.findMany({
    where: { userId: user.id },
    include: { order: true },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">환불 내역</h1>
        <Link
          href="/refunds/new"
          className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white"
        >
          환불 신청
        </Link>
      </div>

      {refunds.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">
          환불 내역이 없습니다.
        </div>
      ) : (
        <div className="grid gap-4">
          {refunds.map((refund) => (
            <Link
              key={refund.id}
              href={`/refunds/${refund.id}`}
              className="rounded-lg border bg-card p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="font-medium">{refund.order.productNameSnapshot}</div>
                  <div className="text-sm text-muted-foreground">
                    신청: {formatDate(refund.createdAt)}
                  </div>
                  <div className="text-xs text-muted-foreground">{refund.reason}</div>
                </div>
                <div className="text-right space-y-2">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLASS[refund.status] ?? 'bg-gray-100 text-gray-800'}`}>
                    {STATUS_LABEL[refund.status] ?? refund.status}
                  </span>
                  <div className="text-sm font-medium">
                    요청: {formatPrice(refund.requestedAmountKrw)}
                  </div>
                  {refund.approvedAmountKrw && (
                    <div className="text-sm text-green-600 font-semibold">
                      승인: {formatPrice(refund.approvedAmountKrw)}
                    </div>
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
