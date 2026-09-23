'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ email: '', password: '', passwordConfirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (form.password !== form.passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, password: form.password }),
      })

      const data = await res.json()
      if (!data.success) {
        setError(data.error)
        return
      }

      router.push('/dashboard')
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
          <h2 className="mt-4 text-2xl font-bold text-gray-900">회원가입</h2>
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
              placeholder="영문 대소문자, 숫자, 특수문자 포함 8자 이상"
            />
          </div>

          <div>
            <label htmlFor="passwordConfirm" className="block text-sm font-medium text-gray-700 mb-1">비밀번호 확인</label>
            <input
              id="passwordConfirm"
              type="password"
              required
              value={form.passwordConfirm}
              onChange={(e) => setForm((f) => ({ ...f, passwordConfirm: e.target.value }))}
              className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            가입 시 <Link href="/terms" className="text-primary hover:underline">이용약관</Link> 및{' '}
            <Link href="/privacy" className="text-primary hover:underline">개인정보처리방침</Link>에 동의하는 것으로 간주합니다.
          </p>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? '처리 중...' : '회원가입'}
          </button>

          <div className="text-center text-sm text-muted-foreground">
            이미 계정이 있으신가요?{' '}
            <Link href="/auth/login" className="text-primary hover:underline font-medium">
              로그인
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
