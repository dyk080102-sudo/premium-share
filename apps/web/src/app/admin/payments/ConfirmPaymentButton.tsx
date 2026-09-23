'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function ConfirmPaymentButton({ paymentId }: { paymentId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleConfirm = async () => {
    if (!confirm('이 결제를 확인 처리할까요?')) return
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/payments/${paymentId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: '관리자 확인' }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error ?? '확인에 실패했습니다.')
        return
      }
      router.refresh()
    } catch {
      setError('서버 오류')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={handleConfirm}
        disabled={loading}
        className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-50"
      >
        {loading ? '처리 중...' : '확인'}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
