import { redirect } from 'next/navigation'
import { createClient, getUserFromCookie } from '@/lib/supabase/server'
import StudentSidebar from '@/components/layout/StudentSidebar'

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await getUserFromCookie()
  if (!user) redirect('/login')

  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'student') redirect('/teacher/dashboard')

  const [classMemberResult, reviewsResult, classIdsResult, completedResult] = await Promise.all([
    supabase.from('class_members').select('classes(name)').eq('student_id', user.id).limit(1).single(),
    supabase.from('wrong_answer_queue').select('*', { count: 'exact', head: true })
      .eq('student_id', user.id).eq('mastered', false).lte('next_review_at', new Date().toISOString()),
    supabase.from('class_members').select('class_id').eq('student_id', user.id),
    supabase.from('submissions').select('exam_id').eq('student_id', user.id).in('status', ['submitted', 'graded']),
  ])

  const classIds = (classIdsResult.data ?? []).map(m => m.class_id)
  const submittedIds = (completedResult.data ?? []).map(s => s.exam_id)

  let pendingExamsCount = 0
  if (classIds.length > 0) {
    let q = supabase.from('exams').select('*', { count: 'exact', head: true })
      .in('class_id', classIds).eq('status', 'published')
    if (submittedIds.length > 0) {
      q = q.not('id', 'in', `(${submittedIds.join(',')})`)
    }
    const { count } = await q
    pendingExamsCount = count ?? 0
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const className = (classMemberResult.data?.classes as any)?.name as string | undefined

  return (
    <div className="flex min-h-screen bg-slate-50">
      <StudentSidebar
        studentName={profile.name}
        className={className}
        pendingReviews={reviewsResult.count ?? 0}
        pendingExams={pendingExamsCount}
      />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
