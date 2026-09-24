import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import prisma from '@/lib/db/prisma'
import { AppSettingsEditor } from './AppSettingsEditor'

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
      <div>
        <h1 className="text-2xl font-bold">시스템 설정</h1>
        <p className="text-sm text-muted-foreground mt-1">
          입금 계좌 등 앱 설정은 저장 즉시 주문·결제 화면에 반영됩니다.
        </p>
      </div>

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
        <p className="text-xs text-muted-foreground mt-3">
          비즈니스 모드·Node 환경은 서버 환경 변수이며 이 화면에서 변경할 수 없습니다.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <h2 className="font-semibold mb-4">앱 설정</h2>
        <AppSettingsEditor
          settings={settings.map((s) => ({
            id: s.id,
            key: s.key,
            value: s.value,
            description: s.description,
            updatedAt: s.updatedAt.toISOString(),
          }))}
        />
      </div>

      <div className="rounded-lg border bg-card p-6">
        <h2 className="font-semibold mb-4">콘텐츠 관리</h2>
        <div className="grid gap-3">
          <a href="/admin/faq" className="flex items-center justify-between rounded border p-3 hover:bg-muted text-sm">
            <span>FAQ 관리</span>
            <span className="text-muted-foreground">→</span>
          </a>
        </div>
      </div>
    </div>
  )
}
