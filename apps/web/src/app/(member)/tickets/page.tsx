import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import Link from 'next/link'
import prisma from '@/lib/db/prisma'
import { formatDate } from '@/lib/utils'

const STATUS_LABEL: Record<string, string> = {
  OPEN: '접수됨',
  IN_PROGRESS: '처리중',
  RESOLVED: '해결됨',
  CLOSED: '종료됨',
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

export default async function TicketsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/login')

  const tickets = await prisma.ticket.findMany({
    where: { userId: user.id },
    include: {
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { updatedAt: 'desc' },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">문의 내역</h1>
        <Link
          href="/tickets/new"
          className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white"
        >
          문의 작성
        </Link>
      </div>

      {tickets.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">
          <p className="mb-4">문의 내역이 없습니다.</p>
          <Link href="/tickets/new" className="inline-flex rounded-md bg-primary px-4 py-2 text-sm text-white">
            첫 문의 작성
          </Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {tickets.map((ticket) => (
            <Link
              key={ticket.id}
              href={`/tickets/${ticket.id}`}
              className="rounded-lg border bg-card p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium flex-shrink-0 ${STATUS_CLASS[ticket.status] ?? 'bg-gray-100 text-gray-800'}`}>
                      {STATUS_LABEL[ticket.status] ?? ticket.status}
                    </span>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      [{PRIORITY_LABEL[ticket.priority] ?? ticket.priority}]
                    </span>
                  </div>
                  <div className="font-medium truncate">{ticket.title}</div>
                  {ticket.messages[0] && (
                    <div className="text-sm text-muted-foreground truncate">
                      {ticket.messages[0].content}
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground flex-shrink-0 ml-4">
                  {formatDate(ticket.updatedAt)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
