import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import CsvAllocatorClient from './CsvAllocatorClient'

export default async function CsvAllocatorPage() {
  const user = await getCurrentUser()
  if (!user || !['SUPER_ADMIN', 'OPERATOR'].includes(user.role)) {
    redirect('/admin')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">CSV 계정 배치</h1>
        <p className="text-sm text-muted-foreground mt-1">
          CSV를 업로드하면 가족 그룹 빈자리·환불·12개월 재가입 정책에 따라 계정을 자동 배치합니다.
          처리 결과 CSV를 다운로드해 가족 러너/운영에 사용할 수 있습니다.
        </p>
        <p className="text-xs text-muted-foreground mt-1 font-mono">
          헤더: account_id,email,status,family_group_id,role,joined_at,updated_at
        </p>
      </div>
      <CsvAllocatorClient />
    </div>
  )
}
