import { NextRequest, NextResponse } from 'next/server'
import { createClient, getUserFromCookie } from '@/lib/supabase/server'

interface StatEntry {
  category: string
  isCorrect: boolean
}

// 여러 문제의 영역별 통계를 한 번에 업데이트 (N+1 방지)
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const user = await getUserFromCookie()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { entries }: { entries: StatEntry[] } = await req.json()
  if (!Array.isArray(entries) || entries.length === 0) {
    return NextResponse.json({ error: 'entries must be a non-empty array' }, { status: 400 })
  }

  // 카테고리별로 집계 (총 시도 수, 정답 수)
  const summary: Record<string, { total: number; correct: number }> = {}
  for (const { category, isCorrect } of entries) {
    if (!summary[category]) summary[category] = { total: 0, correct: 0 }
    summary[category].total += 1
    if (isCorrect) summary[category].correct += 1
  }

  const categories = Object.keys(summary)

  // 기존 통계 일괄 조회
  const { data: existing } = await supabase
    .from('student_skill_stats')
    .select('category, total_count, correct_count')
    .eq('student_id', user.id)
    .in('category', categories)

  const existingMap: Record<string, { total_count: number; correct_count: number }> = {}
  for (const row of existing ?? []) {
    existingMap[row.category] = { total_count: row.total_count, correct_count: row.correct_count }
  }

  // upsert 페이로드 구성
  const upsertRows = categories.map(category => {
    const prev = existingMap[category] ?? { total_count: 0, correct_count: 0 }
    const total = prev.total_count + summary[category].total
    const correct = prev.correct_count + summary[category].correct
    return {
      student_id: user.id,
      category,
      total_count: total,
      correct_count: correct,
      accuracy: Math.round((correct / total) * 100),
      updated_at: new Date().toISOString(),
    }
  })

  await supabase
    .from('student_skill_stats')
    .upsert(upsertRows, { onConflict: 'student_id,category' })

  // XP 지급: 총 정답 수 × 10 + 오답 수 × 3
  const totalCorrect = entries.filter(e => e.isCorrect).length
  const totalWrong = entries.length - totalCorrect
  const xpGain = totalCorrect * 10 + totalWrong * 3

  if (xpGain > 0) {
    const { data: gamif } = await supabase
      .from('student_gamification')
      .select('xp')
      .eq('student_id', user.id)
      .single()
    const newXp = (gamif?.xp ?? 0) + xpGain
    await supabase.from('student_gamification').upsert({
      student_id: user.id,
      xp: newXp,
      level: Math.max(1, Math.floor(newXp / 100) + 1),
      total_questions_solved: entries.length,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'student_id' })
  }

  return NextResponse.json({ ok: true, processed: entries.length })
}
