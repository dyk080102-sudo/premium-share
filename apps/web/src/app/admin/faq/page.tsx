import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import prisma from '@/lib/db/prisma'
import { FaqAdminClient } from './FaqAdminClient'

export default async function AdminFaqPage() {
  const user = await getCurrentUser()
  if (!user || !['SUPER_ADMIN', 'OPERATOR'].includes(user.role)) {
    redirect('/admin')
  }

  const faqs = await prisma.faq.findMany({
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">FAQ 관리</h1>
      <FaqAdminClient faqs={faqs} canDelete={user.role === 'SUPER_ADMIN'} />
    </div>
  )
}
