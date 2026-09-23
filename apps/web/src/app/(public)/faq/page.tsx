import prisma from '@/lib/db/prisma'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth/session'
import { Header } from '@/components/layout/header'

export const dynamic = 'force-dynamic'

export default async function FaqPage() {
  const user = await getCurrentUser()
  const isDemoMode = process.env.BUSINESS_MODE === 'DEMO'
  const faqs = await prisma.faq.findMany({
    where: { isActive: true },
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
  })

  // Group by category
  const grouped = faqs.reduce<Record<string, typeof faqs>>((acc, faq) => {
    if (!acc[faq.category]) acc[faq.category] = []
    acc[faq.category].push(faq)
    return acc
  }, {})

  return (
    <div className="min-h-screen">
      <Header user={user} isDemoMode={isDemoMode} />
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <div className="mb-8">
        <Link href="/" className="text-sm text-muted-foreground hover:underline">← 홈</Link>
        <h1 className="text-3xl font-bold mt-4">자주 묻는 질문</h1>
        <p className="text-muted-foreground mt-2">PremiumShare 이용에 관한 자주 묻는 질문을 확인하세요.</p>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">
          등록된 FAQ가 없습니다.
        </div>
      ) : (
        <div className="space-y-10">
          {Object.entries(grouped).map(([category, items]) => (
            <section key={category}>
              <h2 className="text-xl font-bold mb-4 pb-2 border-b">{category}</h2>
              <div className="space-y-4">
                {items.map((faq) => (
                  <details key={faq.id} className="group rounded-lg border bg-card">
                    <summary className="flex cursor-pointer items-center justify-between p-4 font-medium list-none">
                      <span>{faq.question}</span>
                      <span className="ml-4 flex-shrink-0 text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <div className="px-4 pb-4 text-sm text-muted-foreground whitespace-pre-wrap">
                      {faq.answer}
                    </div>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="mt-12 rounded-lg border bg-card p-6 text-center">
        <p className="text-muted-foreground mb-4">원하는 답변을 찾지 못하셨나요?</p>
        <Link
          href="/tickets/new"
          className="inline-flex rounded-md bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
        >
          1:1 문의하기
        </Link>
      </div>
    </div>
    </div>
  )
}
