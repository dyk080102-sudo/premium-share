import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import prisma from '@/lib/db/prisma'
import Link from 'next/link'
import { formatDateTime } from '@/lib/utils'

export default async function AdminInvitationsPage({
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
          | 'PENDING_SEND'
          | 'SENT'
          | 'CUSTOMER_ACCEPTED'
          | 'ACTIVATED'
          | 'FAILED'
          | 'EXPIRED'
          | 'PENDING_CANCEL'
          | 'CANCELLED',
      }
    : {}

  const [invitations, total] = await Promise.all([
    prisma.invitation.findMany({
      where,
      include: {
        subscription: {
          include: {
            user: { select: { email: true } },
            product: { select: { name: true } },
          },
        },
        allocation: {
          include: {
            slot: {
              include: { group: { select: { name: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.invitation.count({ where }),
  ])

  const totalPages = Math.ceil(total / limit)

  const STATUS_LABEL: Record<string, string> = {
    PENDING_SEND: '발송 대기',
    SENT: '발송됨',
    CUSTOMER_ACCEPTED: '고객 수락',
    ACTIVATED: '활성화됨',
    FAILED: '실패',
    EXPIRED: '만료됨',
    PENDING_CANCEL: '취소 처리중',
    CANCELLED: '취소됨',
  }

  const STATUS_CLASS: Record<string, string> = {
    PENDING_SEND: 'bg-yellow-100 text-yellow-800',
    SENT: 'bg-blue-100 text-blue-800',
    CUSTOMER_ACCEPTED: 'bg-indigo-100 text-indigo-800',
    ACTIVATED: 'bg-green-100 text-green-800',
    FAILED: 'bg-red-100 text-red-800',
    EXPIRED: 'bg-gray-100 text-gray-800',
    PENDING_CANCEL: 'bg-orange-100 text-orange-800',
    CANCELLED: 'bg-gray-100 text-gray-800',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">초대 관리</h1>
        <div className="flex flex-wrap gap-2">
          {['', 'PENDING_SEND', 'SENT', 'CUSTOMER_ACCEPTED', 'ACTIVATED', 'FAILED'].map((s) => (
            <Link
              key={s || 'all'}
              href={s ? `/admin/invitations?status=${s}` : '/admin/invitations'}
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
              <th className="text-left px-4 py-3 font-medium">초대 이메일</th>
              <th className="text-left px-4 py-3 font-medium">그룹</th>
              <th className="text-center px-4 py-3 font-medium">상태</th>
              <th className="text-right px-4 py-3 font-medium">생성일</th>
              <th className="text-center px-4 py-3 font-medium">관리</th>
            </tr>
          </thead>
          <tbody>
            {invitations.map((inv) => (
              <tr key={inv.id} className="border-t hover:bg-muted/30">
                <td className="px-4 py-3 text-muted-foreground">{inv.subscription.user.email}</td>
                <td className="px-4 py-3">{inv.subscription.product.name}</td>
                <td className="px-4 py-3 font-mono text-xs">{inv.inviteEmail}</td>
                <td className="px-4 py-3 text-xs">{inv.allocation.slot.group.name}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[inv.status] ?? 'bg-gray-100 text-gray-800'}`}>
                    {STATUS_LABEL[inv.status] ?? inv.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                  {formatDateTime(inv.createdAt)}
                </td>
                <td className="px-4 py-3 text-center space-x-2">
                  {inv.status === 'PENDING_SEND' && (
                    <form action={`/api/admin/invitations/${inv.id}/record-sent`} method="POST" className="inline">
                      <button type="submit" className="text-xs text-blue-600 hover:underline">발송 완료</button>
                    </form>
                  )}
                  {inv.status === 'SENT' && (
                    <form action={`/api/admin/invitations/${inv.id}/confirm-activation`} method="POST" className="inline">
                      <button type="submit" className="text-xs text-green-600 hover:underline">활성화 확인</button>
                    </form>
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
              href={`/admin/invitations?${status ? `status=${status}&` : ''}page=${p}`}
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
