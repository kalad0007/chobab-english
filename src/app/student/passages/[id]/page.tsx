import { createAdminClient, getUserFromCookie } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import PassageReader, { type QuizQuestion } from './PassageReader'

export const dynamic = 'force-dynamic'

export default async function PassagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getUserFromCookie()
  if (!user) return null

  const admin = createAdminClient()

  // Access check
  const { data: memberships } = await admin
    .from('class_members').select('class_id').eq('student_id', user.id)
  const classIds = (memberships ?? []).map(m => m.class_id)

  const { data: pc } = await admin
    .from('passage_classes').select('passage_id').eq('passage_id', id).in('class_id', classIds).single()
  if (!pc) return notFound()

  const { data: passage } = await admin
    .from('passages')
    .select('id, title, topic_category, difficulty, source')
    .eq('id', id).eq('is_published', true).single()
  if (!passage) return notFound()

  const [{ data: paragraphs }, { data: pqRows }] = await Promise.all([
    admin.from('passage_paragraphs')
      .select('id, order_num, text, text_ko, explanation, annotations, vocab_json')
      .eq('passage_id', id)
      .order('order_num'),
    admin.from('passage_questions')
      .select('question_id, order_num')
      .eq('passage_id', id)
      .order('order_num'),
  ])

  // Fetch linked questions with options
  let quizQuestions: QuizQuestion[] = []
  if (pqRows && pqRows.length > 0) {
    const qIds = pqRows.map(r => r.question_id)
    const { data: qs } = await admin
      .from('questions')
      .select('id, content, options, answer, explanation, type')
      .in('id', qIds)
      .eq('type', 'multiple_choice')
    if (qs) {
      // Sort by passage_questions order
      const orderMap = Object.fromEntries(pqRows.map(r => [r.question_id, r.order_num]))
      quizQuestions = qs
        .filter(q => Array.isArray(q.options) && q.options.length > 0)
        .sort((a, b) => (orderMap[a.id] ?? 0) - (orderMap[b.id] ?? 0))
        .map(q => ({
          id: q.id,
          content: q.content,
          options: q.options as { num: number; text: string }[],
          answer: q.answer,
          explanation: typeof q.explanation === 'string' ? q.explanation : null,
        }))
    }
  }

  return (
    <PassageReader
      passage={passage}
      paragraphs={(paragraphs ?? []).map(p => ({
        id: p.id,
        order_num: p.order_num,
        text: p.text,
        text_ko: p.text_ko ?? '',
        explanation: (p as Record<string, unknown>).explanation as string ?? '',
        annotations: (p.annotations ?? []) as {
          type: 'highlight' | 'chunk' | 'vocab'
          start: number; end: number
          word?: string; definition_ko?: string; definition_en?: string; synonyms?: string[]
        }[],
        vocab_list: (Array.isArray((p as any).vocab_json) ? (p as any).vocab_json : []) as { word: string; meaning_ko: string; context: string }[],
      }))}
      quizQuestions={quizQuestions}
    />
  )
}
