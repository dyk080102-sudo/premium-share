import prisma from '@/lib/db/prisma'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth/session'
import { Header } from '@/components/layout/header'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function FaqPage() {
  const user = await getCurrentUser().catch(() => null)
  const isDemoMode = process.env.BUSINESS_MODE === 'DEMO'

  let faqs: Awaited<ReturnType<typeof prisma.faq.findMany>> = []
  let loadError: string | null = null
  try {
    faqs = await prisma.faq.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    })
  } catch (error) {
    console.error('FaqPage DB error:', error)
    loadError = 'FAQ를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
  }

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

        {loadError && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {loadError}
          </div>
        )}

        {!loadError && Object.keys(grouped).length === 0 ? (
          <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">
            등록된 FAQ가 없습니다.
          </div>
        ) : (
          <div className="space-y-10">
            {Object.entries(grouped).map(([category, items]) => (
              <section key={category}>
                <h2 className="text-lg font-semibold mb-4 border-b pb-2">{category}</h2>
                <div className="space-y-3">
                  {items.map((faq) => (
                    <details key={faq.id} className="rounded-lg border bg-card p-4 group">
                      <summary className="cursor-pointer font-medium list-none flex justify-between items-center">
                        {faq.question}
                        <span className="text-muted-foreground group-open:rotate-180 transition-transform">▾</span>
                      </summary>
                      <p className="mt-3 text-sm text-muted-foreground whitespace-pre-wrap">{faq.answer}</p>
                    </details>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
