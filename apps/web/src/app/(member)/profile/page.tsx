import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import prisma from '@/lib/db/prisma'
import { formatDateTime } from '@/lib/utils'

export default async function ProfilePage() {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/login')

  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      _count: {
        select: {
          orders: true,
          subscriptions: true,
          refunds: true,
          tickets: true,
        },
      },
    },
  })

  if (!fullUser) redirect('/auth/login')

  const ROLE_LABEL: Record<string, string> = {
    MEMBER: '일반 회원',
    SUPPORT: '서포트',
    OPERATOR: '운영자',
    SUPER_ADMIN: '최고 관리자',
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">내 프로필</h1>

      {/* Profile Info */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <h2 className="font-semibold">계정 정보</h2>
        <div className="grid gap-4 text-sm">
          <div className="flex justify-between py-2 border-b">
            <span className="text-muted-foreground">이메일</span>
            <span className="font-medium">{fullUser.email}</span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span className="text-muted-foreground">역할</span>
            <span className="font-medium">{ROLE_LABEL[fullUser.role] ?? fullUser.role}</span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span className="text-muted-foreground">상태</span>
            <span className={`font-medium ${fullUser.isActive ? 'text-green-600' : 'text-red-600'}`}>
              {fullUser.isActive ? '활성' : '비활성'}
            </span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-muted-foreground">가입일</span>
            <span>{formatDateTime(fullUser.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: '주문', value: fullUser._count.orders, href: '/orders' },
          { label: '구독', value: fullUser._count.subscriptions, href: '/subscriptions' },
          { label: '환불', value: fullUser._count.refunds, href: '/refunds' },
          { label: '문의', value: fullUser._count.tickets, href: '/tickets' },
        ].map((stat) => (
          <a
            key={stat.label}
            href={stat.href}
            className="rounded-lg border bg-card p-4 text-center hover:shadow-md transition-shadow"
          >
            <div className="text-3xl font-bold text-primary">{stat.value}</div>
            <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
          </a>
        ))}
      </div>

      {/* Password Change */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="font-semibold mb-4">비밀번호 변경</h2>
        <form action="/api/auth/password" method="PATCH" className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">현재 비밀번호</label>
            <input
              type="password"
              name="currentPassword"
              required
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
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">새 비밀번호 확인</label>
            <input
              type="password"
              name="confirmPassword"
              required
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
          >
            비밀번호 변경
          </button>
        </form>
      </div>
    </div>
  )
}
