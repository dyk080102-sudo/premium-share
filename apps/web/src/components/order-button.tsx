'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function OrderButton({ planId }: { planId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleOrder = async () => {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          idempotencyKey: `order-${planId}-${Date.now()}`,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error ?? '주문에 실패했습니다.')
        return
      }
      const orderId = data.data?.id ?? data.data?.order?.id
      if (!orderId) {
        setError('주문은 생성되었지만 주문 번호를 확인할 수 없습니다.')
        return
      }
      router.push(`/orders/${orderId}`)
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
        onClick={handleOrder}
        disabled={loading}
        className="w-full rounded-md bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
      >
        {loading ? '주문 중...' : '주문하기'}
      </button>
    </div>
  )
}
