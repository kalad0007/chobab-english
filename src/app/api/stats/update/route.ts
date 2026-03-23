import { NextRequest, NextResponse } from 'next/server'
import { createClient, getUserFromCookie } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const user = await getUserFromCookie()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { category, isCorrect } = await req.json()

  const { data: existing } = await supabase
    .from('student_skill_stats')
    .select('total_count, correct_count')
    .eq('student_id', user.id)
    .eq('category', category)
    .single()

  const total = (existing?.total_count ?? 0) + 1
  const correct = (existing?.correct_count ?? 0) + (isCorrect ? 1 : 0)

  await supabase.from('student_skill_stats').upsert({
    student_id: user.id,
    category,
    total_count: total,
    correct_count: correct,
    accuracy: Math.round((correct / total) * 100),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'student_id,category' })

  // XP 지급
  await supabase.rpc('update_student_xp' as never, {
    p_student_id: user.id,
    p_xp: isCorrect ? 10 : 3,
  } as never)

  return NextResponse.json({ ok: true })
}
