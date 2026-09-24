'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatPrice } from '@/lib/utils'
import { readApiError, useToastOptional } from '@/components/ui/toast'

type BankInfo = {
  bankName: string
  account: string
  accountHolder: string
}

export function BankTransferForm({
  orderId,
  amountKrw,
  bank,
}: {
  orderId: string
  amountKrw: number
  bank: BankInfo
}) {
  const router = useRouter()
  const toast = useToastOptional()
  const [depositorName, setDepositorName] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    setMessage('')
    try {
      const res = await fetch(`/api/orders/${orderId}/payment/bank-transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ depositorName: depositorName.trim(), notes: notes.trim() || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) {
        const err = data.error ?? (await readApiError(res))
        setStatus('error')
        setMessage(err)
        toast.error('입금 신고 실패', err)
        return
      }
      setStatus('success')
      setMessage(data.message ?? '입금 신고가 접수되었습니다.')
      toast.success('입금 신고 완료', '관리자 확인 후 구독이 활성화됩니다.')
      setTimeout(() => {
        router.push(`/orders/${orderId}`)
        router.refresh()
      }, 1000)
    } catch {
      setStatus('error')
      setMessage('서버 오류가 발생했습니다.')
      toast.error('서버 오류', '잠시 후 다시 시도해 주세요.')
    }
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div className="flex items-center gap-4">
        <Link href={`/orders/${orderId}`} className="text-sm text-muted-foreground hover:underline">
          ← 주문 상세
        </Link>
        <h1 className="text-2xl font-bold">입금 신고</h1>
      </div>

      <div className="rounded-lg border bg-card p-6 space-y-3 text-sm">
        <h2 className="font-semibold">입금 계좌</h2>
        <div className="flex justify-between">
          <span className="text-muted-foreground">은행</span>
          <span className="font-medium">{bank.bankName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">계좌번호</span>
          <span className="font-medium font-mono">{bank.account}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">예금주</span>
          <span className="font-medium">{bank.accountHolder}</span>
        </div>
        <div className="flex justify-between border-t pt-3">
          <span className="text-muted-foreground">입금액</span>
          <span className="font-bold text-primary">{formatPrice(amountKrw)}</span>
        </div>
      </div>

      <form onSubmit={onSubmit} className="rounded-lg border bg-card p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">입금자명</label>
          <input
            type="text"
            value={depositorName}
            onChange={(e) => setDepositorName(e.target.value)}
            required
            maxLength={40}
            className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="통장에 표시된 입금자명"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            입금자명이 주문과 일치해야 빠른 확인이 가능합니다.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">메모 (선택)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            maxLength={200}
            className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="추가 안내가 있으면 입력하세요"
          />
        </div>
        {status === 'error' && <p className="text-sm text-red-600">{message}</p>}
        {status === 'success' && <p className="text-sm text-green-700">{message}</p>}
        <button
          type="submit"
          disabled={status === 'loading' || status === 'success'}
          className="w-full rounded-md bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
        >
          {status === 'loading' ? '접수 중...' : '입금 신고하기'}
        </button>
      </form>

      <p className="text-xs text-muted-foreground">
        결제 PG 연동은 준비 중입니다. 현재는 무통장 입금 + 관리자 확인으로 운영됩니다.
      </p>
    </div>
  )
}
