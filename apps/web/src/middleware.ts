import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE_NAME } from '@/lib/auth/session'

const ADMIN_PATHS = ['/admin', '/api/admin']
const MEMBER_PATHS = ['/dashboard', '/orders', '/subscriptions', '/refunds', '/notifications', '/tickets', '/profile']
const MEMBER_API_PATHS = ['/api/orders', '/api/subscriptions', '/api/refunds', '/api/notifications']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value

  // API routes: check auth via session validation done in route handlers
  // For page routes, redirect unauthenticated users
  const isMemberPath = MEMBER_PATHS.some(p => pathname.startsWith(`/(member)${p}`) || pathname.startsWith(p))
  const isAdminPath = ADMIN_PATHS.some(p => pathname.startsWith(p))

  if ((isMemberPath || isAdminPath) && !token) {
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/orders/:path*',
    '/subscriptions/:path*',
    '/refunds/:path*',
    '/notifications/:path*',
    '/tickets/:path*',
    '/profile/:path*',
    '/admin/:path*',
    '/api/orders/:path*',
    '/api/subscriptions/:path*',
    '/api/refunds/:path*',
    '/api/notifications/:path*',
    '/api/admin/:path*',
  ],
}
