'use server'

import { createAdminClient, getUserFromCookie } from '@/lib/supabase/server'

export async function saveQuizResult(payload: {
  quizId: string
  coinsEarned: number
  correctCount: number
  maxCombo: number
}) {
  const user = await getUserFromCookie()
  if (!user) return { error: '로그인이 필요합니다.' }

  const admin = createAdminClient()

  // 이전 최고 기록 조회
  const { data: prev } = await admin
    .from('collocation_quiz_progress')
    .select('best_coins, attempts')
    .eq('student_id', user.id)
    .eq('quiz_id', payload.quizId)
    .single()

  const prevBest = prev?.best_coins ?? 0
  const coinDelta = Math.max(0, payload.coinsEarned - prevBest)

  // 최고 기록 갱신 (upsert)
  await admin.from('collocation_quiz_progress').upsert({
    student_id: user.id,
    quiz_id: payload.quizId,
    best_coins: Math.max(prevBest, payload.coinsEarned),
    best_correct: payload.correctCount,
    attempts: (prev?.attempts ?? 0) + 1,
    last_played_at: new Date().toISOString(),
  }, { onConflict: 'student_id,quiz_id' })

  // 코인 차액만 profiles에 추가
  if (coinDelta > 0) {
    await admin.rpc('increment_coins', { user_id: user.id, amount: coinDelta })
  }

  return { coinDelta, newBest: coinDelta > 0 }
}
