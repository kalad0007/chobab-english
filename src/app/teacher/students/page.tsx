import { createClient, getUserFromCookie } from '@/lib/supabase/server'
import { Users } from 'lucide-react'
import StudentsClient from './StudentsClient'

export default async function StudentsPage() {
  const supabase = await createClient()
  const user = await getUserFromCookie()
  if (!user) return null

  // 1. Get teacher's classes
  const { data: classes } = await supabase
    .from('classes')
    .select('id, name')
    .eq('teacher_id', user.id)
    .order('created_at', { ascending: true })

  const classIds = classes?.map(c => c.id) ?? []

  // 2. Get all students in those classes (with their profiles and class name)
  const { data: members } = classIds.length > 0
    ? await supabase
        .from('class_members')
        .select('student_id, class_id, classes(name), profiles:student_id(name, email)')
        .in('class_id', classIds)
    : { data: [] }

  // 3. Get submission stats per student
  const studentIds = members?.map(m => m.student_id) ?? []
  const { data: submissions } = studentIds.length > 0
    ? await supabase
        .from('submissions')
        .select('student_id, status, score, total_points')
        .in('student_id', studentIds)
        .in('status', ['submitted', 'graded'])
    : { data: [] }

  // Build per-student submission stats
  const submissionMap: Record<string, { count: number; avgScore: number | null }> = {}
  for (const sub of submissions ?? []) {
    if (!submissionMap[sub.student_id]) {
      submissionMap[sub.student_id] = { count: 0, avgScore: null }
    }
    submissionMap[sub.student_id].count += 1
  }

  // Average score only from graded submissions
  const gradedByStu: Record<string, number[]> = {}
  for (const sub of submissions ?? []) {
    if (sub.status === 'graded' && sub.total_points && sub.total_points > 0) {
      if (!gradedByStu[sub.student_id]) gradedByStu[sub.student_id] = []
      gradedByStu[sub.student_id].push(Math.round(((sub.score ?? 0) / sub.total_points) * 100))
    }
  }
  for (const [studentId, scores] of Object.entries(gradedByStu)) {
    if (scores.length > 0) {
      submissionMap[studentId] = {
        ...submissionMap[studentId],
        avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      }
    }
  }

  const totalStudents = members?.length ?? 0

  return (
    <div className="p-4 md:p-7">
      {/* Header */}
      <div className="flex items-start justify-between mb-7">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">👥 학생 관리</h1>
          <p className="text-gray-500 text-sm mt-1">등록된 학생 목록</p>
        </div>
        {totalStudents > 0 && (
          <div className="flex items-center gap-2 bg-white border border-gray-100 rounded-2xl px-4 py-2.5 shadow-sm">
            <Users size={16} className="text-blue-500" />
            <span className="text-sm font-bold text-gray-800">총 {totalStudents}명의 학생</span>
          </div>
        )}
      </div>

      <StudentsClient
        members={members ?? []}
        classes={classes ?? []}
        submissionMap={submissionMap}
      />
    </div>
  )
}
