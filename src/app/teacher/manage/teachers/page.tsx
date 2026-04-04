import { createClient } from '@/lib/supabase/server'
import { getUserFromCookie } from '@/lib/supabase/server'
import TeachersClient from './TeachersClient'

export default async function ManageTeachersPage() {
  const supabase = await createClient()

  // 현재 사용자의 role 및 크레딧 파악
  const user = await getUserFromCookie()
  let callerRole: string | null = null
  let callerCredits: number = 0
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, credits')
      .eq('id', user.id)
      .single()
    callerRole = profile?.role ?? null
    callerCredits = profile?.credits ?? 0
  }

  // superadmin: 전체 조회 / admin: 자기 소속(managed_by = 본인 id)만 조회
  let query = supabase
    .from('profiles')
    .select('id, name, email, plan, plan_expires_at, credits, approved, created_at, role')
    .eq('role', 'teacher')
    .order('created_at', { ascending: false })

  if (callerRole === 'admin' && user) {
    query = query.eq('managed_by', user.id)
  }

  const { data: teachers } = await query

  // 선생님별 학생 수 집계 (classes -> class_members)
  const teacherIds = (teachers ?? []).map((t) => t.id)
  const studentCounts: Record<string, number> = {}
  if (teacherIds.length > 0) {
    const { data: classRows } = await supabase
      .from('classes')
      .select('id, teacher_id')
      .in('teacher_id', teacherIds)
    const classIds = (classRows ?? []).map((c) => c.id)
    const classTeacherMap: Record<string, string> = {}
    for (const c of classRows ?? []) {
      classTeacherMap[c.id] = c.teacher_id
    }
    if (classIds.length > 0) {
      const { data: memberRows } = await supabase
        .from('class_members')
        .select('class_id')
        .in('class_id', classIds)
      for (const row of memberRows ?? []) {
        const teacherId = classTeacherMap[row.class_id]
        if (teacherId) {
          studentCounts[teacherId] = (studentCounts[teacherId] ?? 0) + 1
        }
      }
    }
  }

  const enriched = (teachers ?? []).map((t) => ({
    ...t,
    student_count: studentCounts[t.id] ?? 0,
  }))

  return (
    <TeachersClient
      teachers={enriched}
      callerRole={callerRole ?? 'admin'}
      callerCredits={callerCredits}
    />
  )
}
