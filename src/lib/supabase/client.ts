import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

// 싱글톤: 브라우저에서 인스턴스 하나만 유지 → 토큰 refresh 경쟁 방지
let instance: SupabaseClient | null = null

export function createClient() {
  if (instance) return instance
  instance = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  return instance
}
