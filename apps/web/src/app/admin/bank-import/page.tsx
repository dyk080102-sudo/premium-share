import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import prisma from '@/lib/db/prisma'
import { formatDateTime } from '@/lib/utils'

export default async function AdminBankImportPage() {
  const user = await getCurrentUser()
  if (!user || !['SUPER_ADMIN', 'OPERATOR'].includes(user.role)) {
    redirect('/admin')
  }

  const [imports, unmatched] = await Promise.all([
    prisma.bankImport.findMany({
      orderBy: { uploadedAt: 'desc' },
      take: 20,
    }),
    prisma.bankTransaction.findMany({
      where: { matchStatus: 'UNMATCHED' },
      orderBy: { transactedAt: 'desc' },
      take: 50,
    }),
  ])

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">입금 내역 관리</h1>

      {/* CSV Upload */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="font-semibold mb-4">CSV 업로드</h2>
        <form action="/api/admin/bank-import" method="POST" encType="multipart/form-data" className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">은행 CSV 파일</label>
            <input
              type="file"
              name="file"
              accept=".csv"
              required
              className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-primary file:text-white file:text-sm file:font-medium hover:file:bg-primary/90"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
          >
            업로드
          </button>
        </form>
      </div>

      {/* Import History */}
      {imports.length > 0 && (
        <div className="rounded-lg border bg-card p-6">
          <h2 className="font-semibold mb-4">업로드 내역</h2>
          <div className="space-y-2">
            {imports.map((imp) => (
              <div key={imp.id} className="flex items-center justify-between text-sm border rounded p-3">
                <div>
                  <div className="font-medium">{imp.filename}</div>
                  <div className="text-xs text-muted-foreground">{formatDateTime(imp.uploadedAt)}</div>
                </div>
                <div className="flex gap-4 text-xs">
                  <span>{imp.rowCount}행</span>
                  {imp.errorCount > 0 && <span className="text-red-500">오류: {imp.errorCount}</span>}
                  <span className={`font-medium ${
                    imp.status === 'CONFIRMED' ? 'text-green-600' :
                    imp.status === 'CANCELLED' ? 'text-red-600' : 'text-yellow-600'
                  }`}>
                    {imp.status === 'PREVIEW' ? '미확정' : imp.status === 'CONFIRMED' ? '확정됨' : '취소됨'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unmatched Transactions */}
      {unmatched.length > 0 && (
        <div className="rounded-lg border bg-card p-6">
          <h2 className="font-semibold mb-4">미매칭 입금 ({unmatched.length}건)</h2>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">거래일</th>
                  <th className="text-left px-4 py-2 font-medium">입금자명</th>
                  <th className="text-left px-4 py-2 font-medium">메모</th>
                  <th className="text-right px-4 py-2 font-medium">금액</th>
                  <th className="text-center px-4 py-2 font-medium">상태</th>
                </tr>
              </thead>
              <tbody>
                {unmatched.map((tx) => (
                  <tr key={tx.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-2 text-xs">{formatDateTime(tx.transactedAt)}</td>
                    <td className="px-4 py-2">{tx.depositorName}</td>
                    <td className="px-4 py-2 text-muted-foreground">{tx.memo ?? '-'}</td>
                    <td className="px-4 py-2 text-right font-medium">{tx.amountKrw.toLocaleString()}원</td>
                    <td className="px-4 py-2 text-center">
                      <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800">
                        미매칭
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
