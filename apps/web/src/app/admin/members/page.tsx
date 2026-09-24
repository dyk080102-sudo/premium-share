import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import prisma from '@/lib/db/prisma'
import { formatDateTime } from '@/lib/utils'
import Link from 'next/link'
import { MemberPermissionsControls } from './MemberPermissionsControls'

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: { role?: string; page?: string; q?: string }
}) {
  const user = await getCurrentUser()
  if (!user || !['SUPER_ADMIN', 'OPERATOR'].includes(user.role)) {
    redirect('/admin')
  }

  const page = parseInt(searchParams.page ?? '1')
  const role = searchParams.role
  const q = searchParams.q
  const limit = 30
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = {}
  if (role) where.role = role
  if (q) where.email = { contains: q, mode: 'insensitive' }

  const [members, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        loginAttempts: true,
        lockedUntil: true,
        _count: {
          select: { orders: true, subscriptions: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.user.count({ where }),
  ])

  const totalPages = Math.ceil(total / limit)

  const ROLE_LABEL: Record<string, string> = {
    MEMBER: '일반',
    SUPPORT: '서포트',
    OPERATOR: '운영자',
    SUPER_ADMIN: '관리자',
  }

  const canEditRole = user.role === 'SUPER_ADMIN'
  const canEditActive = ['SUPER_ADMIN', 'OPERATOR'].includes(user.role)

  const queryBase = [
    role ? `role=${role}` : '',
    q ? `q=${encodeURIComponent(q)}` : '',
  ]
    .filter(Boolean)
    .join('&')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">회원 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {canEditRole
              ? '역할·활성 상태를 변경하면 즉시 사이트 접근 권한에 반영됩니다.'
              : '활성/비활성만 변경할 수 있습니다. 역할 변경은 최고 관리자만 가능합니다.'}
          </p>
        </div>
      </div>

      <div className="flex gap-3 items-center flex-wrap">
        <form className="flex gap-2">
          {role && <input type="hidden" name="role" value={role} />}
          <input
            name="q"
            defaultValue={q}
            placeholder="이메일 검색..."
            className="rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button type="submit" className="rounded-md bg-primary px-3 py-1.5 text-sm text-white">검색</button>
        </form>
        <div className="flex gap-2">
          {['', 'MEMBER', 'OPERATOR', 'SUPPORT', 'SUPER_ADMIN'].map((r) => (
            <Link
              key={r || 'all'}
              href={`/admin/members?${[
                r ? `role=${r}` : '',
                q ? `q=${encodeURIComponent(q)}` : '',
              ]
                .filter(Boolean)
                .join('&')}`}
              className={`rounded-md px-3 py-1.5 text-xs font-medium border ${
                (role ?? '') === r ? 'bg-primary text-white border-primary' : 'bg-card border-border hover:bg-muted'
              }`}
            >
              {r ? (ROLE_LABEL[r] ?? r) : '전체'}
            </Link>
          ))}
        </div>
      </div>

      <div className="text-sm text-muted-foreground">총 {total}명</div>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium">이메일</th>
              <th className="text-center px-4 py-3 font-medium">권한 / 상태</th>
              <th className="text-center px-4 py-3 font-medium">주문</th>
              <th className="text-center px-4 py-3 font-medium">구독</th>
              <th className="text-right px-4 py-3 font-medium">가입일</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="border-t hover:bg-muted/30">
                <td className="px-4 py-3">
                  <div>{member.email}</div>
                  {member.lockedUntil && member.lockedUntil > new Date() && (
                    <div className="text-xs text-red-500">잠금 ({member.loginAttempts}회 실패)</div>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <MemberPermissionsControls
                    memberId={member.id}
                    memberEmail={member.email}
                    initialRole={member.role}
                    initialIsActive={member.isActive}
                    isLocked={Boolean(member.lockedUntil && member.lockedUntil > new Date())}
                    canEditRole={canEditRole}
                    canEditActive={canEditActive}
                    isSelf={member.id === user.id}
                  />
                </td>
                <td className="px-4 py-3 text-center">{member._count.orders}</td>
                <td className="px-4 py-3 text-center">{member._count.subscriptions}</td>
                <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                  {formatDateTime(member.createdAt)}
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
              href={`/admin/members?${queryBase}${queryBase ? '&' : ''}page=${p}`}
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
