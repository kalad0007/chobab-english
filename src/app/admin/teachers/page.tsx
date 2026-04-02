import { createClient } from '@/lib/supabase/server'
import TeachersClient from './TeachersClient'

export default async function AdminTeachersPage() {
  const supabase = await createClient()

  const { data: teachers } = await supabase
    .from('profiles')
    .select('id, name, email, plan, plan_expires_at, ai_question_count, ai_vocab_count, approved, created_at, role')
    .eq('role', 'teacher')
    .order('created_at', { ascending: false })

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

  return <TeachersClient teachers={enriched} />
}
