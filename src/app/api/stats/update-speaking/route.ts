import { NextRequest, NextResponse } from 'next/server'
import { getUserFromCookie } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// 선생님이 스피킹 채점 후 학생의 speaking 영역 실력 통계 업데이트
export async function POST(req: NextRequest) {
  const user = await getUserFromCookie()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { studentId, percentage } = await req.json()
  if (!studentId || percentage === undefined) return NextResponse.json({ error: 'invalid params' }, { status: 400 })

  // 서비스 롤 키로 RLS 우회
  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: existing } = await adminClient
    .from('student_skill_stats')
    .select('total_count, accuracy')
    .eq('student_id', studentId)
    .eq('category', 'speaking')
    .single()

  const oldTotal = existing?.total_count ?? 0
  const oldAccuracy = existing?.accuracy ?? 0

  // 누적 평균 정확도: (기존평균 * 기존횟수 + 새점수) / (기존횟수 + 1)
  const newTotal = oldTotal + 1
  const newAccuracy = Math.round((oldAccuracy * oldTotal + percentage) / newTotal)

  await adminClient.from('student_skill_stats').upsert({
    student_id: studentId,
    category: 'speaking',
    total_count: newTotal,
    correct_count: Math.round(newTotal * newAccuracy / 100), // 역산
    accuracy: newAccuracy,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'student_id,category' })

  // 학생 XP 지급 (student_gamification upsert, adminClient로 RLS 우회)
  const xpGain = percentage >= 60 ? 10 : 3
  const { data: gamif } = await adminClient
    .from('student_gamification')
    .select('xp')
    .eq('student_id', studentId)
    .single()
  const newXp = (gamif?.xp ?? 0) + xpGain
  await adminClient.from('student_gamification').upsert({
    student_id: studentId,
    xp: newXp,
    level: Math.max(1, Math.floor(newXp / 100) + 1),
    total_questions_solved: 1,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'student_id' })

  return NextResponse.json({ ok: true })
}
