import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import prisma from '@/lib/db/prisma'
import { formatDateTime } from '@/lib/utils'
import Link from 'next/link'

export default async function AdminJobsPage({
  searchParams,
}: {
  searchParams: { status?: string; jobType?: string; page?: string; tab?: string }
}) {
  const user = await getCurrentUser()
  if (!user || !['SUPER_ADMIN', 'OPERATOR'].includes(user.role)) {
    redirect('/admin')
  }

  const page = parseInt(searchParams.page ?? '1')
  const status = searchParams.status
  const jobType = searchParams.jobType
  const tab = searchParams.tab ?? 'system'
  const limit = 50
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (jobType) where.jobType = jobType

  const [jobs, total] = await Promise.all([
    prisma.jobExecution.findMany({
      where,
      orderBy: { scheduledAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.jobExecution.count({ where }),
  ])

  // Family jobs
  const familyWhere: Record<string, unknown> = {}
  if (status) familyWhere.status = status

  const [familyJobs, familyTotal] = await Promise.all([
    prisma.familyJob.findMany({
      where: familyWhere,
      include: {
        group: { select: { name: true } },
      },
      orderBy: { requestedAt: 'desc' },
      take: limit,
      skip,
    }),
    prisma.familyJob.count({ where: familyWhere }),
  ])

  const totalPages = Math.ceil(total / limit)
  const familyTotalPages = Math.ceil(familyTotal / limit)

  const STATUS_CLASS: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    RUNNING: 'bg-blue-100 text-blue-800',
    IN_PROGRESS: 'bg-blue-100 text-blue-800',
    DONE: 'bg-green-100 text-green-800',
    COMPLETED: 'bg-green-100 text-green-800',
    FAILED: 'bg-red-100 text-red-800',
    CANCELLED: 'bg-gray-100 text-gray-800',
    AWAITING_HUMAN: 'bg-orange-100 text-orange-800',
    EXTERNAL_RESULT_UNKNOWN: 'bg-purple-100 text-purple-800',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">작업 이력</h1>
        <div className="text-sm text-muted-foreground">총 {tab === 'family' ? familyTotal : total}건</div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 border-b">
        <Link
          href="/admin/jobs?tab=system"
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab !== 'family' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          ⚙️ 시스템 잡
        </Link>
        <Link
          href="/admin/jobs?tab=family"
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'family' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          👨‍👩‍👧‍👦 가족 자동화 잡
        </Link>
      </div>

      {tab !== 'family' ? (
        <>
          <div className="flex gap-2 flex-wrap">
            {['', 'PENDING', 'RUNNING', 'DONE', 'FAILED'].map((s) => (
              <Link
                key={s || 'all'}
                href={s ? `/admin/jobs?status=${s}` : '/admin/jobs'}
                className={`rounded-md px-3 py-1.5 text-xs font-medium border ${
                  (status ?? '') === s ? 'bg-primary text-white border-primary' : 'bg-card border-border hover:bg-muted'
                }`}
              >
                {s || '전체'}
              </Link>
            ))}
          </div>

          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">작업 유형</th>
                  <th className="text-center px-4 py-3 font-medium">상태</th>
                  <th className="text-right px-4 py-3 font-medium">예약 시간</th>
                  <th className="text-right px-4 py-3 font-medium">시작 시간</th>
                  <th className="text-right px-4 py-3 font-medium">완료 시간</th>
                  <th className="text-center px-4 py-3 font-medium">재시도</th>
                  <th className="text-left px-4 py-3 font-medium">결과</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-2">
                      <code className="text-xs bg-muted px-1 py-0.5 rounded">{job.jobType}</code>
                      {job.targetId && (
                        <span className="ml-1 font-mono text-xs text-muted-foreground">{job.targetId.slice(-8)}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[job.status] ?? 'bg-gray-100 text-gray-800'}`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right text-xs text-muted-foreground">
                      {formatDateTime(job.scheduledAt)}
                    </td>
                    <td className="px-4 py-2 text-right text-xs text-muted-foreground">
                      {job.startedAt ? formatDateTime(job.startedAt) : '-'}
                    </td>
                    <td className="px-4 py-2 text-right text-xs text-muted-foreground">
                      {job.completedAt ? formatDateTime(job.completedAt) : '-'}
                    </td>
                    <td className="px-4 py-2 text-center text-xs">{job.retryCount}</td>
                    <td className="px-4 py-2 text-xs max-w-xs truncate">
                      {job.status === 'FAILED' ? (
                        <span className="text-red-600">{job.errorMessage}</span>
                      ) : (
                        <span className="text-muted-foreground">{job.resultSummary}</span>
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
                  href={`/admin/jobs?${status ? `status=${status}&` : ''}${jobType ? `jobType=${jobType}&` : ''}page=${p}`}
                  className={`rounded px-3 py-1.5 text-sm ${p === page ? 'bg-primary text-white' : 'border hover:bg-muted'}`}
                >
                  {p}
                </Link>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex gap-2 flex-wrap">
            {['', 'PENDING', 'IN_PROGRESS', 'DONE', 'FAILED', 'AWAITING_HUMAN'].map((s) => (
              <Link
                key={s || 'all'}
                href={s ? `/admin/jobs?tab=family&status=${s}` : '/admin/jobs?tab=family'}
                className={`rounded-md px-3 py-1.5 text-xs font-medium border ${
                  (status ?? '') === s ? 'bg-primary text-white border-primary' : 'bg-card border-border hover:bg-muted'
                }`}
              >
                {s || '전체'}
              </Link>
            ))}
          </div>

          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">그룹</th>
                  <th className="text-left px-4 py-3 font-medium">유형</th>
                  <th className="text-center px-4 py-3 font-medium">상태</th>
                  <th className="text-left px-4 py-3 font-medium">모드</th>
                  <th className="text-right px-4 py-3 font-medium">요청 시간</th>
                  <th className="text-left px-4 py-3 font-medium">오류 / 결과</th>
                </tr>
              </thead>
              <tbody>
                {familyJobs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      가족 자동화 잡이 없습니다.
                    </td>
                  </tr>
                ) : (
                  familyJobs.map((job) => (
                    <tr key={job.id} className="border-t hover:bg-muted/30">
                      <td className="px-4 py-2">
                        <Link
                          href={`/admin/family/${job.groupId}`}
                          className="text-primary hover:underline text-xs"
                        >
                          {job.group.name}
                        </Link>
                      </td>
                      <td className="px-4 py-2">
                        <code className="text-xs bg-muted px-1 py-0.5 rounded">{job.type}</code>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[job.status] ?? 'bg-gray-100 text-gray-800'}`}>
                          {job.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{job.mode}</td>
                      <td className="px-4 py-2 text-right text-xs text-muted-foreground">
                        {formatDateTime(job.requestedAt)}
                      </td>
                      <td className="px-4 py-2 text-xs max-w-xs truncate">
                        {job.errorCode ? (
                          <span className="text-red-600">{job.errorCode}</span>
                        ) : (
                          <span className="text-muted-foreground">{job.resultSummary ?? '—'}</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {familyTotalPages > 1 && (
            <div className="flex justify-center gap-2">
              {Array.from({ length: Math.min(familyTotalPages, 10) }, (_, i) => i + 1).map((p) => (
                <Link
                  key={p}
                  href={`/admin/jobs?tab=family${status ? `&status=${status}` : ''}&page=${p}`}
                  className={`rounded px-3 py-1.5 text-sm ${p === page ? 'bg-primary text-white' : 'border hover:bg-muted'}`}
                >
                  {p}
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
