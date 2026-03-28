'use server'

import { createAdminClient, getUserFromCookie } from '@/lib/supabase/server'

/** SM-2 spaced repetition algorithm
 *  rating: 1=Again (fail), 2=Hard (pass barely), 3=Easy (perfect)
 */
function sm2(
  easeFactor: number,
  intervalDays: number,
  repetitions: number,
  rating: 1 | 2 | 3
): { easeFactor: number; intervalDays: number; repetitions: number } {
  // Map to SM-2 quality: Again→1, Hard→3, Easy→5
  const quality = rating === 1 ? 1 : rating === 2 ? 3 : 5

  let newInterval: number
  let newRepetitions: number

  if (quality < 3) {
    // Failed – restart
    newRepetitions = 0
    newInterval = 1
  } else {
    if (repetitions === 0)      newInterval = 1
    else if (repetitions === 1) newInterval = 6
    else                        newInterval = Math.round(intervalDays * easeFactor)
    newRepetitions = repetitions + 1
  }

  const newEaseFactor = Math.max(
    1.3,
    easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
  )

  return { easeFactor: newEaseFactor, intervalDays: newInterval, repetitions: newRepetitions }
}

export async function rateVocabWord(
  wordId: string,
  rating: 1 | 2 | 3
): Promise<{ error?: string; nextReviewAt?: string }> {
  const user = await getUserFromCookie()
  if (!user) return { error: '로그인이 필요합니다.' }

  const admin = createAdminClient()

  // Get or initialise progress row
  const { data: existing } = await admin
    .from('vocab_progress')
    .select('*')
    .eq('student_id', user.id)
    .eq('word_id', wordId)
    .single()

  const ef  = existing?.ease_factor   ?? 2.5
  const int = existing?.interval_days ?? 0
  const rep = existing?.repetitions   ?? 0

  const updated = sm2(ef, int, rep, rating)
  const nextReview = new Date(
    Date.now() + updated.intervalDays * 24 * 60 * 60 * 1000
  ).toISOString()

  if (existing) {
    await admin.from('vocab_progress').update({
      ease_factor:    updated.easeFactor,
      interval_days:  updated.intervalDays,
      repetitions:    updated.repetitions,
      next_review_at: nextReview,
      last_rating:    rating,
      total_reviews:  (existing.total_reviews ?? 0) + 1,
      updated_at:     new Date().toISOString(),
    }).eq('id', existing.id)
  } else {
    await admin.from('vocab_progress').insert({
      student_id:     user.id,
      word_id:        wordId,
      ease_factor:    updated.easeFactor,
      interval_days:  updated.intervalDays,
      repetitions:    updated.repetitions,
      next_review_at: nextReview,
      last_rating:    rating,
      total_reviews:  1,
    })
  }

  return { nextReviewAt: nextReview }
}
