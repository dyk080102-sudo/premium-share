import { notFound, redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import Link from 'next/link'
import prisma from '@/lib/db/prisma'
import { formatDateTime, formatPrice } from '@/lib/utils'

const matchStatusLabel: Record<string, string> = {
  UNMATCHED: '미매칭',
  MATCHED: '매칭됨',
  DUPLICATE: '중복',
  REVIEW: '검토 필요',
}

const matchStatusColor: Record<string, string> = {
  UNMATCHED: 'bg-gray-100 text-gray-700',
  MATCHED: 'bg-green-100 text-green-700',
  DUPLICATE: 'bg-red-100 text-red-700',
  REVIEW: 'bg-yellow-100 text-yellow-800',
}

export default async function BankImportDetailPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { match?: string; page?: string }
}) {
  const user = await getCurrentUser()
  if (!user || !['SUPER_ADMIN', 'OPERATOR'].includes(user.role)) {
    redirect('/admin')
  }

  const importRecord = await prisma.bankImport.findUnique({
    where: { id: params.id },
  })
  if (!importRecord) notFound()

  const page = parseInt(searchParams.page ?? '1')
  const matchFilter = searchParams.match
  const limit = 30
  const skip = (page - 1) * limit

  const where = {
    importId: params.id,
    ...(matchFilter ? { matchStatus: matchFilter as 'UNMATCHED' | 'MATCHED' | 'DUPLICATE' | 'REVIEW' } : {}),
  }

  const [transactions, total] = await Promise.all([
    prisma.bankTransaction.findMany({
      where,
      orderBy: { transactedAt: 'desc' },
      skip,
      take: limit,
      include: { matchedPayment: { select: { id: true, amountKrw: true, orderId: true } } },
    }),
    prisma.bankTransaction.count({ where }),
  ])

  const summary = await prisma.bankTransaction.groupBy({
    by: ['matchStatus'],
    where: { importId: params.id },
    _count: true,
  })

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <Link href="/admin/bank-import" className="text-sm text-blue-600 hover:underline">
          ← 입금 내역 목록
        </Link>
        <h1 className="text-2xl font-bold">입금 내역 상세</h1>
        <span
          className={`px-2 py-1 rounded text-sm ${
            importRecord.status === 'CONFIRMED'
              ? 'bg-green-100 text-green-700'
              : importRecord.status === 'CANCELLED'
                ? 'bg-gray-100 text-gray-700'
                : 'bg-yellow-100 text-yellow-800'
          }`}
        >
          {importRecord.status === 'PREVIEW'
            ? '미리보기'
            : importRecord.status === 'CONFIRMED'
              ? '확정됨'
              : '취소됨'}
        </span>
      </div>

      {/* 임포트 정보 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="border rounded p-4">
          <p className="text-sm text-gray-500">파일명</p>
          <p className="font-medium truncate">{importRecord.filename}</p>
        </div>
        <div className="border rounded p-4">
          <p className="text-sm text-gray-500">업로드 일시</p>
          <p className="font-medium text-sm">{formatDateTime(importRecord.uploadedAt)}</p>
        </div>
        <div className="border rounded p-4">
          <p className="text-sm text-gray-500">전체 행</p>
          <p className="font-medium text-2xl">{importRecord.rowCount}</p>
        </div>
        <div className="border rounded p-4">
          <p className="text-sm text-gray-500">오류 행</p>
          <p className={`font-medium text-2xl ${importRecord.errorCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {importRecord.errorCount}
          </p>
        </div>
      </div>

      {/* 매칭 현황 요약 */}
      <div className="border rounded-lg p-4">
        <h2 className="font-semibold mb-3">매칭 현황</h2>
        <div className="flex flex-wrap gap-3">
          {summary.map((s) => (
            <Link
              key={s.matchStatus}
              href={`/admin/bank-import/${params.id}?match=${s.matchStatus}`}
              className={`px-3 py-1.5 rounded text-sm font-medium ${matchStatusColor[s.matchStatus] ?? 'bg-gray-100 text-gray-700'}`}
            >
              {matchStatusLabel[s.matchStatus] ?? s.matchStatus}: {s._count}건
            </Link>
          ))}
          {matchFilter && (
            <Link
              href={`/admin/bank-import/${params.id}`}
              className="px-3 py-1.5 rounded text-sm bg-gray-200 text-gray-700"
            >
              전체 보기
            </Link>
          )}
        </div>
      </div>

      {/* CSV 업로드 안내 */}
      {importRecord.status === 'PREVIEW' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-800 font-medium">미리보기 상태</p>
          <p className="text-sm text-amber-700 mt-1">
            아래 거래를 검토한 후 「확정」 버튼을 클릭하면 주문 매칭이 처리됩니다.
            입금자명 일치만으로 자동 확정되지 않습니다.
          </p>
          <div className="flex gap-3 mt-3">
            <button
              className="px-4 py-2 bg-green-600 text-white text-sm rounded font-medium hover:bg-green-700"
              onClick={() => {
                if (confirm('이 입금 내역을 확정하시겠습니까? 검토 후 개별 주문 매칭이 필요합니다.')) {
                  fetch(`/api/admin/bank-import/${params.id}/confirm`, { method: 'POST' })
                    .then(() => window.location.reload())
                }
              }}
            >
              확정
            </button>
            <button
              className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded font-medium hover:bg-gray-300"
              onClick={() => {
                if (confirm('취소하시겠습니까?')) {
                  fetch(`/api/admin/bank-import/${params.id}/cancel`, { method: 'POST' })
                    .then(() => window.location.reload())
                }
              }}
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 거래 목록 */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">거래 일시</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">입금자명</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">금액</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">메모</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">상태</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">매칭 주문</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {transactions.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  거래 내역이 없습니다.
                </td>
              </tr>
            )}
            {transactions.map((tx) => (
              <tr key={tx.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-600">{formatDateTime(tx.transactedAt)}</td>
                <td className="px-4 py-3 font-medium">{tx.depositorName}</td>
                <td className="px-4 py-3 text-right font-semibold">{formatPrice(tx.amountKrw)}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{tx.memo ?? '-'}</td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${matchStatusColor[tx.matchStatus] ?? 'bg-gray-100'}`}
                  >
                    {matchStatusLabel[tx.matchStatus] ?? tx.matchStatus}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {tx.matchedPayment?.orderId ? (
                    <span className="font-mono text-xs text-blue-600">
                      {tx.matchedPayment.orderId.slice(-8)}
                    </span>
                  ) : (
                    <span className="text-gray-400 text-xs">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/admin/bank-import/${params.id}?page=${p}${matchFilter ? `&match=${matchFilter}` : ''}`}
              className={`px-3 py-1.5 rounded text-sm ${
                p === page ? 'bg-blue-600 text-white' : 'border hover:bg-gray-50'
              }`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
