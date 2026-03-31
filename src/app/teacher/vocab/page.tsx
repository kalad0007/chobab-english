import { createAdminClient, getUserFromCookie } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, BookA } from 'lucide-react'
import VocabListClient from './VocabListClient'
import BulkTtsButton from './BulkTtsButton'
import { TOEFL_TOPICS } from './constants'
import { getCustomTopics } from './topic-actions'

export const dynamic = 'force-dynamic'

export default async function TeacherVocabPage() {
  const user = await getUserFromCookie()
  if (!user) return null

  const admin = createAdminClient()
  const customTopics = await getCustomTopics()
  const allTopics = [
    ...TOEFL_TOPICS,
    ...customTopics.map(t => ({ value: t.value, label: t.label, emoji: t.emoji })),
  ]

  const { data: words } = await admin
    .from('vocab_words')
    .select('id, word, part_of_speech, definition_ko, synonyms, topic_category, difficulty, audio_url, is_active, created_at')
    .eq('teacher_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  const list = words ?? []

  // Stats
  const byTopic: Record<string, number> = {}
  for (const w of list) {
    byTopic[w.topic_category] = (byTopic[w.topic_category] ?? 0) + 1
  }
  const topTopics = Object.entries(byTopic)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)

  const withAudio = list.filter(w => w.audio_url).length
  const withoutAudio = list.filter(w => !w.audio_url).map(w => ({ id: w.id, word: w.word }))
  const today = new Date().toISOString().slice(0, 10)
  const addedToday = list.filter(w => w.created_at.slice(0, 10) === today).length

  return (
    <div className="p-3 md:p-7">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg md:text-2xl font-extrabold text-gray-900 flex items-center gap-2">
            <BookA size={20} className="text-blue-600" /> 어휘 데이터베이스
          </h1>
          <p className="text-gray-500 text-xs mt-0.5 hidden sm:block">TOEFL 어휘 카드 관리 · SRS 학습 자료</p>
        </div>
        <Link
          href="/teacher/vocab/new"
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs md:text-sm font-bold rounded-xl transition"
        >
          <Plus size={14} /> 새 단어 추가
        </Link>
      </div>

      {/* Stats bar — compact single row */}
      <div className="flex items-center bg-white rounded-xl border border-gray-100 shadow-sm px-3 py-2.5 mb-4">
        <div className="flex-1 text-center">
          <p className="text-[10px] text-gray-400 font-medium">전체</p>
          <p className="text-base font-extrabold text-gray-900">{list.length}<span className="text-[10px] font-normal text-gray-400 ml-0.5">개</span></p>
        </div>
        <div className="w-px h-7 bg-gray-100" />
        <div className="flex-1 text-center">
          <p className="text-[10px] text-gray-400 font-medium">오늘</p>
          <p className="text-base font-extrabold text-blue-600">{addedToday}<span className="text-[10px] font-normal text-gray-400 ml-0.5">개</span></p>
        </div>
        <div className="w-px h-7 bg-gray-100" />
        <div className="flex-1 text-center">
          <p className="text-[10px] text-gray-400 font-medium">음성</p>
          <p className="text-base font-extrabold text-emerald-600">
            {list.length > 0 ? Math.round(withAudio / list.length * 100) : 0}<span className="text-[10px] font-normal text-gray-400 ml-0.5">%</span>
          </p>
        </div>
        <div className="w-px h-7 bg-gray-100" />
        <div className="flex-1 flex items-center justify-center">
          <BulkTtsButton words={withoutAudio} />
        </div>
      </div>

      <VocabListClient initialWords={list} topics={allTopics} customTopics={customTopics} />
    </div>
  )
}
