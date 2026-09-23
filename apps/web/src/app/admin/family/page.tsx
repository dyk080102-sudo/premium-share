import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import prisma from '@/lib/db/prisma'
import Link from 'next/link'
import { FamilyCapacityService } from '@premium-share/domain'

export default async function AdminFamilyPage() {
  const user = await getCurrentUser()
  if (!user || !['SUPER_ADMIN', 'OPERATOR', 'SUPPORT'].includes(user.role)) {
    redirect('/admin')
  }

  const canMutate = ['SUPER_ADMIN', 'OPERATOR'].includes(user.role)

  const groups = await prisma.subscriptionGroup.findMany({
    where: { status: 'ACTIVE' },
    include: {
      product: { select: { name: true } },
      ownerAccount: { select: { email: true, id: true } },
      familyAutomationSetting: true,
      familyLink: true,
      familyJobs: {
        orderBy: { requestedAt: 'desc' },
        take: 3,
      },
    },
    orderBy: { name: 'asc' },
  })

  const emergency = await prisma.appSetting.findUnique({
    where: { key: 'family.global_emergency_stop' },
  })
  const emergencyOn = emergency?.value === 'true' || emergency?.value === '1'

  const capacityService = new FamilyCapacityService(prisma)

  // Resolve all per-group capacity lookups before building JSX.
  // Awaiting inside JSX expressions is not supported by React's RSC renderer.
  const groupCards = await Promise.all(
    groups.map(async (group) => {
      const setting = group.familyAutomationSetting
      const cap = await capacityService.getGroupCapacity(group.id)
      return (
        <Link
          key={group.id}
          href={`/admin/family/${group.id}`}
          className="rounded-lg border bg-card p-5 hover:border-primary transition-colors block"
        >
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="font-semibold">{group.name}</div>
              <div className="text-sm text-muted-foreground">
                {group.product.name} · {group.ownerAccount.email}
              </div>
            </div>
            <div className="flex gap-2 flex-wrap justify-end">
              <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-800">
                {setting?.mode ?? '미설정'}
              </span>
              {setting?.paused && (
                <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800">
                  PAUSED
                </span>
              )}
              {cap.contradictory && (
                <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-100 text-red-800">
                  정원모순
                </span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mt-3">
            <div>
              <div className="text-muted-foreground text-xs">외부키</div>
              <div>{group.familyLink?.externalGroupKey ?? '—'}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">정원/배정가능</div>
              <div>
                {cap.capacityTotal} / {cap.assignable}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">최근 조회</div>
              <div>
                {group.familyLink?.lastInspectedAt
                  ? new Date(group.familyLink.lastInspectedAt).toLocaleString('ko-KR')
                  : '—'}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">최근 작업</div>
              <div>
                {group.familyJobs[0]
                  ? `${group.familyJobs[0].type} · ${group.familyJobs[0].status}`
                  : '—'}
              </div>
            </div>
          </div>
        </Link>
      )
    }),
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">가족 자동화</h1>
          <p className="text-sm text-muted-foreground mt-1">
            DEMO 모의 화면만 자동 클릭. AUTHORIZED_BROWSER는 잠금(실 UI 미검증).
          </p>
        </div>
        {canMutate && (
          <form action="/api/admin/family/emergency-stop" method="POST" id="emergency-form">
            {/* client-less toggle via fetch in detail; list shows status */}
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                emergencyOn
                  ? 'bg-red-100 text-red-800'
                  : 'bg-green-100 text-green-800'
              }`}
            >
              긴급정지: {emergencyOn ? 'ON' : 'OFF'}
            </span>
          </form>
        )}
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Google/YouTube 공식 허가가 아닙니다. 비밀번호·세션·쿠키는 저장하지 않습니다.
        기본 모드: DEMO · AUTHORIZED_BROWSER_ENABLED=false
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">활성 그룹 {groups.length}개</div>
        <Link
          href="/admin/csv-allocator"
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted transition-colors"
        >
          📂 CSV 계정 배치
        </Link>
      </div>

      <div className="grid gap-4">{groupCards}</div>
    </div>
  )
}
