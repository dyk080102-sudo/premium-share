import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import Link from 'next/link'
import prisma from '@/lib/db/prisma'
import { formatDate, formatDateTime } from '@/lib/utils'

export default async function SubscriptionDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/login')

  const sub = await prisma.subscription.findUnique({
    where: { id: params.id },
    include: {
      product: true,
      order: { include: { plan: true, payments: { where: { status: 'CONFIRMED' } } } },
      allocations: {
        include: {
          slot: { include: { group: true } },
          invitations: { orderBy: { createdAt: 'desc' } },
        },
        orderBy: { createdAt: 'desc' },
      },
      periods: { orderBy: { startAt: 'desc' } },
    },
  })

  if (!sub || sub.userId !== user.id) notFound()

  const STATUS_LABEL: Record<string, string> = {
    WAITING: '슬롯 대기중',
    ACTIVE: '이용중',
    EXPIRING: '만료 임박',
    EXPIRED: '만료됨',
    CANCELLED: '취소됨',
    SUSPENDED: '일시정지',
  }

  const INVITATION_STATUS_LABEL: Record<string, string> = {
    PENDING_SEND: '발송 대기',
    SENT: '발송됨',
    CUSTOMER_ACCEPTED: '고객 수락',
    ACTIVATED: '활성화됨',
    FAILED: '실패',
    EXPIRED: '만료됨',
    PENDING_CANCEL: '취소 처리중',
    CANCELLED: '취소됨',
  }

  const activeAllocation = sub.allocations.find(
    (a) => a.status !== 'RECLAIMED'
  )

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/subscriptions" className="text-sm text-muted-foreground hover:underline">← 구독 목록</Link>
        <h1 className="text-2xl font-bold">구독 상세</h1>
      </div>

      {/* Status Card */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xl font-bold">{sub.product.name}</div>
            <div className="text-sm text-muted-foreground">{sub.order.plan?.name}</div>
          </div>
          <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${
            sub.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
            sub.status === 'WAITING' ? 'bg-yellow-100 text-yellow-800' :
            sub.status === 'EXPIRING' ? 'bg-orange-100 text-orange-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {STATUS_LABEL[sub.status] ?? sub.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          {sub.startedAt && (
            <div>
              <div className="text-muted-foreground">시작일</div>
              <div className="font-medium">{formatDate(sub.startedAt)}</div>
            </div>
          )}
          {sub.expiresAt && (
            <div>
              <div className="text-muted-foreground">만료일</div>
              <div className="font-medium">{formatDate(sub.expiresAt)}</div>
            </div>
          )}
          <div>
            <div className="text-muted-foreground">주문번호</div>
            <Link href={`/orders/${sub.orderId}`} className="font-mono text-xs text-primary hover:underline">
              {sub.orderId.slice(-8).toUpperCase()}
            </Link>
          </div>
          <div>
            <div className="text-muted-foreground">구독번호</div>
            <div className="font-mono text-xs">{sub.id.slice(-8).toUpperCase()}</div>
          </div>
        </div>
      </div>

      {/* Slot / Invitation Status */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="font-semibold mb-4">슬롯 & 초대 현황</h2>

        {sub.status === 'WAITING' && (
          <div className="rounded-md bg-yellow-50 border border-yellow-200 p-4 text-sm text-yellow-800">
            <p className="font-medium mb-1">슬롯 배정 대기중</p>
            <p>이용 가능한 슬롯이 배정되면 초대장이 발송됩니다. 잠시만 기다려 주세요.</p>
          </div>
        )}

        {activeAllocation && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">슬롯 상태:</span>
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                activeAllocation.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                activeAllocation.status === 'INVITED' ? 'bg-blue-100 text-blue-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {activeAllocation.status === 'RESERVED' ? '배정됨' :
                 activeAllocation.status === 'INVITED' ? '초대 발송됨' :
                 activeAllocation.status === 'ACTIVE' ? '활성화됨' : activeAllocation.status}
              </span>
            </div>

            {activeAllocation.invitations.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium">초대 내역</div>
                {activeAllocation.invitations.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between text-sm border rounded p-3">
                    <div>
                      <div className="font-medium">{inv.inviteEmail}</div>
                      {inv.sentAt && (
                        <div className="text-xs text-muted-foreground">발송: {formatDateTime(inv.sentAt)}</div>
                      )}
                    </div>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      inv.status === 'ACTIVATED' ? 'bg-green-100 text-green-800' :
                      inv.status === 'SENT' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {INVITATION_STATUS_LABEL[inv.status] ?? inv.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {sub.status === 'EXPIRED' && (
          <div className="rounded-md bg-gray-50 border p-4 text-sm text-gray-600">
            구독이 만료되었습니다.
          </div>
        )}
      </div>

      {/* Subscription Periods */}
      {sub.periods.length > 0 && (
        <div className="rounded-lg border bg-card p-6">
          <h2 className="font-semibold mb-4">이용 기간 내역</h2>
          <div className="space-y-2">
            {sub.periods.map((period) => (
              <div key={period.id} className="flex justify-between text-sm border-b last:border-0 pb-2 last:pb-0">
                <span>{formatDate(period.startAt)} ~ {formatDate(period.endAt)}</span>
                <span className="text-muted-foreground">{period.durationDays}일</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      {sub.status === 'EXPIRING' && (
        <div className="rounded-lg border bg-orange-50 border-orange-200 p-6">
          <h2 className="font-semibold text-orange-800 mb-2">만료 임박</h2>
          <p className="text-sm text-orange-700 mb-4">구독이 곧 만료됩니다. 갱신하여 서비스를 계속 이용하세요.</p>
          <Link
            href={`/products/${sub.productId}`}
            className="inline-flex rounded-md bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
          >
            갱신 신청
          </Link>
        </div>
      )}

      <Link href="/subscriptions" className="inline-flex rounded-md border px-4 py-2 text-sm hover:bg-muted">
        목록으로
      </Link>
    </div>
  )
}
