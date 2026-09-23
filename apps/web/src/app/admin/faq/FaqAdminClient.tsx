'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Faq = {
  id: string
  category: string
  question: string
  answer: string
  sortOrder: number
  isActive: boolean
}

export function FaqAdminClient({ faqs, canDelete }: { faqs: Faq[]; canDelete: boolean }) {
  const router = useRouter()
  const [form, setForm] = useState({ category: '', question: '', answer: '', sortOrder: 0 })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/admin/faq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error ?? '등록에 실패했습니다.')
        return
      }
      setForm({ category: '', question: '', answer: '', sortOrder: 0 })
      router.refresh()
    } catch {
      setError('서버 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const toggleActive = async (faq: Faq) => {
    await fetch(`/api/admin/faq/${faq.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !faq.isActive }),
    })
    router.refresh()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 FAQ를 삭제할까요?')) return
    await fetch(`/api/admin/faq/${id}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <div className="space-y-8">
      <form onSubmit={handleCreate} className="rounded-lg border bg-card p-6 space-y-3 max-w-2xl">
        <h2 className="font-semibold">FAQ 추가</h2>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <input
          required
          placeholder="카테고리"
          value={form.category}
          onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
        <input
          required
          placeholder="질문"
          value={form.question}
          onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
        <textarea
          required
          placeholder="답변"
          value={form.answer}
          onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))}
          className="w-full rounded-md border px-3 py-2 text-sm min-h-[100px]"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? '등록 중...' : '등록'}
        </button>
      </form>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium">카테고리</th>
              <th className="text-left px-4 py-3 font-medium">질문</th>
              <th className="text-center px-4 py-3 font-medium">공개</th>
              <th className="text-right px-4 py-3 font-medium">동작</th>
            </tr>
          </thead>
          <tbody>
            {faqs.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                  등록된 FAQ가 없습니다.
                </td>
              </tr>
            ) : (
              faqs.map((faq) => (
                <tr key={faq.id} className="border-t">
                  <td className="px-4 py-3">{faq.category}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{faq.question}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2 mt-1">{faq.answer}</div>
                  </td>
                  <td className="px-4 py-3 text-center">{faq.isActive ? '공개' : '숨김'}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => toggleActive(faq)}
                      className="text-xs text-primary hover:underline"
                    >
                      {faq.isActive ? '숨기기' : '공개'}
                    </button>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => handleDelete(faq.id)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        삭제
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
