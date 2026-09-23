import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import Link from 'next/link'
import prisma from '@/lib/db/prisma'
import { formatDateTime } from '@/lib/utils'

export default async function TicketDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/login')

  const ticket = await prisma.ticket.findUnique({
    where: { id: params.id },
    include: {
      messages: {
        where: { isInternal: false },
        include: { author: { select: { id: true, email: true, role: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!ticket || ticket.userId !== user.id) notFound()

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

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/tickets" className="text-sm text-muted-foreground hover:underline">← 문의 목록</Link>
        <h1 className="text-xl font-bold">문의 상세</h1>
      </div>

      {/* Ticket Header */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-lg">{ticket.title}</h2>
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${STATUS_CLASS[ticket.status] ?? 'bg-gray-100 text-gray-800'}`}>
            {STATUS_LABEL[ticket.status] ?? ticket.status}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">접수: {formatDateTime(ticket.createdAt)}</p>
      </div>

      {/* Messages */}
      <div className="space-y-4">
        {ticket.messages.map((message) => {
          const isAdmin = message.author.role !== 'MEMBER'
          return (
            <div
              key={message.id}
              className={`rounded-lg border p-4 ${isAdmin ? 'bg-blue-50 border-blue-200 ml-8' : 'bg-card mr-8'}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-semibold ${isAdmin ? 'text-blue-700' : 'text-gray-700'}`}>
                  {isAdmin ? '🛠️ 운영팀' : '👤 나'}
                </span>
                <span className="text-xs text-muted-foreground">{formatDateTime(message.createdAt)}</span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            </div>
          )
        })}
      </div>

      {/* Reply Form */}
      {ticket.status !== 'CLOSED' && (
        <div className="rounded-lg border bg-card p-6">
          <h3 className="font-semibold mb-4">추가 문의</h3>
          <form action={`/api/tickets/${ticket.id}/messages`} method="POST" className="space-y-3">
            <textarea
              name="content"
              rows={4}
              required
              placeholder="추가 문의 내용을 입력하세요..."
              className="w-full rounded-md border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="submit"
              className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
            >
              답변 보내기
            </button>
          </form>
        </div>
      )}

      <Link href="/tickets" className="inline-flex rounded-md border px-4 py-2 text-sm hover:bg-muted">
        목록으로
      </Link>
    </div>
  )
}
