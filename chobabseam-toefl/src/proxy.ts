import { NextResponse, type NextRequest } from 'next/server'

// 쿠키 존재 여부만 확인 — Supabase API 호출 없음
// 서버 컴포넌트에서 getSession()으로 세션을 읽음
function hasSession(request: NextRequest): boolean {
  const projectRef = 'wapwtzdrxhrwriqyvfyh'
  return request.cookies.getAll().some(c => c.name.startsWith(`sb-${projectRef}-auth-token`))
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (!hasSession(request) && (pathname.startsWith('/teacher') || pathname.startsWith('/student'))) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next({ request })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
