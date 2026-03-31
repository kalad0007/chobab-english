import { createAdminClient, getUserFromCookie } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, FileText } from 'lucide-react'
import { TOEFL_TOPICS } from '../vocab/constants'
import { getCustomTopics } from '../vocab/topic-actions'
import PassagesClient from './PassagesClient'

export const dynamic = 'force-dynamic'

const TOPIC_EMOJI: Record<string, string> = Object.fromEntries(TOEFL_TOPICS.map(t => [t.value, t.emoji]))
const TOPIC_LABEL: Record<string, string> = Object.fromEntries(TOEFL_TOPICS.map(t => [t.value, t.label]))

export default async function PassagesPage() {
  const user = await getUserFromCookie()
  if (!user) return null

  const admin = createAdminClient()
  const customTopics = await getCustomTopics()
  const allTopics = [
    ...TOEFL_TOPICS,
    ...customTopics.map(t => ({ value: t.value, label: t.label, emoji: t.emoji })),
  ]

  const { data: passages } = await admin
    .from('passages')
    .select('id, title, topic_category, difficulty, is_published, source, created_at')
    .eq('teacher_id', user.id)
    .order('created_at', { ascending: false })

  const ids = (passages ?? []).map(p => p.id)
  const { data: paraCounts } = ids.length > 0
    ? await admin.from('passage_paragraphs').select('passage_id').in('passage_id', ids)
    : { data: [] }

  const countMap: Record<string, number> = {}
  for (const r of paraCounts ?? []) countMap[r.passage_id] = (countMap[r.passage_id] ?? 0) + 1

  const enriched = (passages ?? []).map(p => ({
    id: p.id,
    title: p.title,
    topic_category: p.topic_category,
    topicEmoji: TOPIC_EMOJI[p.topic_category] ?? '📝',
    topicLabel: TOPIC_LABEL[p.topic_category] ?? p.topic_category,
    difficulty: p.difficulty,
    is_published: p.is_published,
    source: p.source,
    paraCount: countMap[p.id] ?? 0,
  }))

  return (
    <div className="p-3 md:p-7 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg md:text-2xl font-extrabold text-gray-900 flex items-center gap-2">
            <FileText size={20} className="text-blue-600" /> 지문 라이브러리
          </h1>
          <p className="text-xs text-gray-400 mt-0.5 hidden sm:block">TOEFL 독해 지문을 만들고 반에 배포하세요</p>
        </div>
        <Link href="/teacher/passages/new"
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs md:text-sm font-bold rounded-xl transition">
          <Plus size={14} /> 새 지문
        </Link>
      </div>

      {enriched.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
          <FileText size={48} className="mx-auto text-gray-200 mb-4" />
          <p className="font-bold text-gray-400 text-lg">아직 지문이 없어요</p>
          <p className="text-sm text-gray-300 mt-1 mb-6">첫 번째 TOEFL 독해 지문을 만들어 보세요</p>
          <Link href="/teacher/passages/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition">
            <Plus size={15} /> 새 지문 만들기
          </Link>
        </div>
      ) : (
        <PassagesClient passages={enriched} topics={allTopics} customTopics={customTopics} />
      )}
    </div>
  )
}
