'use server'

import { createAdminClient, getUserFromCookie } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function saveAsset(payload: {
  asset_type: string
  title: string
  tags: string[]
  file_url?: string | null
  transcript?: string | null
  metadata?: Record<string, unknown>
}): Promise<{ error?: string; id?: string }> {
  const user = await getUserFromCookie()
  if (!user) return { error: '로그인이 필요합니다.' }

  const admin = createAdminClient()
  const { data, error } = await admin.from('learning_assets').insert({
    teacher_id: user.id,
    ...payload,
  }).select('id').single()

  if (error) return { error: error.message }
  revalidatePath('/teacher/contents')
  return { id: data.id }
}

export async function deleteAsset(id: string): Promise<{ error?: string }> {
  const user = await getUserFromCookie()
  if (!user) return { error: '로그인이 필요합니다.' }

  const admin = createAdminClient()

  // Verify ownership
  const { data: asset } = await admin.from('learning_assets')
    .select('teacher_id, file_url').eq('id', id).single()
  if (!asset || asset.teacher_id !== user.id) return { error: '권한이 없습니다.' }

  // Delete storage file if exists
  if (asset.file_url) {
    const url = asset.file_url as string
    const match = url.match(/question-audio\/(.+)$/)
    if (match) {
      await admin.storage.from('question-audio').remove([match[1]])
    }
  }

  const { error } = await admin.from('learning_assets').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/teacher/contents')
  return {}
}

export async function fetchQuestionsBySubtype(subtype: string): Promise<{
  error?: string
  questions?: {
    id: string
    content: string
    difficulty: number
    source: string
    created_at: string
    type: string
  }[]
}> {
  const user = await getUserFromCookie()
  if (!user) return { error: '로그인이 필요합니다.' }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('questions')
    .select('id, content, difficulty, source, created_at, type')
    .eq('teacher_id', user.id)
    .eq('question_subtype', subtype)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) return { error: error.message }
  return { questions: data ?? [] }
}

export async function deleteQuestion(id: string): Promise<{ error?: string }> {
  const user = await getUserFromCookie()
  if (!user) return { error: '로그인이 필요합니다.' }

  const admin = createAdminClient()
  const { data: q } = await admin.from('questions').select('teacher_id').eq('id', id).single()
  if (!q || q.teacher_id !== user.id) return { error: '권한이 없습니다.' }

  const { error } = await admin.from('questions').update({ is_active: false }).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/teacher/contents')
  revalidatePath('/teacher/questions')
  return {}
}

export async function saveGeneratedQuestions(questions: {
  content: string
  options: { num: number; text: string }[] | null
  answer: string
  explanation: string
  category: string
  question_subtype: string
  difficulty: number
  audio_script?: string | null
  audio_url?: string | null
}[]): Promise<{ error?: string }> {
  const user = await getUserFromCookie()
  if (!user) return { error: '로그인이 필요합니다.' }

  const admin = createAdminClient()
  const ESSAY_SUBTYPES = new Set(['complete_the_words', 'sentence_completion', 'email_writing', 'sentence_reordering', 'listen_and_repeat', 'take_an_interview'])

  const rows = questions.map(q => ({
    teacher_id: user.id,
    type: ESSAY_SUBTYPES.has(q.question_subtype) ? 'essay' : 'multiple_choice',
    content: q.content,
    options: q.options,
    answer: q.answer,
    explanation: q.explanation,
    category: q.category,
    question_subtype: q.question_subtype,
    difficulty: q.difficulty,
    audio_script: q.audio_script ?? null,
    audio_url: q.audio_url ?? null,
    source: 'ai_generated',
    passage_group_id: null,
  }))

  const { error } = await admin.from('questions').insert(rows)
  if (error) return { error: error.message }
  return {}
}
