import { createAdminClient, getUserFromCookie } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, FileText, Pencil, Globe, Lock } from 'lucide-react'
import { deletePassage } from './actions'
import { TOEFL_TOPICS } from '../vocab/constants'

export const dynamic = 'force-dynamic'

const TOPIC_EMOJI: Record<string, string> = Object.fromEntries(
  TOEFL_TOPICS.map(t => [t.value, t.emoji])
)

export default async function PassagesPage() {
  const user = await getUserFromCookie()
  if (!user) return null

  const admin = createAdminClient()
  const { data: passages } = await admin
    .from('passages')
    .select('id, title, topic_category, difficulty, is_published, source, created_at')
    .eq('teacher_id', user.id)
    .order('created_at', { ascending: false })

  // Count paragraphs per passage
  const ids = (passages ?? []).map(p => p.id)
  const { data: paraCounts } = ids.length > 0
    ? await admin
        .from('passage_paragraphs')
        .select('passage_id')
        .in('passage_id', ids)
    : { data: [] }

  const countMap: Record<string, number> = {}
  for (const r of paraCounts ?? []) {
    countMap[r.passage_id] = (countMap[r.passage_id] ?? 0) + 1
  }

  return (
    <div className="p-4 md:p-7 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
            <FileText size={24} className="text-blue-600" /> 지문 라이브러리
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">TOEFL 독해 지문을 만들고 반에 배포하세요</p>
        </div>
        <Link href="/teacher/passages/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition">
          <Plus size={16} /> 새 지문
        </Link>
      </div>

      {(passages ?? []).length === 0 ? (
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
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {(passages ?? []).map((p, idx) => {
            const emoji = TOPIC_EMOJI[p.topic_category] ?? '📝'
            const paraCount = countMap[p.id] ?? 0
            return (
              <div key={p.id}
                className={`flex items-center gap-4 px-5 py-3.5 ${idx < (passages ?? []).length - 1 ? 'border-b border-gray-50' : ''} hover:bg-gray-50 group transition`}>
                <span className="text-xl flex-shrink-0">{emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 text-sm truncate">{p.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {paraCount}문단 · Band {p.difficulty.toFixed(1)}
                    {p.source && <span> · {p.source}</span>}
                  </p>
                </div>
                <span className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${p.is_published ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                  {p.is_published ? <><Globe size={10} /> 배포됨</> : <><Lock size={10} /> 임시저장</>}
                </span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                  <Link href={`/teacher/passages/${p.id}/edit`}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition">
                    <Pencil size={14} />
                  </Link>
                  <form action={async () => {
                    'use server'
                    await deletePassage(p.id)
                  }}>
                    <button type="submit"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                    </button>
                  </form>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
