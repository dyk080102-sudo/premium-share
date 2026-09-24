'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatDateTime } from '@/lib/utils'

type Setting = {
  id: string
  key: string
  value: string
  description: string | null
  updatedAt: string | Date
}

export function AppSettingsEditor({ settings }: { settings: Setting[] }) {
  const router = useRouter()
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(settings.map((s) => [s.key, s.value])),
  )
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [messages, setMessages] = useState<Record<string, { type: 'ok' | 'err'; text: string }>>({})

  useEffect(() => {
    setDrafts(Object.fromEntries(settings.map((s) => [s.key, s.value])))
  }, [settings])

  const save = async (key: string) => {
    setSavingKey(key)
    setMessages((m) => {
      const next = { ...m }
      delete next[key]
      return next
    })
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: drafts[key] ?? '' }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setMessages((m) => ({
          ...m,
          [key]: { type: 'err', text: data.error ?? '저장에 실패했습니다.' },
        }))
        return
      }
      setMessages((m) => ({
        ...m,
        [key]: { type: 'ok', text: '저장됨 — 사이트에 즉시 반영됩니다.' },
      }))
      router.refresh()
    } catch {
      setMessages((m) => ({
        ...m,
        [key]: { type: 'err', text: '서버 오류가 발생했습니다.' },
      }))
    } finally {
      setSavingKey(null)
    }
  }

  if (settings.length === 0) {
    return <p className="text-sm text-muted-foreground">설정 항목이 없습니다.</p>
  }

  return (
    <div className="space-y-3">
      {settings.map((setting) => {
        const msg = messages[setting.key]
        return (
          <div key={setting.id} className="rounded border p-4">
            <div className="flex items-center justify-between mb-2">
              <code className="text-sm font-mono text-primary">{setting.key}</code>
              {setting.updatedAt && (
                <span className="text-xs text-muted-foreground">
                  수정: {formatDateTime(setting.updatedAt)}
                </span>
              )}
            </div>
            {setting.description && (
              <p className="text-xs text-muted-foreground mb-2">{setting.description}</p>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={drafts[setting.key] ?? ''}
                onChange={(e) =>
                  setDrafts((d) => ({ ...d, [setting.key]: e.target.value }))
                }
                className="flex-1 rounded border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="button"
                disabled={savingKey === setting.key}
                onClick={() => void save(setting.key)}
                className="rounded bg-primary px-3 py-1.5 text-sm text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {savingKey === setting.key ? '저장 중...' : '저장'}
              </button>
            </div>
            {msg && (
              <p
                className={`mt-2 text-xs ${
                  msg.type === 'ok' ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {msg.text}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
