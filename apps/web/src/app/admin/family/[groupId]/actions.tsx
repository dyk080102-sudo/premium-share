'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok || !data.success) {
    throw new Error(data.error ?? '요청 실패')
  }
  return data.data
}

export function FamilyGroupActions({
  groupId,
  paused,
  canMutate,
  candidates,
  members,
}: {
  groupId: string
  paused: boolean
  canMutate: boolean
  candidates: Array<{ allocationId: string; email: string }>
  members: Array<{ email: string; allocationId: string | null }>
}) {
  const router = useRouter()
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!canMutate) {
    return (
      <p className="text-sm text-muted-foreground">SUPPORT는 읽기 전용입니다.</p>
    )
  }

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(true)
    setMsg(null)
    try {
      await fn()
      setMsg(`${label} 요청됨`)
      router.refresh()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          className="rounded-md bg-primary px-3 py-1.5 text-sm text-white disabled:opacity-50"
          onClick={() =>
            run('조회(INSPECT)', () =>
              postJson('/api/admin/family/inspect', { groupId }),
            )
          }
        >
          조회 큐잉
        </button>
        <button
          type="button"
          disabled={busy}
          className="rounded-md border px-3 py-1.5 text-sm"
          onClick={() =>
            run(paused ? '재개' : '일시중지', () =>
              postJson('/api/admin/family/pause', {
                groupId,
                paused: !paused,
              }),
            )
          }
        >
          {paused ? '재개' : '일시중지'}
        </button>
        <button
          type="button"
          disabled={busy}
          className="rounded-md border px-3 py-1.5 text-sm"
          onClick={() =>
            run('ASSISTED 전환', () =>
              postJson('/api/admin/family/switch-assisted', { groupId }),
            )
          }
        >
          ASSISTED로 전환
        </button>
        <button
          type="button"
          disabled={busy}
          className="rounded-md border border-red-300 text-red-700 px-3 py-1.5 text-sm"
          onClick={() =>
            run('긴급정지 ON', () =>
              postJson('/api/admin/family/emergency-stop', { active: true }),
            )
          }
        >
          긴급정지 ON
        </button>
        <button
          type="button"
          disabled={busy}
          className="rounded-md border px-3 py-1.5 text-sm"
          onClick={() =>
            run('긴급정지 OFF', () =>
              postJson('/api/admin/family/emergency-stop', { active: false }),
            )
          }
        >
          긴급정지 OFF
        </button>
      </div>

      {candidates.length > 0 && (
        <div className="rounded border p-3 space-y-2">
          <div className="text-sm font-medium">초대 후보</div>
          {candidates.map((c) => (
            <div key={c.allocationId} className="flex items-center justify-between text-sm">
              <span>{c.email}</span>
              <button
                type="button"
                disabled={busy}
                className="rounded border px-2 py-1 text-xs"
                onClick={() =>
                  run(`초대 ${c.email}`, () =>
                    postJson('/api/admin/family/enqueue-invite', {
                      groupId,
                      allocationId: c.allocationId,
                    }),
                  )
                }
              >
                초대 큐잉
              </button>
            </div>
          ))}
        </div>
      )}

      {members.length > 0 && (
        <div className="rounded border p-3 space-y-2">
          <div className="text-sm font-medium">제거 (확인 전 FREE 금지)</div>
          {members.map((m) => (
            <div key={m.email} className="flex items-center justify-between text-sm">
              <span>{m.email}</span>
              <button
                type="button"
                disabled={busy}
                className="rounded border border-red-200 px-2 py-1 text-xs text-red-700"
                onClick={() =>
                  run(`제거 ${m.email}`, () =>
                    postJson('/api/admin/family/enqueue-remove', {
                      groupId,
                      targetEmail: m.email,
                      allocationId: m.allocationId ?? undefined,
                    }),
                  )
                }
              >
                제거 큐잉
              </button>
            </div>
          ))}
        </div>
      )}

      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
    </div>
  )
}

export function FamilyJobRetryButton({ jobId }: { jobId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  return (
    <button
      type="button"
      disabled={busy}
      className="text-xs underline disabled:opacity-50"
      onClick={async () => {
        setBusy(true)
        try {
          await postJson('/api/admin/family/retry', { jobId })
          router.refresh()
        } catch {
          /* ignore */
        } finally {
          setBusy(false)
        }
      }}
    >
      재시도
    </button>
  )
}
