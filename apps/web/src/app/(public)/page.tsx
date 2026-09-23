import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth/session'
import { Header } from '@/components/layout/header'

export default async function HomePage() {
  const user = await getCurrentUser()
  const isDemoMode = process.env.BUSINESS_MODE === 'DEMO'

  return (
    <div className="min-h-screen">
      <Header user={user} isDemoMode={isDemoMode} />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-50 to-white py-24">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            프리미엄 구독,
            <span className="text-primary"> 함께 절약하세요</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            PremiumShare는 검증된 공유 슬롯을 통해 프리미엄 서비스를 저렴하게 이용할 수 있는 안전한 플랫폼입니다.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/products"
              className="inline-flex h-12 items-center rounded-lg bg-primary px-8 text-base font-semibold text-white hover:bg-primary/90"
            >
              상품 보기
            </Link>
            {!user && (
              <Link
                href="/auth/register"
                className="inline-flex h-12 items-center rounded-lg border border-gray-300 px-8 text-base font-semibold text-gray-700 hover:bg-gray-50"
              >
                무료 가입
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">왜 PremiumShare인가요?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: '🔒',
                title: '안전한 관리',
                desc: '운영자가 직접 슬롯을 관리하며 초대 과정을 검증합니다.',
              },
              {
                icon: '💰',
                title: '최대 75% 절약',
                desc: '혼자 구독하는 것보다 훨씬 저렴하게 이용하세요.',
              },
              {
                icon: '📱',
                title: '투명한 프로세스',
                desc: '주문부터 슬롯 배정, 초대까지 실시간으로 상태를 확인하세요.',
              },
            ].map((f) => (
              <div key={f.title} className="text-center p-6 rounded-lg border bg-card">
                <div className="text-4xl mb-4">{f.icon}</div>
                <h3 className="text-xl font-semibold mb-2">{f.title}</h3>
                <p className="text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Process Steps */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">이용 절차</h2>
          <div className="flex flex-col md:flex-row items-start justify-center gap-4">
            {[
              { step: '1', label: '상품 선택', desc: '원하는 서비스와 플랜 선택' },
              { step: '2', label: '주문 & 결제', desc: '안전한 결제 진행' },
              { step: '3', label: '슬롯 배정', desc: '이용 가능한 슬롯 자동 배정' },
              { step: '4', label: '초대 발송', desc: '운영자가 초대장 발송' },
              { step: '5', label: '이용 시작', desc: '서비스 바로 이용' },
            ].map((s, i) => (
              <div key={s.step} className="flex items-start gap-2 flex-1">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {s.step}
                  </div>
                  {i < 4 && <div className="w-px h-8 bg-gray-300 md:hidden mt-1" />}
                </div>
                <div className="ml-2">
                  <div className="font-semibold">{s.label}</div>
                  <div className="text-sm text-muted-foreground">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 bg-white">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <div className="flex justify-center gap-6 mb-4">
            <Link href="/terms" className="hover:text-foreground">이용약관</Link>
            <Link href="/privacy" className="hover:text-foreground">개인정보처리방침</Link>
            <Link href="/faq" className="hover:text-foreground">FAQ</Link>
          </div>
          <p>© 2024 PremiumShare. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
