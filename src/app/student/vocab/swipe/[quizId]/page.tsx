import { redirect } from 'next/navigation'
import { createAdminClient, getUserFromCookie } from '@/lib/supabase/server'
import SwipeGameClient from './SwipeGameClient'

export default async function SwipeGamePage({ params }: { params: Promise<{ quizId: string }> }) {
  const user = await getUserFromCookie()
  if (!user) redirect('/login')

  const { quizId } = await params
  const admin = createAdminClient()

  // 퀴즈 정보 + 접근 권한 확인 (자신의 반에 배포된 퀴즈)
  const { data: quiz } = await admin
    .from('collocation_quizzes')
    .select('id, title, status, teacher_id')
    .eq('id', quizId)
    .single()

  if (!quiz) redirect('/student/vocab')

  // 퀴즈 아이템 fetch (단어 정보 포함)
  const { data: items } = await admin
    .from('collocation_quiz_items')
    .select('id, collocation, order_num, vocab_words(id, word, part_of_speech, definition_ko)')
    .eq('quiz_id', quizId)
    .order('order_num')

  type RawItem = {
    id: string
    collocation: string
    order_num: number
    vocab_words: { id: string; word: string; part_of_speech: string; definition_ko: string } | null
  }

  const gameItems = (items ?? [])
    .map(r => r as unknown as RawItem)
    .filter(r => r.vocab_words)
    .map(r => ({
      id: r.id,
      collocation: r.collocation,
      word: r.vocab_words!.word,
      part_of_speech: r.vocab_words!.part_of_speech,
      definition_ko: r.vocab_words!.definition_ko,
    }))

  if (gameItems.length === 0) redirect('/student/vocab')

  return <SwipeGameClient quizTitle={quiz.title} quizId={quiz.id} items={gameItems} />
}
