import { createClient, createAdminClient, getUserFromCookie } from '@/lib/supabase/server'
import ReviewClient, { ReviewItem } from './ReviewClient'

export default async function ReviewPage() {
  const supabase = await createClient()
  const admin = createAdminClient()
  const user = await getUserFromCookie()
  if (!user) return null

  // 오답 큐 조회 (question join 없이)
  const { data: queue } = await supabase
    .from('wrong_answer_queue')
    .select('id, original_question_id, retry_count')
    .eq('student_id', user.id)
    .eq('mastered', false)
    .lte('next_review_at', new Date().toISOString())
    .order('retry_count', { ascending: true })
    .limit(10)

  // 문제 정보는 adminClient로 조회 (RLS 우회)
  const questionIds = [...new Set((queue ?? []).map(q => q.original_question_id))]
  const { data: questions } = questionIds.length > 0
    ? await admin
        .from('questions')
        .select('id, content, passage, options, answer, explanation, vocab_words, category, type, question_subtype')
        .in('id', questionIds)
    : { data: [] }

  const questionMap = Object.fromEntries((questions ?? []).map(q => [q.id, q]))

  const items: ReviewItem[] = (queue ?? [])
    .map(row => ({
      id: row.id,
      original_question_id: row.original_question_id,
      retry_count: row.retry_count,
      question: questionMap[row.original_question_id],
    }))
    .filter(item => item.question != null)

  return <ReviewClient initialItems={items} />
}
