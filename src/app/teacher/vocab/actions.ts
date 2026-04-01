'use server'

import { createAdminClient, getUserFromCookie } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface VocabWordInput {
  word: string
  part_of_speech: string
  definition_ko: string
  definition_en: string
  synonyms: string[]
  antonyms: string[]
  idioms?: string[]
  topic_category: string
  difficulty: number
  audio_url?: string | null
  example_sentence?: string | null
  example_sentence_ko?: string | null
}

export async function createVocabWord(
  input: VocabWordInput
): Promise<{ error?: string; id?: string }> {
  const user = await getUserFromCookie()
  if (!user) return { error: '로그인이 필요합니다.' }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('vocab_words')
    .insert({ teacher_id: user.id, ...input })
    .select('id')
    .single()

  if (error) return { error: error.message }
  revalidatePath('/teacher/vocab')
  return { id: data.id }
}

export async function updateVocabWord(
  id: string,
  input: Partial<VocabWordInput>
): Promise<{ error?: string }> {
  const user = await getUserFromCookie()
  if (!user) return { error: '로그인이 필요합니다.' }

  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('vocab_words')
    .select('teacher_id')
    .eq('id', id)
    .single()
  if (!existing || existing.teacher_id !== user.id)
    return { error: '권한이 없습니다.' }

  const { error } = await admin
    .from('vocab_words')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/teacher/vocab')
  return {}
}

export async function deleteVocabWord(id: string): Promise<{ error?: string }> {
  const user = await getUserFromCookie()
  if (!user) return { error: '로그인이 필요합니다.' }

  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('vocab_words')
    .select('teacher_id')
    .eq('id', id)
    .single()
  if (!existing || existing.teacher_id !== user.id)
    return { error: '권한이 없습니다.' }

  const { error } = await admin
    .from('vocab_words')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/teacher/vocab')
  return {}
}
