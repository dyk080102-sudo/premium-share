import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import Link from 'next/link'
import prisma from '@/lib/db/prisma'
import { formatDate, formatDateTime, formatPrice } from '@/lib/utils'

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

export default async function RefundDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/login')

  const refund = await prisma.refund.findUnique({
    where: { id: params.id },
    include: { order: true, payment: true },
  })

  if (!refund || refund.userId !== user.id) notFound()

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/refunds" className="text-sm text-muted-foreground hover:underline">← 환불 목록</Link>
        <h1 className="text-2xl font-bold">환불 상세</h1>
      </div>

      {/* Status */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">환불 정보</h2>
          <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${STATUS_CLASS[refund.status] ?? 'bg-gray-100 text-gray-800'}`}>
            {STATUS_LABEL[refund.status] ?? refund.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">상품</div>
            <div className="font-medium">{refund.order.productNameSnapshot}</div>
          </div>
          <div>
            <div className="text-muted-foreground">신청일</div>
            <div>{formatDateTime(refund.createdAt)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">요청 금액</div>
            <div className="font-bold">{formatPrice(refund.requestedAmountKrw)}</div>
          </div>
          {refund.approvedAmountKrw !== null && (
            <div>
              <div className="text-muted-foreground">승인 금액</div>
              <div className="font-bold text-green-600">{formatPrice(refund.approvedAmountKrw)}</div>
            </div>
          )}
          <div className="col-span-2">
            <div className="text-muted-foreground">환불 사유</div>
            <div>{refund.reason}</div>
          </div>
          {refund.requestNotes && (
            <div className="col-span-2">
              <div className="text-muted-foreground">추가 내용</div>
              <div>{refund.requestNotes}</div>
            </div>
          )}
        </div>
      </div>

      {/* Review Result */}
      {(refund.reviewNotes || refund.reviewedAt) && (
        <div className="rounded-lg border bg-card p-6">
          <h2 className="font-semibold mb-4">검토 결과</h2>
          <div className="space-y-3 text-sm">
            {refund.reviewedAt && (
              <div>
                <span className="text-muted-foreground">검토일: </span>
                <span>{formatDateTime(refund.reviewedAt)}</span>
              </div>
            )}
            {refund.reviewNotes && (
              <div>
                <div className="text-muted-foreground mb-1">검토 내용</div>
                <div className="rounded bg-muted p-3">{refund.reviewNotes}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payout Info */}
      {refund.paidAt && (
        <div className="rounded-lg border bg-green-50 border-green-200 p-6">
          <h2 className="font-semibold text-green-800 mb-3">지급 완료</h2>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">지급일: </span>
              <span className="font-medium">{formatDateTime(refund.paidAt)}</span>
            </div>
            {refund.payoutRef && (
              <div>
                <span className="text-muted-foreground">지급 참조번호: </span>
                <span className="font-mono">{refund.payoutRef}</span>
              </div>
            )}
            {refund.paidNotes && (
              <div>
                <span className="text-muted-foreground">지급 메모: </span>
                <span>{refund.paidNotes}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <Link href="/refunds" className="inline-flex rounded-md border px-4 py-2 text-sm hover:bg-muted">
        목록으로
      </Link>
    </div>
  )
}
