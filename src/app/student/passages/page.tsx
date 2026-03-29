import { createAdminClient, getUserFromCookie } from '@/lib/supabase/server'
import Link from 'next/link'
import { FileText, ChevronRight, Search } from 'lucide-react'
import { TOEFL_TOPICS } from '@/app/teacher/vocab/constants'

export const dynamic = 'force-dynamic'

const TOPIC_EMOJI: Record<string, string> = Object.fromEntries(TOEFL_TOPICS.map(t => [t.value, t.emoji]))
const TOPIC_LABEL: Record<string, string> = Object.fromEntries(TOEFL_TOPICS.map(t => [t.value, t.label]))

export default async function StudentPassagesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; topic?: string }>
}) {
  const user = await getUserFromCookie()
  if (!user) return null

  const { q, topic } = await searchParams

  const admin = createAdminClient()

  const { data: memberships } = await admin
    .from('class_members').select('class_id').eq('student_id', user.id)
  const classIds = (memberships ?? []).map(m => m.class_id)

  if (classIds.length === 0) {
    return (
      <div className="p-8 text-center max-w-md mx-auto pt-20">
        <FileText size={48} className="mx-auto text-gray-200 mb-4" />
        <p className="font-bold text-gray-400">아직 반에 등록되지 않았어요</p>
      </div>
    )
  }

  const { data: pcRows } = await admin
    .from('passage_classes').select('passage_id').in('class_id', classIds)
  const passageIds = [...new Set((pcRows ?? []).map(r => r.passage_id))]

  let passagesQuery = passageIds.length > 0
    ? admin
        .from('passages')
        .select('id, title, topic_category, difficulty, source')
        .in('id', passageIds)
        .eq('is_published', true)
        .order('created_at', { ascending: false })
    : null

  if (passagesQuery && q)     passagesQuery = passagesQuery.ilike('title', `%${q}%`)
  if (passagesQuery && topic) passagesQuery = passagesQuery.eq('topic_category', topic)

  const { data: passages } = passagesQuery
    ? await passagesQuery
    : { data: [] }

  const ids = (passages ?? []).map(p => p.id)
  const { data: paraCounts } = ids.length > 0
    ? await admin.from('passage_paragraphs').select('passage_id').in('passage_id', ids)
    : { data: [] }
  const countMap: Record<string, number> = {}
  for (const r of paraCounts ?? []) countMap[r.passage_id] = (countMap[r.passage_id] ?? 0) + 1

  return (
    <div className="p-4 md:p-6 max-w-lg mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
          <FileText size={24} className="text-blue-600" /> 독해 지문
        </h1>
        <p className="text-sm text-gray-400 mt-1">선생님이 배포한 TOEFL 지문을 학습하세요</p>
      </div>

      {/* 검색 */}
      <form method="GET" className="mb-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            name="q"
            defaultValue={q ?? ''}
            placeholder="지문 제목 검색..."
            className="w-full pl-8 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
          />
          {topic && <input type="hidden" name="topic" value={topic} />}
        </div>
      </form>

      {/* 토픽 필터 */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        <Link
          href="/student/passages"
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${!topic ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
          전체
        </Link>
        {TOEFL_TOPICS.map(t => (
          <Link
            key={t.value}
            href={`/student/passages?${new URLSearchParams({ ...(q ? { q } : {}), topic: t.value })}`}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${topic === t.value ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
          {t.emoji} {t.label}
          </Link>
        ))}
      </div>

      {(passages ?? []).length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-14 text-center">
          <div className="text-5xl mb-4">{q || topic ? '🔍' : '📭'}</div>
          <p className="font-bold text-gray-400">
            {q || topic ? '검색 결과가 없어요' : '아직 배포된 지문이 없어요'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {(passages ?? []).map(p => (
            <Link key={p.id} href={`/student/passages/${p.id}`}
              className="block bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:border-blue-200 hover:shadow-md transition group">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-2xl flex-shrink-0">
                  {TOPIC_EMOJI[p.topic_category] ?? '📝'}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 text-sm truncate">{p.title}</h3>
                  <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                    <span>{TOPIC_LABEL[p.topic_category] ?? p.topic_category}</span>
                    <span>·</span>
                    <span>{countMap[p.id] ?? 0}문단</span>
                    <span>·</span>
                    <span>Band {p.difficulty.toFixed(1)}</span>
                    {p.source && <><span>·</span><span className="truncate">{p.source}</span></>}
                  </div>
                </div>
                <ChevronRight size={18} className="text-gray-300 group-hover:text-blue-400 flex-shrink-0 mt-1 transition" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
