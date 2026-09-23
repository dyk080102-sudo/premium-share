import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import prisma from '@/lib/db/prisma'
import { formatDateTime } from '@/lib/utils'
import Link from 'next/link'

export default async function AdminAuditLogsPage({
  searchParams,
}: {
  searchParams: { targetType?: string; action?: string; page?: string }
}) {
  const user = await getCurrentUser()
  if (!user || !['SUPER_ADMIN', 'OPERATOR'].includes(user.role)) {
    redirect('/admin')
  }

  const page = parseInt(searchParams.page ?? '1')
  const targetType = searchParams.targetType
  const action = searchParams.action
  const limit = 50
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = {}
  if (targetType) where.targetType = targetType
  if (action) where.action = { contains: action, mode: 'insensitive' }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { actor: { select: { email: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ])

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">감사 로그</h1>
        <div className="text-sm text-muted-foreground">총 {total}건</div>
      </div>

      {/* Filters */}
      <form className="flex gap-2 flex-wrap">
        <input
          name="targetType"
          defaultValue={targetType}
          placeholder="대상 유형 (예: Refund)"
          className="rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <input
          name="action"
          defaultValue={action}
          placeholder="액션 검색..."
          className="rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button type="submit" className="rounded-md bg-primary px-3 py-1.5 text-sm text-white">필터</button>
        <Link href="/admin/audit-logs" className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted">초기화</Link>
      </form>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium">시간</th>
              <th className="text-left px-4 py-3 font-medium">행위자</th>
              <th className="text-left px-4 py-3 font-medium">대상</th>
              <th className="text-left px-4 py-3 font-medium">액션</th>
              <th className="text-left px-4 py-3 font-medium">출처</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-t hover:bg-muted/30">
                <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                  {formatDateTime(log.createdAt)}
                </td>
                <td className="px-4 py-2 text-xs">
                  {log.actor?.email ?? (log.actorId ? log.actorId.slice(-8) : '시스템')}
                  {log.actorRole && <span className="ml-1 text-muted-foreground">({log.actorRole})</span>}
                </td>
                <td className="px-4 py-2 text-xs">
                  <span className="font-medium">{log.targetType}</span>
                  {log.targetId && <span className="ml-1 font-mono text-muted-foreground">{log.targetId.slice(-8)}</span>}
                </td>
                <td className="px-4 py-2">
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">{log.action}</code>
                </td>
                <td className="px-4 py-2 text-xs text-muted-foreground">{log.source ?? 'MANUAL'}</td>
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
              href={`/admin/audit-logs?${targetType ? `targetType=${targetType}&` : ''}${action ? `action=${action}&` : ''}page=${p}`}
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
