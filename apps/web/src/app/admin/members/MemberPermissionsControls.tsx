'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const ROLES = [
  { value: 'MEMBER', label: '일반' },
  { value: 'SUPPORT', label: '서포트' },
  { value: 'OPERATOR', label: '운영자' },
  { value: 'SUPER_ADMIN', label: '관리자' },
] as const

type Props = {
  memberId: string
  memberEmail: string
  initialRole: string
  initialIsActive: boolean
  isLocked: boolean
  canEditRole: boolean
  canEditActive: boolean
  isSelf: boolean
}

export function MemberPermissionsControls({
  memberId,
  memberEmail,
  initialRole,
  initialIsActive,
  isLocked,
  canEditRole,
  canEditActive,
  isSelf,
}: Props) {
  const router = useRouter()
  const [role, setRole] = useState(initialRole)
  const [isActive, setIsActive] = useState(initialIsActive)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  useEffect(() => {
    setRole(initialRole)
    setIsActive(initialIsActive)
  }, [initialRole, initialIsActive])

  const patch = async (
    body: Record<string, unknown>,
    options?: { confirmMsg?: string; optimistic?: () => void; revert?: () => void },
  ) => {
    if (options?.confirmMsg && !confirm(options.confirmMsg)) return
    setError('')
    setOk('')
    options?.optimistic?.()
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        options?.revert?.()
        setError(data.error ?? '변경에 실패했습니다.')
        return
      }
      if (data.data.role) setRole(data.data.role)
      if (typeof data.data.isActive === 'boolean') setIsActive(data.data.isActive)
      setOk('반영됨')
      router.refresh()
    } catch {
      options?.revert?.()
      setError('서버 오류')
    } finally {
      setLoading(false)
    }
  }

  const onRoleChange = (next: string) => {
    if (next === role) return
    const prev = role
    const label = ROLES.find((r) => r.value === next)?.label ?? next
    void patch(
      { role: next },
      {
        confirmMsg: `${memberEmail} 권한을 「${label}」로 변경할까요?\n즉시 사이트 접근 권한에 반영됩니다.`,
        optimistic: () => setRole(next),
        revert: () => setRole(prev),
      },
    )
  }

  const onActiveToggle = () => {
    const next = !isActive
    const prev = isActive
    void patch(
      { isActive: next },
      {
        confirmMsg: next
          ? `${memberEmail} 계정을 활성화할까요?`
          : `${memberEmail} 계정을 비활성화할까요?\n비활성 회원은 로그인할 수 없습니다.`,
        optimistic: () => setIsActive(next),
        revert: () => setIsActive(prev),
      },
    )
  }

  const onUnlock = () => {
    void patch(
      { resetLoginAttempts: true },
      { confirmMsg: `${memberEmail} 로그인 잠금을 해제할까요?` },
    )
  }

  return (
    <div className="flex flex-col items-center gap-1.5 min-w-[7.5rem]">
      {canEditRole ? (
        <select
          value={role}
          disabled={loading}
          onChange={(e) => onRoleChange(e.target.value)}
          className="w-full rounded-md border border-input bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
          aria-label="회원 역할"
        >
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      ) : (
        <span className="text-xs text-muted-foreground">
          {ROLES.find((r) => r.value === role)?.label ?? role}
        </span>
      )}

      <div className="flex flex-wrap items-center justify-center gap-1">
        {canEditActive && (
          <button
            type="button"
            disabled={loading || (isSelf && isActive)}
            onClick={onActiveToggle}
            className={`rounded px-2 py-0.5 text-[10px] font-medium border disabled:opacity-50 ${
              isActive
                ? 'border-green-200 bg-green-50 text-green-800 hover:bg-green-100'
                : 'border-red-200 bg-red-50 text-red-800 hover:bg-red-100'
            }`}
          >
            {isActive ? '활성' : '비활성'}
          </button>
        )}
        {isLocked && canEditActive && (
          <button
            type="button"
            disabled={loading}
            onClick={onUnlock}
            className="rounded px-2 py-0.5 text-[10px] font-medium border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 disabled:opacity-50"
          >
            잠금해제
          </button>
        )}
      </div>

      {error && <p className="text-[10px] text-red-600 text-center max-w-[9rem]">{error}</p>}
      {ok && !error && <p className="text-[10px] text-green-600">{ok}</p>}
    </div>
  )
}
