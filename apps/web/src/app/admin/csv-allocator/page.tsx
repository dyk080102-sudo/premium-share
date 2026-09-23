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
          CSV 파일을 업로드하여 Google Family 그룹에 계정을 자동 배정합니다.
        </p>
      </div>
      <CsvAllocatorClient />
    </div>
  )
}
