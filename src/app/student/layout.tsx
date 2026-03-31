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

  const [classMemberResult, reviewsResult, classIdsResult, completedResult, featureLevelResult] = await Promise.all([
    supabase.from('class_members').select('classes(name)').eq('student_id', user.id).limit(1).single(),
    supabase.from('wrong_answer_queue').select('*', { count: 'exact', head: true })
      .eq('student_id', user.id).eq('mastered', false).lte('next_review_at', new Date().toISOString()),
    supabase.from('class_members').select('class_id').eq('student_id', user.id),
    supabase.from('submissions').select('deployment_id').eq('student_id', user.id).in('status', ['submitted', 'graded']),
    supabase.from('class_members').select('feature_level').eq('student_id', user.id),
  ])

  const classIds = (classIdsResult.data ?? []).map(m => m.class_id)
  const submittedDeploymentIds = (completedResult.data ?? []).map(s => s.deployment_id).filter(Boolean)

  let pendingExamsCount = 0
  if (classIds.length > 0) {
    const now = new Date().toISOString()
    let q = supabase.from('exam_deployments').select('*', { count: 'exact', head: true })
      .in('class_id', classIds)
      .lte('start_at', now)
      .neq('status', 'scheduled')
      .neq('status', 'completed')
    if (submittedDeploymentIds.length > 0) {
      q = q.not('id', 'in', `(${submittedDeploymentIds.join(',')})`)
    }
    const { count } = await q
    pendingExamsCount = count ?? 0
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const className = (classMemberResult.data?.classes as any)?.name as string | undefined

  // 여러 반 중 가장 높은 feature_level 사용 (구독한 만큼 최대 혜택)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const featureLevel = (featureLevelResult.data ?? []).reduce((max: number, m: any) => {
    return Math.max(max, m.feature_level ?? 1)
  }, 1)

  return (
    <div className="flex min-h-screen bg-slate-50">
      <StudentSidebar
        studentName={profile.name}
        className={className}
        pendingReviews={reviewsResult.count ?? 0}
        pendingExams={pendingExamsCount}
        featureLevel={featureLevel}
      />
      <main className="flex-1 overflow-auto pt-14 md:pt-0">
        {children}
      </main>
    </div>
  )
}
