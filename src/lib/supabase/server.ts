import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { cache } from 'react'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component에서 쿠키 설정 불가 시 무시
          }
        },
      },
      auth: {
        autoRefreshToken: false,
      },
    }
  )
}

// 미들웨어가 토큰 갱신을 담당하므로 서버 컴포넌트는 getSession()으로 읽기만 함
// (네트워크 호출 없음 → rate limit 없음 → refresh_token_already_used 없음)
export const getUserFromCookie = cache(async () => {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session?.user ?? null
})
