'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { readApiError, useToastOptional } from '@/components/ui/toast'

export function ChangePasswordForm() {
  const router = useRouter()
  const toast = useToastOptional()
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const currentPassword = String(fd.get('currentPassword') ?? '')
    const newPassword = String(fd.get('newPassword') ?? '')
    const confirmPassword = String(fd.get('confirmPassword') ?? '')

    if (newPassword !== confirmPassword) {
      setStatus('error')
      setMessage('새 비밀번호가 일치하지 않습니다.')
      toast.error('비밀번호 불일치', '새 비밀번호 확인이 일치하지 않습니다.')
      return
    }

    setStatus('loading')
    setMessage('')
    try {
      const res = await fetch('/api/auth/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) {
        const err = data.error ?? (await readApiError(res))
        setStatus('error')
        setMessage(err)
        toast.error('비밀번호 변경 실패', err)
        return
      }
      setStatus('success')
      setMessage('비밀번호가 변경되었습니다. 다시 로그인해 주세요.')
      toast.success('비밀번호 변경 완료', '보안을 위해 다시 로그인해 주세요.')
      form.reset()
      setTimeout(() => {
        router.push('/auth/login')
        router.refresh()
      }, 1200)
    } catch {
      setStatus('error')
      setMessage('서버 오류가 발생했습니다.')
      toast.error('서버 오류', '잠시 후 다시 시도해 주세요.')
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">현재 비밀번호</label>
        <input
          type="password"
          name="currentPassword"
          required
          autoComplete="current-password"
          className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">새 비밀번호</label>
        <input
          type="password"
          name="newPassword"
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">새 비밀번호 확인</label>
        <input
          type="password"
          name="confirmPassword"
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
      {status === 'error' && <p className="text-sm text-red-600">{message}</p>}
      {status === 'success' && <p className="text-sm text-green-700">{message}</p>}
      <button
        type="submit"
        disabled={status === 'loading'}
        className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
      >
        {status === 'loading' ? '변경 중...' : '비밀번호 변경'}
      </button>
    </form>
  )
}
