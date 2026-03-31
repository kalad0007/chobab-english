import { createClient, getUserFromCookie } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ClassDetailClient from './ClassDetailClient'

export default async function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const user = await getUserFromCookie()
  if (!user) return null

  const { data: cls } = await supabase
    .from('classes')
    .select('id, name, invite_code')
    .eq('id', id)
    .eq('teacher_id', user.id)
    .single()

  if (!cls) notFound()

  const { data: members } = await supabase
    .from('class_members')
    .select('student_id, joined_at, feature_level, profiles(id, name, email)')
    .eq('class_id', cls.id)

  const studentIds = (members ?? []).map(m => m.student_id)

  const { data: allSubmissions } = studentIds.length > 0
    ? await supabase
        .from('submissions')
        .select('student_id, percentage, submitted_at')
        .in('student_id', studentIds)
        .in('status', ['submitted', 'graded'])
    : { data: [] }

  const subMap: Record<string, { count: number; latestScore: number | null; latestDate: string | null }> = {}
  for (const s of allSubmissions ?? []) {
    if (!subMap[s.student_id]) subMap[s.student_id] = { count: 0, latestScore: null, latestDate: null }
    subMap[s.student_id].count++
    if (!subMap[s.student_id].latestDate || s.submitted_at > subMap[s.student_id].latestDate!) {
      subMap[s.student_id].latestDate = s.submitted_at
      subMap[s.student_id].latestScore = s.percentage ?? null
    }
  }

  const { data: otherClasses } = await supabase
    .from('classes')
    .select('id, name')
    .eq('teacher_id', user.id)
    .neq('id', cls.id)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const students = (members ?? []).map(m => {
    const profile = m.profiles as any // eslint-disable-line @typescript-eslint/no-explicit-any
    const stats = subMap[m.student_id] ?? { count: 0, latestScore: null, latestDate: null }
    return {
      id: m.student_id,
      name: profile?.name ?? '알 수 없음',
      email: profile?.email ?? '',
      joinedAt: m.joined_at,
      featureLevel: (m as any).feature_level ?? 1, // eslint-disable-line @typescript-eslint/no-explicit-any
      submissionCount: stats.count,
      latestScore: stats.latestScore,
      latestDate: stats.latestDate,
    }
  })

  return (
    <ClassDetailClient
      cls={cls}
      students={students}
      otherClasses={otherClasses ?? []}
    />
  )
}
