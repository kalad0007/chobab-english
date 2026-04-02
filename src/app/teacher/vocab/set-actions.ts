'use server'

import { createAdminClient, getUserFromCookie } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { WordLevel } from './constants'

/** Save generated words to vocab_words, then create a set and link them */
export async function createVocabSet(payload: {
  title: string
  topic_category: string
  difficulty: number
  classIds: string[]
  word_level?: WordLevel
  words: {
    word: string
    part_of_speech: string
    definition_ko: string
    definition_en: string
    synonyms: string[]
    antonyms: string[]
    audio_url?: string | null
    example_sentence?: string | null
    example_sentence_ko?: string | null
    word_level?: WordLevel
  }[]
}): Promise<{ error?: string; setId?: string }> {
  const user = await getUserFromCookie()
  if (!user) return { error: '로그인이 필요합니다.' }

  const admin = createAdminClient()

  // Determine set word_level from payload or infer from words
  const setWordLevel: WordLevel = payload.word_level ?? payload.words[0]?.word_level ?? 'toefl'

  // 1. Upsert vocab words (skip if word already exists for this teacher)
  const wordIds: string[] = []
  for (const w of payload.words) {
    // Check if word already exists for this teacher
    const { data: existing } = await admin
      .from('vocab_words')
      .select('id')
      .eq('teacher_id', user.id)
      .eq('is_active', true)
      .ilike('word', w.word.trim())
      .single()

    if (existing) {
      wordIds.push(existing.id)
    } else {
      const { data: inserted, error } = await admin
        .from('vocab_words')
        .insert({
          teacher_id:      user.id,
          word:            w.word.trim(),
          part_of_speech:  w.part_of_speech,
          definition_ko:   w.definition_ko,
          definition_en:   w.definition_en,
          synonyms:        w.synonyms,
          antonyms:        w.antonyms,
          topic_category:  payload.topic_category,
          difficulty:      payload.difficulty,
          word_level:      setWordLevel,
          audio_url:          w.audio_url ?? null,
          example_sentence:   w.example_sentence ?? null,
          example_sentence_ko: w.example_sentence_ko ?? null,
        })
        .select('id')
        .single()
      if (error) return { error: `단어 저장 실패 (${w.word}): ${error.message}` }
      wordIds.push(inserted.id)
    }
  }

  // 2. Create vocab set
  const { data: set, error: setError } = await admin
    .from('vocab_sets')
    .insert({
      teacher_id:     user.id,
      title:          payload.title,
      topic_category: payload.topic_category,
      difficulty:     payload.difficulty,
      word_level:     setWordLevel,
      word_count:     wordIds.length,
      is_published:   payload.classIds.length > 0,
      published_at:   payload.classIds.length > 0 ? new Date().toISOString() : null,
    })
    .select('id')
    .single()
  if (setError) return { error: setError.message }

  // 3. Link words to set
  if (wordIds.length > 0) {
    const { error: linkError } = await admin.from('vocab_set_words').insert(
      wordIds.map((wid, i) => ({ set_id: set.id, word_id: wid, order_num: i }))
    )
    if (linkError) return { error: linkError.message }
  }

  // 4. Publish to classes
  if (payload.classIds.length > 0) {
    const { error: classError } = await admin.from('vocab_set_classes').insert(
      payload.classIds.map(cid => ({ set_id: set.id, class_id: cid }))
    )
    if (classError) return { error: classError.message }
  }

  revalidatePath('/teacher/vocab')
  revalidatePath('/teacher/vocab/sets')
  return { setId: set.id }
}

/** Create a set from already-saved word IDs (no AI generation needed) */
export async function createVocabSetFromWordIds(payload: {
  title: string
  topic_category: string
  difficulty: number
  classIds: string[]
  wordIds: string[]
  word_level?: WordLevel
}): Promise<{ error?: string; setId?: string }> {
  const user = await getUserFromCookie()
  if (!user) return { error: '로그인이 필요합니다.' }
  if (payload.wordIds.length === 0) return { error: '단어를 선택하세요.' }

  const admin = createAdminClient()

  // Validate word_level consistency: fetch word_levels of selected words
  const { data: words } = await admin
    .from('vocab_words')
    .select('id, word, word_level')
    .in('id', payload.wordIds)
  if (words && words.length > 0) {
    const levels = new Set(words.map(w => w.word_level ?? 'toefl'))
    if (levels.size > 1) {
      return { error: '선택한 단어들의 레벨이 혼합되어 있습니다. 세트 내 모든 단어는 동일한 레벨(TOEFL 또는 초등)이어야 합니다.' }
    }
  }

  // Determine set word_level from payload or infer from words
  const setWordLevel: WordLevel = payload.word_level ?? (words?.[0]?.word_level as WordLevel) ?? 'toefl'

  const { data: set, error: setError } = await admin
    .from('vocab_sets')
    .insert({
      teacher_id:     user.id,
      title:          payload.title,
      topic_category: payload.topic_category,
      difficulty:     payload.difficulty,
      word_level:     setWordLevel,
      word_count:     payload.wordIds.length,
      is_published:   payload.classIds.length > 0,
      published_at:   payload.classIds.length > 0 ? new Date().toISOString() : null,
    })
    .select('id')
    .single()
  if (setError) return { error: setError.message }

  await admin.from('vocab_set_words').insert(
    payload.wordIds.map((wid, i) => ({ set_id: set.id, word_id: wid, order_num: i }))
  )

  if (payload.classIds.length > 0) {
    await admin.from('vocab_set_classes').insert(
      payload.classIds.map(cid => ({ set_id: set.id, class_id: cid }))
    )
  }

  revalidatePath('/teacher/vocab')
  revalidatePath('/teacher/vocab/sets')
  return { setId: set.id }
}

export async function deleteVocabSet(setId: string): Promise<{ error?: string }> {
  const user = await getUserFromCookie()
  if (!user) return { error: '로그인이 필요합니다.' }

  const admin = createAdminClient()
  const { data: set } = await admin.from('vocab_sets').select('teacher_id').eq('id', setId).single()
  if (!set || set.teacher_id !== user.id) return { error: '권한이 없습니다.' }

  await admin.from('vocab_sets').delete().eq('id', setId)
  revalidatePath('/teacher/vocab/sets')
  return {}
}

export async function toggleSetPublish(
  setId: string,
  classIds: string[]
): Promise<{ error?: string }> {
  const user = await getUserFromCookie()
  if (!user) return { error: '로그인이 필요합니다.' }

  const admin = createAdminClient()
  const { data: set } = await admin.from('vocab_sets').select('teacher_id, is_published').eq('id', setId).single()
  if (!set || set.teacher_id !== user.id) return { error: '권한이 없습니다.' }

  const nowPublished = !set.is_published
  await admin.from('vocab_sets').update({
    is_published: nowPublished,
    published_at: nowPublished ? new Date().toISOString() : null,
  }).eq('id', setId)

  // Reset class assignments
  await admin.from('vocab_set_classes').delete().eq('set_id', setId)
  if (nowPublished && classIds.length > 0) {
    await admin.from('vocab_set_classes').insert(
      classIds.map(cid => ({ set_id: setId, class_id: cid }))
    )
  }

  revalidatePath('/teacher/vocab/sets')
  return {}
}
