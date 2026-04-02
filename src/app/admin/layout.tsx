import { redirect } from 'next/navigation'
import { getUserFromCookie, createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getUserFromCookie()
  if (!user) redirect('/login')

  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, name')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/teacher/dashboard')

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="w-52 bg-white border-r border-gray-100 flex flex-col shadow-sm">
        <div className="px-5 py-5 border-b border-gray-100">
          <p className="font-extrabold text-gray-900">초밥샘 TOEFL</p>
          <p className="text-xs text-red-500 font-bold mt-0.5">관리자 패널</p>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-1">
          <Link
            href="/admin"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            대시보드
          </Link>
          <Link
            href="/admin/teachers"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            선생님 관리
          </Link>
        </nav>
        <div className="p-3 border-t border-gray-100">
          <p className="text-xs text-gray-400 px-2">{profile.name}</p>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
