import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import prisma from '@/lib/db/prisma'
import { formatDateTime } from '@/lib/utils'

export default async function NotificationsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/login')

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  const unreadCount = notifications.filter((n) => !n.isRead).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">알림</h1>
        {unreadCount > 0 && (
          <form action="/api/notifications/read-all" method="POST">
            <button
              type="submit"
              className="text-sm text-primary hover:underline"
            >
              모두 읽음으로 표시
            </button>
          </form>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">
          알림이 없습니다.
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className={`rounded-lg border p-4 ${!notif.isRead ? 'bg-blue-50 border-blue-200' : 'bg-card'}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    {!notif.isRead && (
                      <span className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />
                    )}
                    <span className="font-medium text-sm">{notif.title}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{notif.message}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(notif.createdAt)}</p>
                </div>
                {!notif.isRead && (
                  <form action={`/api/notifications/${notif.id}/read`} method="POST">
                    <button type="submit" className="text-xs text-primary hover:underline flex-shrink-0">
                      읽음
                    </button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
