import { redirect } from 'next/navigation'
import { createClient, getUserFromCookie } from '@/lib/supabase/server'
import TeacherSidebar from '@/components/layout/TeacherSidebar'

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const user = await getUserFromCookie()
  if (!user) redirect('/login')

  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role, approved')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'teacher') redirect('/student/dashboard')
  if (!profile?.approved) redirect('/pending')

  return (
    <div className="flex min-h-screen bg-slate-50">
      <TeacherSidebar teacherName={profile.name} />
      <main className="flex-1 overflow-auto pt-14 md:pt-0">
        {children}
      </main>
    </div>
  )
}
