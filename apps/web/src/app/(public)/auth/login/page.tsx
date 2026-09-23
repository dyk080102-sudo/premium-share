'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const data = await res.json()
      if (!data.success) {
        setError(data.error)
        return
      }

      const redirectTo = searchParams.get('redirect')
      const role = data.data.user.role
      if (redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//')) {
        router.push(redirectTo)
      } else if (['SUPER_ADMIN', 'OPERATOR', 'SUPPORT'].includes(role)) {
        router.push('/admin')
      } else {
        router.push('/dashboard')
      }
      router.refresh()
    } catch {
      setError('서버 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <Link href="/" className="text-2xl font-bold text-primary">PremiumShare</Link>
          <h2 className="mt-4 text-2xl font-bold text-gray-900">로그인</h2>
        </div>

        <form className="mt-8 space-y-4 bg-white p-8 rounded-lg shadow" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
            <input
              id="email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="example@email.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
            <input
              id="password"
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="비밀번호 입력"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>

          <div className="text-center text-sm text-muted-foreground space-y-2">
            <div>
              <Link href="/auth/reset-password" className="text-primary hover:underline">
                비밀번호를 잊으셨나요?
              </Link>
            </div>
            <div>
              계정이 없으신가요?{' '}
              <Link href="/auth/register" className="text-primary hover:underline font-medium">
                회원가입
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">로딩 중...</div>}>
      <LoginForm />
    </Suspense>
  )
}
