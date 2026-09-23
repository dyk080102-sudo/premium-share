import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import prisma from '@/lib/db/prisma'
import Link from 'next/link'
import {
  FamilyCapacityService,
  FamilyInviteService,
} from '@premium-share/domain'
import { FamilyGroupActions, FamilyJobRetryButton } from './actions'

export default async function AdminFamilyGroupPage({
  params,
}: {
  params: { groupId: string }
}) {
  const user = await getCurrentUser()
  if (!user || !['SUPER_ADMIN', 'OPERATOR', 'SUPPORT'].includes(user.role)) {
    redirect('/admin')
  }
  const canMutate = ['SUPER_ADMIN', 'OPERATOR'].includes(user.role)

  const group = await prisma.subscriptionGroup.findUnique({
    where: { id: params.groupId },
    include: {
      product: true,
      ownerAccount: true,
      familyAutomationSetting: true,
      familyLink: { include: { externalMembers: true } },
      familyJobs: { orderBy: { requestedAt: 'desc' }, take: 40 },
    },
  })
  if (!group) notFound()

  const consent = await prisma.familyOwnerConsent.findFirst({
    where: { ownerAccountId: group.ownerAccountId, isActive: true },
    orderBy: { consentedAt: 'desc' },
  })

  const capacity = await new FamilyCapacityService(prisma).getGroupCapacity(
    group.id,
  )
  const candidates = await new FamilyInviteService(prisma).listInviteCandidates(
    group.id,
  )

  const setting = group.familyAutomationSetting
  const members =
    group.familyLink?.externalMembers
      .filter((m) => m.kind === 'MEMBER' || m.kind === 'PENDING_INVITE')
      .filter((m) => m.externalStatus !== 'REMOVED')
      .map((m) => ({ email: m.email, allocationId: m.allocationId })) ?? []

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/family" className="text-sm text-muted-foreground hover:underline">
          ← 가족 자동화
        </Link>
        <h1 className="text-2xl font-bold mt-2">{group.name}</h1>
        <p className="text-sm text-muted-foreground">
          {group.product.name} · {group.ownerAccount.email}
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground">모드</div>
          <div className="font-semibold">{setting?.mode ?? '미설정(DEMO 권장)'}</div>
          <div className="text-xs mt-1">
            paused={String(setting?.paused ?? false)} · authorizedEnabled=
            {String(setting?.authorizedEnabled ?? false)}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground">정원</div>
          <div className="font-semibold">
            총 {capacity.capacityTotal} · 배정가능 {capacity.assignable}
          </div>
          {capacity.contradictory && (
            <div className="text-xs text-red-600 mt-1">
              {capacity.reasons.join(' · ')}
            </div>
          )}
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs text-muted-foreground">소유자 동의</div>
          <div className="font-semibold text-sm">
            {consent ? '기록 있음 (Google 공식 허가 아님)' : '없음'}
          </div>
          {consent && (
            <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {consent.evidenceNote}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h2 className="font-semibold mb-3">액션</h2>
        <FamilyGroupActions
          groupId={group.id}
          paused={setting?.paused ?? false}
          canMutate={canMutate}
          candidates={candidates}
          members={members}
        />
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h2 className="font-semibold mb-3">외부 멤버 스냅샷</h2>
        {!group.familyLink?.externalMembers?.length ? (
          <p className="text-sm text-muted-foreground">아직 조회된 멤버 없음</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="py-2">이메일</th>
                <th>종류</th>
                <th>상태</th>
                <th>관측</th>
              </tr>
            </thead>
            <tbody>
              {group.familyLink.externalMembers.map((m) => (
                <tr key={m.id} className="border-b">
                  <td className="py-2">{m.email}</td>
                  <td>{m.kind}</td>
                  <td>{m.externalStatus}</td>
                  <td>{new Date(m.observedAt).toLocaleString('ko-KR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h2 className="font-semibold mb-3">작업 목록</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground border-b">
              <th className="py-2">유형</th>
              <th>상태</th>
              <th>모드</th>
              <th>오류</th>
              <th>요약</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {group.familyJobs.map((j) => (
              <tr key={j.id} className="border-b align-top">
                <td className="py-2">{j.type}</td>
                <td>{j.status}</td>
                <td>{j.mode}</td>
                <td>{j.errorCode ?? '—'}</td>
                <td className="max-w-xs truncate">{j.resultSummary ?? '—'}</td>
                <td>
                  {canMutate &&
                    ['FAILED', 'AWAITING_HUMAN', 'EXTERNAL_RESULT_UNKNOWN', 'CANCELLED'].includes(
                      j.status,
                    ) && <FamilyJobRetryButton jobId={j.id} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
