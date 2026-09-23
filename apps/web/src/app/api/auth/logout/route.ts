import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE_NAME, deleteSession } from '@/lib/auth/session'

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value

  if (token) {
    await deleteSession(token)
  }

  const accept = request.headers.get('accept') ?? ''
  const isFormPost = accept.includes('text/html')
  const response = isFormPost
    ? NextResponse.redirect(new URL('/', request.url))
    : NextResponse.json({ success: true })
  response.cookies.delete(SESSION_COOKIE_NAME)

  return response
}
