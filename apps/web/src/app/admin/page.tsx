import prisma from '@/lib/db/prisma'
import { formatPrice } from '@/lib/utils'
import Link from 'next/link'

export default async function AdminDashboardPage() {
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const [
    totalMembers,
    activeSubscriptions,
    pendingPayments,
    pendingTasks,
    pendingRefunds,
    expiringSubscriptions,
    revenue30d,
    newMembers30d,
    familyJobsPending,
    familyJobsInProgress,
    familyJobsFailed24h,
  ] = await Promise.all([
    prisma.user.count({ where: { role: 'MEMBER', isActive: true } }),
    prisma.subscription.count({ where: { status: 'ACTIVE' } }),
    prisma.payment.count({ where: { status: 'PENDING' } }),
    prisma.operationTask.count({ where: { status: { in: ['PENDING', 'IN_PROGRESS'] } } }),
    prisma.refund.count({ where: { status: { in: ['REQUESTED', 'REVIEWING'] } } }),
    prisma.subscription.count({
      where: { status: 'EXPIRING', expiresAt: { gte: now, lte: threeDaysFromNow } },
    }),
    prisma.payment.aggregate({
      where: { status: 'CONFIRMED', confirmedAt: { gte: thirtyDaysAgo } },
      _sum: { amountKrw: true },
    }),
    prisma.user.count({ where: { role: 'MEMBER', createdAt: { gte: thirtyDaysAgo } } }),
    prisma.familyJob.count({ where: { status: 'QUEUED' } }),
    prisma.familyJob.count({ where: { status: 'IN_PROGRESS' } }),
    prisma.familyJob.count({ where: { status: 'FAILED', requestedAt: { gte: oneDayAgo } } }),
  ])

  const recentTasks = await prisma.operationTask.findMany({
    where: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
    include: {
      subscription: { include: { user: { select: { email: true } } } },
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    take: 10,
  })

  const stats = [
    { label: '전체 회원', value: totalMembers.toLocaleString(), sub: `+${newMembers30d} (30일)`, color: 'bg-blue-50 border-blue-200', icon: '👥' },
    { label: '활성 구독', value: activeSubscriptions.toLocaleString(), color: 'bg-green-50 border-green-200', icon: '✅' },
    { label: '결제 대기', value: pendingPayments.toLocaleString(), color: pendingPayments > 0 ? 'bg-yellow-50 border-yellow-300' : 'bg-gray-50 border-gray-200', icon: '💳' },
    { label: '처리 대기 작업', value: pendingTasks.toLocaleString(), color: pendingTasks > 0 ? 'bg-orange-50 border-orange-300' : 'bg-gray-50 border-gray-200', icon: '📋' },
    { label: '환불 대기', value: pendingRefunds.toLocaleString(), color: pendingRefunds > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200', icon: '💰' },
    { label: '만료 임박 (3일)', value: expiringSubscriptions.toLocaleString(), color: expiringSubscriptions > 0 ? 'bg-orange-50 border-orange-300' : 'bg-gray-50 border-gray-200', icon: '⏰' },
    { label: '30일 매출', value: formatPrice(revenue30d._sum.amountKrw ?? 0), color: 'bg-purple-50 border-purple-200', icon: '📈' },
  ]

  const taskTypeLabel: Record<string, string> = {
    INVITE_SEND: '초대 발송',
    INVITE_ACTIVATE: '이용 시작 확인',
    SLOT_RECLAIM: '슬롯 회수',
    RENEWAL_REMIND: '갱신 알림',
    REVIEW_REFUND: '환불 검토',
    MANUAL_PAYMENT_CONFIRM: '결제 확인',
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">대시보드</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className={`rounded-lg border p-4 ${s.color}`}>
            <div className="flex items-center justify-between">
              <div className="text-2xl">{s.icon}</div>
            </div>
            <div className="mt-2 text-2xl font-bold">{s.value}</div>
            <div className="text-sm text-muted-foreground">{s.label}</div>
            {s.sub && <div className="text-xs text-muted-foreground">{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* Pending Tasks */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">대기 중인 작업 ({pendingTasks})</h2>
          <div className="flex gap-2">
            <Link href="/admin/payments" className="text-sm text-primary hover:underline">
              결제 확인 →
            </Link>
          </div>
        </div>

        {recentTasks.length === 0 ? (
          <div className="rounded-lg border bg-card p-6 text-center text-muted-foreground">
            대기 중인 작업이 없습니다. 🎉
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">유형</th>
                  <th className="text-left px-4 py-3 font-medium">회원</th>
                  <th className="text-left px-4 py-3 font-medium">상태</th>
                  <th className="text-right px-4 py-3 font-medium">우선순위</th>
                </tr>
              </thead>
              <tbody>
                {recentTasks.map((task) => (
                  <tr key={task.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">
                      {taskTypeLabel[task.type] ?? task.type}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {task.subscription?.user?.email ?? '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800">
                        {task.status === 'PENDING' ? '대기' : '진행중'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">{task.priority}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Alerts */}
      {(pendingPayments > 0 || pendingRefunds > 0 || expiringSubscriptions > 0) && (
        <section>
          <h2 className="text-lg font-semibold mb-4">알림</h2>
          <div className="space-y-2">
            {pendingPayments > 0 && (
              <Link href="/admin/payments?status=PENDING"
                className="flex items-center gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-3 hover:bg-yellow-100">
                <span className="text-yellow-600">💳</span>
                <span className="text-sm"><strong>{pendingPayments}건</strong>의 결제 확인을 기다리고 있습니다.</span>
              </Link>
            )}
            {pendingRefunds > 0 && (
              <Link href="/admin/refunds?status=REQUESTED"
                className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-3 hover:bg-red-100">
                <span className="text-red-600">💰</span>
                <span className="text-sm"><strong>{pendingRefunds}건</strong>의 환불 신청을 검토해야 합니다.</span>
              </Link>
            )}
            {expiringSubscriptions > 0 && (
              <div className="flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 p-3">
                <span className="text-orange-600">⏰</span>
                <span className="text-sm"><strong>{expiringSubscriptions}개</strong>의 구독이 3일 내에 만료됩니다.</span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 가족 자동화 통합 대시보드 */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">👨‍👩‍👧‍👦 가족 자동화 통합 대시보드</h2>
          <div className="flex gap-3">
            <Link href="/admin/family" className="text-sm text-primary hover:underline">
              그룹 관리 →
            </Link>
            <Link href="/admin/csv-allocator" className="text-sm text-primary hover:underline">
              CSV 배치 →
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className={`rounded-lg border p-4 ${familyJobsPending > 0 ? 'bg-yellow-50 border-yellow-300' : 'bg-gray-50 border-gray-200'}`}>
            <div className="text-2xl">⏳</div>
            <div className="mt-2 text-2xl font-bold">{familyJobsPending}</div>
            <div className="text-sm text-muted-foreground">대기 중 잡</div>
          </div>
          <div className={`rounded-lg border p-4 ${familyJobsInProgress > 0 ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-gray-200'}`}>
            <div className="text-2xl">⚙️</div>
            <div className="mt-2 text-2xl font-bold">{familyJobsInProgress}</div>
            <div className="text-sm text-muted-foreground">진행 중 잡</div>
          </div>
          <div className={`rounded-lg border p-4 ${familyJobsFailed24h > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
            <div className="text-2xl">❌</div>
            <div className="mt-2 text-2xl font-bold">{familyJobsFailed24h}</div>
            <div className="text-sm text-muted-foreground">실패 (24시간)</div>
          </div>
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          ℹ️ 통합 서버(`npm run dev:unified`)를 쓰면 가족 자동화와 워커가 웹과 함께 실행됩니다.
        </div>
      </section>
    </div>
  )
}
