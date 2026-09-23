import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth/session'
import { Header } from '@/components/layout/header'
import prisma from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

export default async function PrivacyPage() {
  const user = await getCurrentUser()
  const isDemoMode = process.env.BUSINESS_MODE === 'DEMO'
  const policy = await prisma.policyVersion.findFirst({
    where: { type: 'PRIVACY' },
    orderBy: { effectiveAt: 'desc' },
  })

  return (
    <div className="min-h-screen">
      <Header user={user} isDemoMode={isDemoMode} />
      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <Link href="/" className="text-sm text-muted-foreground hover:underline">← 홈</Link>
        <h1 className="text-3xl font-bold mt-4 mb-6">개인정보처리방침</h1>
        <div className="rounded-lg border bg-card p-6 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
          {policy?.content ?? '개인정보처리방침이 아직 등록되지 않았습니다.'}
        </div>
      </main>
    </div>
  )
}
