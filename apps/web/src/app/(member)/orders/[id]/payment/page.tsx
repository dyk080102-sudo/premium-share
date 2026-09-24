import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import prisma from '@/lib/db/prisma'
import { getBankAccountSettings } from '@/lib/security'
import { BankTransferForm } from '@/components/bank-transfer-form'

export default async function OrderPaymentPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/login')

  if (process.env.BUSINESS_MODE === 'DEMO') {
    redirect(`/orders/${params.id}`)
  }

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      payments: {
        where: { status: { not: 'CANCELLED' } },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!order || order.userId !== user.id) notFound()
  if (order.status !== 'PENDING_PAYMENT') {
    redirect(`/orders/${order.id}`)
  }

  const existing = order.payments[0]
  if (existing) {
    redirect(`/orders/${order.id}`)
  }

  const bank = await getBankAccountSettings()

  return (
    <BankTransferForm
      orderId={order.id}
      amountKrw={order.priceKrwSnapshot}
      bank={bank}
    />
  )
}
