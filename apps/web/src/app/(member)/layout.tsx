import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import { Header } from '@/components/layout/header'

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/login')

  const isDemoMode = process.env.BUSINESS_MODE === 'DEMO'

  return (
    <div className="min-h-screen">
      <Header user={user} isDemoMode={isDemoMode} />
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  )
}
