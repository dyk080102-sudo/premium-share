import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import Link from 'next/link'
import prisma from '@/lib/db/prisma'
import { formatDateTime, formatPrice } from '@/lib/utils'

export default async function AdminRefundsPage({
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
          | 'REQUESTED'
          | 'REVIEWING'
          | 'APPROVED'
          | 'PENDING_PAYOUT'
          | 'PAID_OUT'
          | 'REJECTED'
          | 'CANCELLED',
      }
    : {}

  const [refunds, total] = await Promise.all([
    prisma.refund.findMany({
      where,
      include: {
        user: { select: { email: true } },
        order: { select: { productNameSnapshot: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.refund.count({ where }),
  ])

  const totalPages = Math.ceil(total / limit)

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">환불 관리</h1>
        <div className="flex flex-wrap gap-2">
          {['', 'REQUESTED', 'REVIEWING', 'APPROVED', 'PENDING_PAYOUT', 'PAID_OUT', 'REJECTED'].map((s) => (
            <Link
              key={s || 'all'}
              href={s ? `/admin/refunds?status=${s}` : '/admin/refunds'}
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
              <th className="text-right px-4 py-3 font-medium">요청 금액</th>
              <th className="text-right px-4 py-3 font-medium">승인 금액</th>
              <th className="text-center px-4 py-3 font-medium">상태</th>
              <th className="text-right px-4 py-3 font-medium">신청일</th>
              <th className="text-center px-4 py-3 font-medium">관리</th>
            </tr>
          </thead>
          <tbody>
            {refunds.map((refund) => (
              <tr key={refund.id} className="border-t hover:bg-muted/30">
                <td className="px-4 py-3 text-muted-foreground">{refund.user.email}</td>
                <td className="px-4 py-3">{refund.order.productNameSnapshot}</td>
                <td className="px-4 py-3 text-right">{formatPrice(refund.requestedAmountKrw)}</td>
                <td className="px-4 py-3 text-right">
                  {refund.approvedAmountKrw !== null ? formatPrice(refund.approvedAmountKrw) : '-'}
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[refund.status] ?? 'bg-gray-100 text-gray-800'}`}
                  >
                    {STATUS_LABEL[refund.status] ?? refund.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                  {formatDateTime(refund.createdAt)}
                </td>
                <td className="px-4 py-3 text-center">
                  {(refund.status === 'REQUESTED' || refund.status === 'REVIEWING') && (
                    <Link
                      href={`/admin/refunds/${refund.id}`}
                      className="text-xs text-green-600 hover:underline"
                    >
                      처리
                    </Link>
                  )}
                  {refund.status === 'APPROVED' && (
                    <Link
                      href={`/admin/refunds/${refund.id}`}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      지급 처리
                    </Link>
                  )}
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
              href={`/admin/refunds?${status ? `status=${status}&` : ''}page=${p}`}
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
