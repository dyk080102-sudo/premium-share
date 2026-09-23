import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import prisma from '@/lib/db/prisma'
import { formatDateTime } from '@/lib/utils'

export default async function AdminSettingsPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'SUPER_ADMIN') {
    redirect('/admin')
  }

  const settings = await prisma.appSetting.findMany({
    orderBy: { key: 'asc' },
  })

  const businessMode = process.env.BUSINESS_MODE ?? 'MANUAL'

  return (
    <div className="space-y-8 max-w-3xl">
      <h1 className="text-2xl font-bold">시스템 설정</h1>

      {/* Environment Info */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="font-semibold mb-4">환경 정보</h2>
        <div className="grid gap-3 text-sm">
          <div className="flex justify-between py-2 border-b">
            <span className="text-muted-foreground">비즈니스 모드</span>
            <span className={`font-semibold ${businessMode === 'DEMO' ? 'text-purple-600' : 'text-green-600'}`}>
              {businessMode}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span className="text-muted-foreground">Node 환경</span>
            <span className="font-mono">{process.env.NODE_ENV}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-muted-foreground">데이터베이스</span>
            <span className="text-green-600">연결됨</span>
          </div>
        </div>
      </div>

      {/* App Settings */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="font-semibold mb-4">앱 설정</h2>
        {settings.length === 0 ? (
          <p className="text-sm text-muted-foreground">설정 항목이 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {settings.map((setting) => (
              <div key={setting.id} className="rounded border p-4">
                <div className="flex items-center justify-between mb-2">
                  <code className="text-sm font-mono text-primary">{setting.key}</code>
                  {setting.updatedAt && (
                    <span className="text-xs text-muted-foreground">
                      수정: {formatDateTime(setting.updatedAt)}
                    </span>
                  )}
                </div>
                {setting.description && (
                  <p className="text-xs text-muted-foreground mb-2">{setting.description}</p>
                )}
                <form action={`/api/admin/settings`} method="POST" className="flex gap-2">
                  <input type="hidden" name="key" value={setting.key} />
                  <input
                    type="text"
                    name="value"
                    defaultValue={setting.value}
                    className="flex-1 rounded border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button
                    type="submit"
                    className="rounded border px-3 py-1.5 text-sm hover:bg-muted"
                  >
                    저장
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FAQ Management Link */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="font-semibold mb-4">콘텐츠 관리</h2>
        <div className="grid gap-3">
          <a href="/api/admin/faq" className="flex items-center justify-between rounded border p-3 hover:bg-muted text-sm">
            <span>FAQ 관리</span>
            <span className="text-muted-foreground">→</span>
          </a>
        </div>
      </div>
    </div>
  )
}
