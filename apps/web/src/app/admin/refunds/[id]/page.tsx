import { notFound, redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import Link from 'next/link'
import prisma from '@/lib/db/prisma'
import { formatDateTime, formatPrice } from '@/lib/utils'

const statusLabel: Record<string, string> = {
  REQUESTED: '신청됨',
  REVIEWING: '검토 중',
  APPROVED: '승인됨',
  PENDING_PAYOUT: '지급 대기',
  PAID_OUT: '지급 완료',
  REJECTED: '거절됨',
  CANCELLED: '취소됨',
}

const statusColor: Record<string, string> = {
  REQUESTED: 'bg-yellow-100 text-yellow-800',
  REVIEWING: 'bg-blue-100 text-blue-800',
  APPROVED: 'bg-green-100 text-green-800',
  PENDING_PAYOUT: 'bg-orange-100 text-orange-800',
  PAID_OUT: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
}

export default async function AdminRefundDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const user = await getCurrentUser()
  if (!user || !['SUPER_ADMIN', 'OPERATOR'].includes(user.role)) {
    redirect('/admin')
  }

  const refund = await prisma.refund.findUnique({
    where: { id: params.id },
    include: {
      user: { select: { id: true, email: true } },
      order: {
        include: {
          plan: true,
          payments: { where: { status: 'CONFIRMED' } },
        },
      },
      payment: true,
      subscription: {
        include: {
          allocations: {
            where: { status: { not: 'RECLAIMED' } },
            include: { slot: { include: { group: true } } },
          },
        },
      },
    },
  })

  if (!refund) notFound()

  const confirmedPaymentTotal = refund.order.payments.reduce(
    (sum, p) => sum + p.amountKrw,
    0,
  )

  const isDemoMode = process.env.BUSINESS_MODE === 'DEMO'
  const canApprove =
    user.role === 'SUPER_ADMIN' ||
    (user.role === 'OPERATOR' &&
      ['REQUESTED', 'REVIEWING'].includes(refund.status))
  const canPayout =
    user.role === 'SUPER_ADMIN' && refund.status === 'APPROVED'

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/refunds"
            className="text-sm text-blue-600 hover:underline"
          >
            ← 환불 목록
          </Link>
          <h1 className="text-2xl font-bold">환불 상세</h1>
          <span
            className={`px-2 py-1 rounded text-sm font-medium ${statusColor[refund.status] ?? 'bg-gray-100 text-gray-600'}`}
          >
            {statusLabel[refund.status] ?? refund.status}
          </span>
        </div>
        {refund.source === 'DEMO' && (
          <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded text-sm font-medium">
            데모 / 실제 결제 없음
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 환불 정보 */}
        <div className="border rounded-lg p-5 space-y-3">
          <h2 className="font-semibold text-lg border-b pb-2">환불 정보</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">환불 ID</dt>
              <dd className="font-mono text-xs">{refund.id}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">신청 사유</dt>
              <dd>{refund.reason}</dd>
            </div>
            {refund.requestNotes && (
              <div className="flex justify-between">
                <dt className="text-gray-500">신청 메모</dt>
                <dd className="text-right max-w-xs">{refund.requestNotes}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-gray-500">신청 금액</dt>
              <dd className="font-semibold">{formatPrice(refund.requestedAmountKrw)}</dd>
            </div>
            {refund.approvedAmountKrw != null && (
              <div className="flex justify-between">
                <dt className="text-gray-500">승인 금액</dt>
                <dd className="font-semibold text-green-700">
                  {formatPrice(refund.approvedAmountKrw)}
                </dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-gray-500">신청일</dt>
              <dd>{formatDateTime(refund.createdAt)}</dd>
            </div>
            {refund.reviewedAt && (
              <div className="flex justify-between">
                <dt className="text-gray-500">검토일</dt>
                <dd>{formatDateTime(refund.reviewedAt)}</dd>
              </div>
            )}
            {refund.reviewNotes && (
              <div className="flex justify-between">
                <dt className="text-gray-500">검토 메모</dt>
                <dd className="text-right max-w-xs">{refund.reviewNotes}</dd>
              </div>
            )}
            {refund.paidAt && (
              <>
                <div className="flex justify-between">
                  <dt className="text-gray-500">지급일</dt>
                  <dd>{formatDateTime(refund.paidAt)}</dd>
                </div>
                {refund.payoutRef && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">참조번호</dt>
                    <dd className="font-mono text-xs">{refund.payoutRef}</dd>
                  </div>
                )}
                {refund.paidNotes && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">지급 메모</dt>
                    <dd>{refund.paidNotes}</dd>
                  </div>
                )}
              </>
            )}
          </dl>
        </div>

        {/* 고객 / 주문 정보 */}
        <div className="border rounded-lg p-5 space-y-3">
          <h2 className="font-semibold text-lg border-b pb-2">고객 · 주문 정보</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">고객 이메일</dt>
              <dd>{refund.user.email}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">주문 ID</dt>
              <dd>
                <Link
                  href={`/admin/orders?q=${refund.orderId}`}
                  className="text-blue-600 hover:underline font-mono text-xs"
                >
                  {refund.orderId}
                </Link>
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">상품</dt>
              <dd>{refund.order.productNameSnapshot}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">요금제</dt>
              <dd>{refund.order.planNameSnapshot} ({refund.order.durationDaysSnapshot}일)</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">주문 금액</dt>
              <dd>{formatPrice(refund.order.priceKrwSnapshot)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">확인된 결제</dt>
              <dd className="font-semibold">{formatPrice(confirmedPaymentTotal)}</dd>
            </div>
          </dl>

          {/* 구독 & 슬롯 현황 */}
          {refund.subscription && (
            <div className="mt-3 pt-3 border-t space-y-2 text-sm">
              <p className="font-medium text-gray-700">구독 현황</p>
              <div className="flex justify-between">
                <span className="text-gray-500">구독 상태</span>
                <span>{refund.subscription.status}</span>
              </div>
              {refund.subscription.startedAt && (
                <div className="flex justify-between">
                  <span className="text-gray-500">이용 시작</span>
                  <span>{formatDateTime(refund.subscription.startedAt)}</span>
                </div>
              )}
              {refund.subscription.expiresAt && (
                <div className="flex justify-between">
                  <span className="text-gray-500">만료일</span>
                  <span>{formatDateTime(refund.subscription.expiresAt)}</span>
                </div>
              )}
              {refund.subscription.allocations[0] && (
                <div className="flex justify-between">
                  <span className="text-gray-500">배정 슬롯</span>
                  <span>
                    {refund.subscription.allocations[0].slot.group.name} —
                    슬롯 #{refund.subscription.allocations[0].slot.slotIndex}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 액션 영역 */}
      {canApprove && (
        <div className="border rounded-lg p-5">
          <h2 className="font-semibold text-lg mb-4">환불 처리</h2>
          <p className="text-sm text-gray-500 mb-4">
            최대 환불 가능: <strong>{formatPrice(confirmedPaymentTotal)}</strong>
            (신청액: {formatPrice(refund.requestedAmountKrw)})
          </p>
          <form
            action={`/api/admin/refunds/${refund.id}/approve`}
            method="POST"
            className="space-y-3"
          >
            <div>
              <label className="block text-sm font-medium mb-1">
                승인 금액 (원)
              </label>
              <input
                name="approvedAmount"
                type="number"
                defaultValue={refund.requestedAmountKrw}
                max={confirmedPaymentTotal}
                min={0}
                required
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                검토 메모
              </label>
              <textarea
                name="notes"
                rows={3}
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="승인 사유 또는 금액 조정 이유를 입력하세요"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                className="px-4 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700"
              >
                승인
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-red-100 text-red-700 rounded text-sm font-medium hover:bg-red-200"
                onClick={() => {
                  if (confirm('환불을 거절하시겠습니까?')) {
                    fetch(`/api/admin/refunds/${refund.id}/reject`, {
                      method: 'POST',
                    }).then(() => window.location.reload())
                  }
                }}
              >
                거절
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 지급 완료 처리 */}
      {canPayout && (
        <div className="border rounded-lg p-5">
          <h2 className="font-semibold text-lg mb-4">
            환불 지급 {isDemoMode ? '(DEMO)' : '완료 기록 (MANUAL)'}
          </h2>
          {isDemoMode ? (
            <div>
              <p className="text-sm text-gray-500 mb-3">
                <strong>DEMO 모드</strong>: 실제 환불 이체 없이 모의 완료 처리됩니다.
              </p>
              <button
                className="px-4 py-2 bg-purple-600 text-white rounded text-sm font-medium hover:bg-purple-700"
                onClick={() => {
                  fetch(`/api/admin/refunds/${refund.id}/complete-payout`, {
                    method: 'POST',
                    body: JSON.stringify({ demo: true }),
                    headers: { 'Content-Type': 'application/json' },
                  }).then(() => window.location.reload())
                }}
              >
                DEMO 환불 완료 처리
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
                실제 이체 완료 후 참조번호를 입력해야 지급 완료 처리됩니다.
              </p>
              <div>
                <label className="block text-sm font-medium mb-1">
                  이체 참조번호 <span className="text-red-500">*</span>
                </label>
                <input
                  id="payoutRef"
                  type="text"
                  required
                  className="w-full border rounded px-3 py-2 text-sm"
                  placeholder="은행 이체 참조번호"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">처리 메모</label>
                <textarea
                  id="paidNotes"
                  rows={2}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
                onClick={() => {
                  const payoutRef = (
                    document.getElementById('payoutRef') as HTMLInputElement
                  )?.value
                  const paidNotes = (
                    document.getElementById('paidNotes') as HTMLTextAreaElement
                  )?.value
                  if (!payoutRef) {
                    alert('이체 참조번호를 입력하세요.')
                    return
                  }
                  fetch(`/api/admin/refunds/${refund.id}/complete-payout`, {
                    method: 'POST',
                    body: JSON.stringify({ payoutRef, notes: paidNotes }),
                    headers: { 'Content-Type': 'application/json' },
                  }).then(() => window.location.reload())
                }}
              >
                지급 완료 기록
              </button>
            </div>
          )}
        </div>
      )}

      {/* 상태 이력 (AuditLog) */}
      <RefundAuditSection refundId={refund.id} />
    </div>
  )
}

async function RefundAuditSection({ refundId }: { refundId: string }) {
  const logs = await prisma.auditLog.findMany({
    where: { targetType: 'Refund', targetId: refundId },
    include: { actor: { select: { email: true, role: true } } },
    orderBy: { createdAt: 'asc' },
    take: 20,
  })

  if (logs.length === 0) return null

  return (
    <div className="border rounded-lg p-5">
      <h2 className="font-semibold text-lg mb-4">처리 이력</h2>
      <ol className="space-y-3">
        {logs.map((log) => (
          <li key={log.id} className="flex gap-3 text-sm">
            <span className="text-gray-400 text-xs w-36 shrink-0 mt-0.5">
              {formatDateTime(log.createdAt)}
            </span>
            <div>
              <span className="font-medium">{log.action}</span>
              {log.actor && (
                <span className="text-gray-500 ml-2">
                  by {log.actor.email} ({log.actor.role})
                </span>
              )}
              {log.reason && (
                <p className="text-gray-500 mt-0.5">{log.reason}</p>
              )}
              {log.source === 'DEMO' && (
                <span className="text-purple-600 text-xs ml-1">[DEMO]</span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
