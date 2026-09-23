'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function DemoPayButton({ orderId }: { orderId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handlePay = async () => {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/demo/payment/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, scenario: 'success' }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error ?? '결제에 실패했습니다.')
        return
      }
      router.refresh()
    } catch {
      setError('서버 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="button"
        onClick={handlePay}
        disabled={loading}
        className="w-full rounded-md bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
      >
        {loading ? '결제 처리 중...' : 'DEMO 결제 완료'}
      </button>
    </div>
  )
}
