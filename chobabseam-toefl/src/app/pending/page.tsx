'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function PendingPage() {
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-yellow-100 rounded-full mb-6">
          <span className="text-4xl">⏳</span>
        </div>
        <h1 className="text-2xl font-extrabold text-gray-900 mb-3">승인 대기 중</h1>
        <p className="text-gray-500 mb-2">
          선생님 계정은 관리자 승인 후 이용하실 수 있어요.
        </p>
        <p className="text-gray-400 text-sm mb-8">
          승인이 완료되면 다시 로그인해주세요.
        </p>
        <button
          onClick={handleLogout}
          className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-6 py-3 rounded-xl transition text-sm"
        >
          로그아웃
        </button>
      </div>
    </div>
  )
}
