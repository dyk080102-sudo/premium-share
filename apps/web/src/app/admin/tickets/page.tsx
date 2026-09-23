import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import Link from 'next/link'
import prisma from '@/lib/db/prisma'
import { formatDateTime } from '@/lib/utils'

export default async function AdminTicketsPage({
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
    ? { status: status as 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' }
    : {}

  const [tickets, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      include: {
        user: { select: { email: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.ticket.count({ where }),
  ])

  const totalPages = Math.ceil(total / limit)

  const STATUS_LABEL: Record<string, string> = {
    OPEN: '접수',
    IN_PROGRESS: '처리중',
    RESOLVED: '해결',
    CLOSED: '종료',
  }

  const STATUS_CLASS: Record<string, string> = {
    OPEN: 'bg-yellow-100 text-yellow-800',
    IN_PROGRESS: 'bg-blue-100 text-blue-800',
    RESOLVED: 'bg-green-100 text-green-800',
    CLOSED: 'bg-gray-100 text-gray-800',
  }

  const PRIORITY_LABEL: Record<string, string> = {
    LOW: '낮음',
    MEDIUM: '보통',
    HIGH: '높음',
    URGENT: '긴급',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">문의 관리</h1>
        <div className="flex gap-2">
          {['', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((s) => (
            <Link
              key={s || 'all'}
              href={s ? `/admin/tickets?status=${s}` : '/admin/tickets'}
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
              <th className="text-left px-4 py-3 font-medium">제목</th>
              <th className="text-left px-4 py-3 font-medium">회원</th>
              <th className="text-center px-4 py-3 font-medium">우선순위</th>
              <th className="text-center px-4 py-3 font-medium">상태</th>
              <th className="text-right px-4 py-3 font-medium">업데이트</th>
            </tr>
          </thead>
          <tbody>
            {tickets.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  문의가 없습니다.
                </td>
              </tr>
            ) : (
              tickets.map((ticket) => (
                <tr key={ticket.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link href={`/tickets/${ticket.id}`} className="font-medium hover:underline">
                      {ticket.title}
                    </Link>
                    {ticket.messages[0] && (
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                        {ticket.messages[0].content}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{ticket.user.email}</td>
                  <td className="px-4 py-3 text-center text-xs">{PRIORITY_LABEL[ticket.priority] ?? ticket.priority}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[ticket.status] ?? 'bg-gray-100 text-gray-800'}`}>
                      {STATUS_LABEL[ticket.status] ?? ticket.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                    {formatDateTime(ticket.updatedAt)}
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
              href={`/admin/tickets?${status ? `status=${status}&` : ''}page=${p}`}
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
