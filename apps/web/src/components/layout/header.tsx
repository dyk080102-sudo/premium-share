'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface HeaderProps {
  user?: {
    email: string
    role: string
  } | null
  isDemoMode?: boolean
}

export function Header({ user, isDemoMode }: HeaderProps) {
  const router = useRouter()

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
    router.refresh()
  }

  return (
    <>
      {isDemoMode && (
        <div className="w-full bg-yellow-400 text-yellow-900 text-center py-1.5 text-sm font-medium">
          🧪 데모 모드 — 실제 결제가 이루어지지 않습니다
        </div>
      )}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-xl font-bold text-primary">PremiumShare</span>
          </Link>

          <nav className="hidden md:flex items-center space-x-6 text-sm font-medium">
            <Link href="/products" className="text-foreground/60 hover:text-foreground transition-colors">
              상품
            </Link>
            <Link href="/faq" className="text-foreground/60 hover:text-foreground transition-colors">
              FAQ
            </Link>
            {user && (
              <>
                <Link href="/dashboard" className="text-foreground/60 hover:text-foreground transition-colors">
                  내 구독
                </Link>
                <Link href="/orders" className="text-foreground/60 hover:text-foreground transition-colors">
                  주문
                </Link>
                {(user.role === 'SUPER_ADMIN' || user.role === 'OPERATOR' || user.role === 'SUPPORT') && (
                  <Link href="/admin" className="text-foreground/60 hover:text-foreground transition-colors font-semibold">
                    관리자
                  </Link>
                )}
              </>
            )}
          </nav>

          <div className="flex items-center space-x-4">
            {user ? (
              <div className="flex items-center space-x-4">
                <Link href="/notifications" className="text-sm text-foreground/60 hover:text-foreground">
                  알림
                </Link>
                <span className="text-sm text-muted-foreground">{user.email}</span>
                <button
                  onClick={handleLogout}
                  className="text-sm text-foreground/60 hover:text-foreground"
                >
                  로그아웃
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  href="/auth/login"
                  className="text-sm font-medium text-foreground/60 hover:text-foreground"
                >
                  로그인
                </Link>
                <Link
                  href="/auth/register"
                  className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  회원가입
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  )
}
