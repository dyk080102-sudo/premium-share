'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    try {
      const res = await fetch('/api/auth/reset-password/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (data.success) {
        setStatus('success')
        setMessage('비밀번호 재설정 링크가 이메일로 발송되었습니다.')
      } else {
        setStatus('error')
        setMessage(data.error ?? '오류가 발생했습니다.')
      }
    } catch {
      setStatus('error')
      setMessage('서버 오류가 발생했습니다.')
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      setStatus('error')
      setMessage('비밀번호가 일치하지 않습니다.')
      return
    }
    setStatus('loading')
    try {
      const res = await fetch('/api/auth/reset-password/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (data.success) {
        setStatus('success')
        setMessage('비밀번호가 재설정되었습니다. 로그인 페이지로 이동합니다.')
        setTimeout(() => window.location.href = '/auth/login', 2000)
      } else {
        setStatus('error')
        setMessage(data.error ?? '오류가 발생했습니다.')
      }
    } catch {
      setStatus('error')
      setMessage('서버 오류가 발생했습니다.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Link href="/" className="text-2xl font-bold text-primary">PremiumShare</Link>
          <h1 className="mt-4 text-xl font-semibold">
            {token ? '새 비밀번호 설정' : '비밀번호 재설정'}
          </h1>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          {status === 'success' ? (
            <div className="text-center space-y-4">
              <div className="text-4xl">✅</div>
              <p className="text-sm text-green-700">{message}</p>
              <Link href="/auth/login" className="text-sm text-primary hover:underline">
                로그인으로 이동
              </Link>
            </div>
          ) : token ? (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">새 비밀번호</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="최소 8자 이상"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">비밀번호 확인</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              {status === 'error' && (
                <p className="text-sm text-red-600">{message}</p>
              )}
              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full rounded-md bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {status === 'loading' ? '처리중...' : '비밀번호 재설정'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRequestReset} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                가입하신 이메일 주소를 입력하시면 비밀번호 재설정 링크를 보내드립니다.
              </p>
              <div>
                <label className="block text-sm font-medium mb-1">이메일</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="example@email.com"
                />
              </div>
              {status === 'error' && (
                <p className="text-sm text-red-600">{message}</p>
              )}
              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full rounded-md bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {status === 'loading' ? '발송중...' : '재설정 링크 발송'}
              </button>
              <div className="text-center">
                <Link href="/auth/login" className="text-sm text-primary hover:underline">
                  로그인으로 돌아가기
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">로딩중...</div>}>
      <ResetPasswordForm />
    </Suspense>
  )
}
