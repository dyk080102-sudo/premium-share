import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import Link from 'next/link'
import prisma from '@/lib/db/prisma'
import { formatDate, formatPrice } from '@/lib/utils'

const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: '결제 대기',
  CONFIRMED: '확인됨',
  CANCELLED: '취소됨',
  EXPIRED: '만료됨',
}

const ORDER_STATUS_CLASS: Record<string, string> = {
  PENDING_PAYMENT: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
  EXPIRED: 'bg-gray-100 text-gray-800',
}

export default async function OrdersPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/login')

  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    include: { product: true, plan: true, payments: true },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">주문 내역</h1>

      {orders.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">
          <p className="mb-4">주문 내역이 없습니다.</p>
          <Link href="/products" className="inline-flex rounded-md bg-primary px-4 py-2 text-sm text-white">
            상품 보기
          </Link>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium">주문번호</th>
                <th className="text-left px-4 py-3 font-medium">상품</th>
                <th className="text-right px-4 py-3 font-medium">금액</th>
                <th className="text-center px-4 py-3 font-medium">결제 상태</th>
                <th className="text-center px-4 py-3 font-medium">주문 상태</th>
                <th className="text-right px-4 py-3 font-medium">날짜</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const confirmedPayment = order.payments.find((p) => p.status === 'CONFIRMED')
                return (
                  <tr key={order.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link href={`/orders/${order.id}`} className="font-mono text-xs hover:underline text-primary">
                        {order.id.slice(-8).toUpperCase()}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{order.productNameSnapshot}</div>
                      <div className="text-xs text-muted-foreground">{order.planNameSnapshot}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatPrice(order.priceKrwSnapshot)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        confirmedPayment ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {confirmedPayment ? '결제 완료' : '결제 대기'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ORDER_STATUS_CLASS[order.status] ?? 'bg-gray-100 text-gray-800'}`}>
                        {ORDER_STATUS_LABEL[order.status] ?? order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {formatDate(order.createdAt)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
