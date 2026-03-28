import { createAdminClient, getUserFromCookie } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, BookA } from 'lucide-react'
import VocabListClient from './VocabListClient'
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
  const today = new Date().toISOString().slice(0, 10)
  const addedToday = list.filter(w => w.created_at.slice(0, 10) === today).length

  return (
    <div className="p-4 md:p-7">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
            <BookA size={24} className="text-blue-600" /> 어휘 데이터베이스
          </h1>
          <p className="text-gray-500 text-sm mt-1">TOEFL 어휘 카드 관리 · SRS 학습 자료</p>
        </div>
        <Link
          href="/teacher/vocab/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition"
        >
          <Plus size={15} /> 새 단어 추가
        </Link>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 font-medium">전체 단어</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-0.5">{list.length}<span className="text-sm font-normal text-gray-400 ml-1">개</span></p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 font-medium">오늘 추가</p>
          <p className="text-2xl font-extrabold text-blue-600 mt-0.5">{addedToday}<span className="text-sm font-normal text-gray-400 ml-1">개</span></p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 font-medium">음성 포함</p>
          <p className="text-2xl font-extrabold text-emerald-600 mt-0.5">
            {list.length > 0 ? Math.round(withAudio / list.length * 100) : 0}
            <span className="text-sm font-normal text-gray-400 ml-0.5">%</span>
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 font-medium">주요 주제</p>
          <div className="flex flex-wrap gap-1 mt-1">
            {topTopics.length === 0
              ? <span className="text-sm text-gray-300">-</span>
              : topTopics.map(([cat, cnt]) => {
                  const t = allTopics.find(t => t.value === cat)
                  return (
                    <span key={cat} className="text-[11px] bg-blue-50 text-blue-700 font-semibold px-1.5 py-0.5 rounded-full">
                      {t?.emoji} {cnt}
                    </span>
                  )
                })
            }
          </div>
        </div>
      </div>

      <VocabListClient initialWords={list} topics={allTopics} customTopics={customTopics} />
    </div>
  )
}
