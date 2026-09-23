import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import Link from 'next/link'

const NAV_ITEMS: ({ href: string; label: string; icon: string } | { divider: true; label: string })[] = [
  { href: '/admin', label: '대시보드', icon: '📊' },
  { href: '/admin/payments', label: '결제 관리', icon: '💳' },
  { href: '/admin/allocations', label: '슬롯 배정', icon: '🔑' },
  { href: '/admin/invitations', label: '초대 관리', icon: '📧' },
  { href: '/admin/orders', label: '주문 관리', icon: '📋' },
  { href: '/admin/subscriptions', label: '구독 관리', icon: '🔄' },
  { href: '/admin/refunds', label: '환불 관리', icon: '💰' },
  { href: '/admin/members', label: '회원 관리', icon: '👥' },
  { href: '/admin/products', label: '상품 관리', icon: '📦' },
  { href: '/admin/groups', label: '그룹 관리', icon: '🏠' },
  { divider: true, label: '── 가족 관리 ──' },
  { href: '/admin/family', label: '가족 자동화', icon: '👨‍👩‍👧‍👦' },
  { href: '/admin/csv-allocator', label: 'CSV 계정 배치', icon: '📂' },
  { divider: true, label: '── 운영 ──' },
  { href: '/admin/tickets', label: '문의 관리', icon: '🎫' },
  { href: '/admin/faq', label: 'FAQ 관리', icon: '❓' },
  { href: '/admin/audit-logs', label: '감사 로그', icon: '📝' },
  { href: '/admin/jobs', label: '잡 실행', icon: '⚙️' },
  { href: '/admin/settings', label: '설정', icon: '🔧' },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/login')
  if (!['SUPER_ADMIN', 'OPERATOR', 'SUPPORT'].includes(user.role)) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <Link href="/" className="text-lg font-bold text-white">PremiumShare</Link>
          <div className="text-xs text-gray-400 mt-1">관리자 콘솔</div>
        </div>
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-2">
            {NAV_ITEMS.map((item, idx) => {
              if ('divider' in item) {
                return (
                  <li key={`divider-${idx}`} className="pt-3 pb-1 px-3">
                    <span className="text-xs text-gray-500 font-medium">{item.label}</span>
                  </li>
                )
              }
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
        <div className="p-4 border-t border-gray-700 text-xs text-gray-400">
          <div>{user.email}</div>
          <div>{user.role}</div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {process.env.BUSINESS_MODE === 'DEMO' && (
                <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
                  🧪 DEMO 모드
                </span>
              )}
            </div>
            <form action="/api/auth/logout" method="POST">
              <button type="submit" className="text-sm text-muted-foreground hover:text-foreground">
                로그아웃
              </button>
            </form>
          </div>
        </header>
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
