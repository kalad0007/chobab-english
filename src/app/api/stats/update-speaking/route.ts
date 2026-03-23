import { NextRequest, NextResponse } from 'next/server'
import { createClient, getUserFromCookie } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// 선생님이 스피킹 채점 후 학생의 speaking 영역 실력 통계 업데이트
export async function POST(req: NextRequest) {
  const user = await getUserFromCookie()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { studentId, isCorrect } = await req.json()
  if (!studentId) return NextResponse.json({ error: 'studentId required' }, { status: 400 })

  // 서비스 롤 키로 RLS 우회 (학생 데이터 업데이트)
  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: existing } = await adminClient
    .from('student_skill_stats')
    .select('total_count, correct_count')
    .eq('student_id', studentId)
    .eq('category', 'speaking')
    .single()

  const total = (existing?.total_count ?? 0) + 1
  const correct = (existing?.correct_count ?? 0) + (isCorrect ? 1 : 0)

  await adminClient.from('student_skill_stats').upsert({
    student_id: studentId,
    category: 'speaking',
    total_count: total,
    correct_count: correct,
    accuracy: Math.round((correct / total) * 100),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'student_id,category' })

  // 학생 XP 지급
  const supabase = await createClient()
  await supabase.rpc('update_student_xp' as never, {
    p_student_id: studentId,
    p_xp: isCorrect ? 10 : 3,
  } as never)

  return NextResponse.json({ ok: true })
}
