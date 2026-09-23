'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function NewTicketPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const form = new FormData(e.currentTarget)
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.get('title'),
          content: form.get('content'),
          priority: form.get('priority'),
        }),
      })
      const data = await res.json()
      if (data.success) {
        router.push(`/tickets/${data.data.id}`)
      } else {
        setError(data.error ?? '오류가 발생했습니다.')
        setLoading(false)
      }
    } catch {
      setError('서버 오류가 발생했습니다.')
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/tickets" className="text-sm text-muted-foreground hover:underline">← 문의 목록</Link>
        <h1 className="text-2xl font-bold">문의 작성</h1>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">제목 *</label>
            <input
              name="title"
              type="text"
              required
              maxLength={200}
              placeholder="문의 제목을 입력하세요"
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">우선순위</label>
            <select
              name="priority"
              defaultValue="MEDIUM"
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="LOW">낮음</option>
              <option value="MEDIUM">보통</option>
              <option value="HIGH">높음</option>
              <option value="URGENT">긴급</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">문의 내용 *</label>
            <textarea
              name="content"
              required
              rows={6}
              placeholder="문의 내용을 상세히 작성해 주세요..."
              className="w-full rounded-md border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 rounded bg-red-50 border border-red-200 p-3">{error}</p>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-primary px-6 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? '제출중...' : '문의 제출'}
            </button>
            <Link
              href="/tickets"
              className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
            >
              취소
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
