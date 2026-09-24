import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE_NAME } from '@/lib/auth/session'

const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'OPERATOR', 'SUPPORT'])

const MEMBER_PATH_PREFIXES = [
  '/dashboard',
  '/orders',
  '/subscriptions',
  '/refunds',
  '/notifications',
  '/tickets',
  '/profile',
  '/waitlist',
]

const MEMBER_API_PREFIXES = [
  '/api/orders',
  '/api/subscriptions',
  '/api/refunds',
  '/api/notifications',
  '/api/tickets',
  '/api/waitlist',
]

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function isProtectedMemberPath(pathname: string) {
  return MEMBER_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

function isProtectedMemberApi(pathname: string) {
  return MEMBER_API_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

function isAdminPath(pathname: string) {
  return pathname === '/admin' || pathname.startsWith('/admin/') || pathname.startsWith('/api/admin')
}

/**
 * Edge-safe CSRF: reject cross-origin mutating requests when Origin is present.
 * Full session/role validation still happens in Node route handlers & layouts (Prisma).
 */
function assertSameOriginEdge(request: NextRequest): NextResponse | null {
  if (!MUTATING.has(request.method)) return null
  const origin = request.headers.get('origin')
  if (!origin) return null

  const host = request.headers.get('host')
  if (!host) return null

  try {
    const requestOrigin = new URL(origin).host
    if (requestOrigin !== host) {
      return NextResponse.json(
        { success: false, error: '잘못된 요청 출처입니다.', code: 'CSRF' },
        { status: 403 },
      )
    }
  } catch {
    return NextResponse.json(
      { success: false, error: '잘못된 요청 출처입니다.', code: 'CSRF' },
      { status: 403 },
    )
  }
  return null
}

export async function middleware(request: NextRequest) {
  const csrfBlock = assertSameOriginEdge(request)
  if (csrfBlock) return csrfBlock

  const { pathname } = request.nextUrl
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value

  const needsAuth =
    isProtectedMemberPath(pathname) ||
    isProtectedMemberApi(pathname) ||
    isAdminPath(pathname)

  if (needsAuth && !token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.', code: 'UNAUTHORIZED' },
        { status: 401 },
      )
    }
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Role-aware soft hint via cookie is not available on Edge without JWT.
  // Admin layout + requireRole() enforce RBAC; attach request id for tracing.
  const response = NextResponse.next()
  response.headers.set('x-request-path', pathname)
  if (isAdminPath(pathname)) {
    response.headers.set('x-admin-guard', 'layout+api')
  }
  // Silence unused (kept for documentation of intended RBAC roles)
  void ADMIN_ROLES
  return response
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
    '/waitlist/:path*',
    '/admin/:path*',
    '/api/orders/:path*',
    '/api/subscriptions/:path*',
    '/api/refunds/:path*',
    '/api/notifications/:path*',
    '/api/tickets/:path*',
    '/api/waitlist/:path*',
    '/api/admin/:path*',
    '/api/auth/password',
    '/api/auth/logout',
    '/api/demo/:path*',
  ],
}
