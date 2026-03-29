'use server'

import { createAdminClient, getUserFromCookie } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface Annotation {
  type: 'highlight' | 'chunk' | 'vocab'
  start: number
  end: number
  wordId?: string
  word?: string
  definition_ko?: string
  definition_en?: string
  synonyms?: string[]
}

export interface ParagraphInput {
  order_num: number
  text: string
  text_ko: string
  explanation: string
  annotations: Annotation[]
}

export interface PassageInput {
  title: string
  topic_category: string
  difficulty: number
  source: string
  classIds: string[]
  questionIds: string[]
  paragraphs: ParagraphInput[]
}

export async function createPassage(input: PassageInput): Promise<{ error?: string; id?: string }> {
  const user = await getUserFromCookie()
  if (!user) return { error: '로그인이 필요합니다.' }

  const admin = createAdminClient()
  const isPublished = input.classIds.length > 0

  const { data: passage, error: pe } = await admin
    .from('passages')
    .insert({
      teacher_id: user.id,
      title: input.title.trim(),
      topic_category: input.topic_category,
      difficulty: input.difficulty,
      source: input.source.trim() || null,
      is_published: isPublished,
    })
    .select('id')
    .single()

  if (pe) return { error: pe.message }

  const paraRows = input.paragraphs.map(p => ({
    passage_id: passage.id,
    order_num: p.order_num,
    text: p.text.trim(),
    text_ko: p.text_ko.trim() || null,
    explanation: p.explanation?.trim() || null,
    annotations: p.annotations,
  }))

  const { error: paraErr } = await admin.from('passage_paragraphs').insert(paraRows)
  if (paraErr) return { error: paraErr.message }

  if (input.classIds.length > 0) {
    const classRows = input.classIds.map(cid => ({ passage_id: passage.id, class_id: cid }))
    await admin.from('passage_classes').insert(classRows)
  }

  if (input.questionIds.length > 0) {
    const qRows = input.questionIds.map((qid, i) => ({ passage_id: passage.id, question_id: qid, order_num: i + 1 }))
    await admin.from('passage_questions').insert(qRows)
  }

  revalidatePath('/teacher/passages')
  return { id: passage.id }
}

export async function updatePassage(
  id: string,
  input: PassageInput
): Promise<{ error?: string }> {
  const user = await getUserFromCookie()
  if (!user) return { error: '로그인이 필요합니다.' }

  const admin = createAdminClient()
  const isPublished = input.classIds.length > 0

  const { error: pe } = await admin
    .from('passages')
    .update({
      title: input.title.trim(),
      topic_category: input.topic_category,
      difficulty: input.difficulty,
      source: input.source.trim() || null,
      is_published: isPublished,
    })
    .eq('id', id)
    .eq('teacher_id', user.id)

  if (pe) return { error: pe.message }

  // Replace paragraphs
  await admin.from('passage_paragraphs').delete().eq('passage_id', id)
  const paraRows = input.paragraphs.map(p => ({
    passage_id: id,
    order_num: p.order_num,
    text: p.text.trim(),
    text_ko: p.text_ko.trim() || null,
    explanation: p.explanation?.trim() || null,
    annotations: p.annotations,
  }))
  const { error: paraErr } = await admin.from('passage_paragraphs').insert(paraRows)
  if (paraErr) return { error: paraErr.message }

  // Replace class assignments
  await admin.from('passage_classes').delete().eq('passage_id', id)
  if (input.classIds.length > 0) {
    await admin.from('passage_classes').insert(
      input.classIds.map(cid => ({ passage_id: id, class_id: cid }))
    )
  }

  await admin.from('passage_questions').delete().eq('passage_id', id)
  if (input.questionIds.length > 0) {
    await admin.from('passage_questions').insert(
      input.questionIds.map((qid, i) => ({ passage_id: id, question_id: qid, order_num: i + 1 }))
    )
  }

  revalidatePath('/teacher/passages')
  return {}
}

export async function deletePassage(id: string): Promise<{ error?: string }> {
  const user = await getUserFromCookie()
  if (!user) return { error: '로그인이 필요합니다.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('passages')
    .delete()
    .eq('id', id)
    .eq('teacher_id', user.id)

  revalidatePath('/teacher/passages')
  return error ? { error: error.message } : {}
}
