import { createAdminClient, getUserFromCookie } from '@/lib/supabase/server'
import StudyClient from '../StudyClient'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function SetStudyPage({
  params,
  searchParams,
}: {
  params: Promise<{ setId: string }>
  searchParams: Promise<{ all?: string }>
}) {
  const { setId } = await params
  const { all } = await searchParams
  const forceAll = all === '1'
  const user = await getUserFromCookie()
  if (!user) return null

  const admin = createAdminClient()

  // Verify student has access (via class)
  const { data: memberships } = await admin
    .from('class_members')
    .select('class_id')
    .eq('student_id', user.id)
  const classIds = (memberships ?? []).map(m => m.class_id)

  const { data: setClass } = await admin
    .from('vocab_set_classes')
    .select('set_id')
    .eq('set_id', setId)
    .in('class_id', classIds)
    .single()

  if (!setClass) return notFound()

  // Get set info
  const { data: set } = await admin
    .from('vocab_sets')
    .select('id, title, topic_category, difficulty, word_count')
    .eq('id', setId)
    .eq('is_published', true)
    .single()

  if (!set) return notFound()

  // Get words in this set (ordered)
  const { data: setWords } = await admin
    .from('vocab_set_words')
    .select('order_num, vocab_words(id, word, part_of_speech, definition_ko, definition_en, synonyms, antonyms, topic_category, difficulty, audio_url, example_sentence, example_sentence_ko)')
    .eq('set_id', setId)
    .order('order_num')

  const allWords = (setWords ?? [])
    .map(r => r.vocab_words as unknown as Record<string, unknown>)
    .filter(Boolean) as {
      id: string; word: string; part_of_speech: string;
      definition_ko: string; definition_en: string;
      synonyms: string[]; antonyms: string[];
      topic_category: string; difficulty: number;
      audio_url: string | null; example_sentence: string | null; example_sentence_ko: string | null
    }[]

  // Get student progress for these words
  const wordIds = allWords.map(w => w.id)
  const { data: progressRows } = wordIds.length > 0
    ? await admin
        .from('vocab_progress')
        .select('word_id, next_review_at, repetitions')
        .eq('student_id', user.id)
        .in('word_id', wordIds)
    : { data: [] }

  const progressMap = new Map((progressRows ?? []).map(p => [p.word_id, p]))
  const now = new Date()

  // Review due + new words
  const reviewWords = allWords.filter(w => {
    const p = progressMap.get(w.id)
    return p && new Date(p.next_review_at) <= now
  })
  const newWords = allWords.filter(w => !progressMap.has(w.id))

  const todayCards = forceAll ? allWords : [...reviewWords, ...newWords]
  const totalLearned = (progressRows ?? []).filter(p => p.repetitions > 0).length

  if (todayCards.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-emerald-50 to-white">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-2xl font-extrabold text-gray-900 mb-1">이 세트 완료!</h2>
        <p className="text-gray-500 mb-2">{set.title}</p>
        <p className="text-sm text-gray-400 mb-6">{totalLearned} / {allWords.length}개 학습 완료</p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <a href={`/student/vocab/${setId}?all=1`}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition">
            🔄 다시 학습하기
          </a>
          <a href="/student/vocab"
            className="flex items-center justify-center px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-2xl transition">
            다른 세트 보기
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <StudyClient
        cards={todayCards}
        reviewCount={reviewWords.length}
        newCount={newWords.length}
        totalLearned={totalLearned}
        totalWords={allWords.length}
        setTitle={set.title}
        backHref="/student/vocab"
      />
    </div>
  )
}
