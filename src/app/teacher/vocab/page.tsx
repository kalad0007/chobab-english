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
          <p className="text-gray-500 text-xs mt-0.5 hidden md:block">TOEFL 어휘 카드 관리 · SRS 학습 자료</p>
        </div>
        <Link
          href="/teacher/vocab/new"
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs md:text-sm font-bold rounded-xl transition"
        >
          <Plus size={14} /> 새 단어 추가
        </Link>
      </div>

      {/* Stats bar — inline badge style */}
      <div className="flex flex-wrap items-center gap-2 px-1 py-1 mb-3">
        <span className="text-xs px-2 py-1 rounded-lg bg-gray-50 border border-gray-100 text-gray-700 font-semibold">
          전체 <span className="font-extrabold text-gray-900">{list.length}</span>개
        </span>
        <span className="text-xs px-2 py-1 rounded-lg bg-blue-50 border border-blue-100 text-blue-600 font-semibold">
          오늘 <span className="font-extrabold">{addedToday}</span>개
        </span>
        <span className="text-xs px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-600 font-semibold">
          음성 <span className="font-extrabold">{list.length > 0 ? Math.round(withAudio / list.length * 100) : 0}</span>%
        </span>
        {withoutAudio.length > 0 && <BulkTtsButton words={withoutAudio} />}
      </div>

      <VocabListClient initialWords={list} topics={allTopics} customTopics={customTopics} />
    </div>
  )
}
