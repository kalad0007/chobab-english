import { createClient, getUserFromCookie } from '@/lib/supabase/server'
import Link from 'next/link'
import { Sparkles, Plus, BookOpen } from 'lucide-react'
import type { Question } from '@/types/database'
import QuestionsClient from './QuestionsClient'
import QuestionsFilter from './QuestionsFilter'


export const dynamic = 'force-dynamic'

export default async function QuestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; subtype?: string; q?: string; source?: string }>
}) {
  const supabase = await createClient()
  const user = await getUserFromCookie()
  if (!user) return null

  const params = await searchParams
  const { category, subtype, q, source } = params

  let query = supabase
    .from('questions')
    .select('*')
    .eq('teacher_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (category) query = query.eq('category', category)
  if (subtype === 'daily_life') {
    query = query.like('question_subtype', 'daily_life_%')
  } else if (subtype) {
    query = query.eq('question_subtype', subtype)
  }
  if (source)   query = query.eq('source', source)
  if (q)        query = query.or(`content.ilike.%${q}%,summary.ilike.%${q}%,subcategory.ilike.%${q}%`)

  const { data: rawQuestions } = await query

  // passage_group_id 기준으로 그룹핑 (최신순 유지)
  type QuestionRow = Question & { passage_group_id?: string | null }
  const questions = (rawQuestions ?? []) as QuestionRow[]
  const setMap = new Map<string, QuestionRow[]>()
  for (const q of questions) {
    if (q.passage_group_id) {
      const arr = setMap.get(q.passage_group_id) ?? []
      arr.push(q)
      setMap.set(q.passage_group_id, arr)
    }
  }
  // 원래 DB 순서(최신순) 유지하며 세트/개별 통합
  const seenGroups = new Set<string>()
  type ListItem =
    | { kind: 'set';      groupId: string; questions: QuestionRow[] }
    | { kind: 'question'; question: QuestionRow }
  const listItems: ListItem[] = []
  for (const q of questions) {
    if (q.passage_group_id) {
      if (!seenGroups.has(q.passage_group_id)) {
        seenGroups.add(q.passage_group_id)
        listItems.push({ kind: 'set', groupId: q.passage_group_id, questions: setMap.get(q.passage_group_id)! })
      }
    } else {
      listItems.push({ kind: 'question', question: q })
    }
  }
  const passageSets = Array.from(setMap.entries()).map(([groupId, qs]) => ({ groupId, questions: qs }))


  return (
    <div className="p-4 md:p-7">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-6 gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">📚 문제은행</h1>
          <p className="text-gray-500 text-sm mt-1">
            총 {questions.length}개 문제
            {passageSets.length > 0 && ` (세트 ${passageSets.length}개 포함)`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/teacher/questions/import"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition"
          >
            <BookOpen size={15} /> AI 스캔/PDF 등록
          </Link>
          <Link
            href="/teacher/questions/generate"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition"
          >
            <Sparkles size={15} /> AI 문제 생성
          </Link>
          <Link
            href="/teacher/questions/new"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition"
          >
            <Plus size={15} /> 직접 출제
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        {/* 문제 목록 */}
        <div className="min-w-0">
          {/* 검색/필터 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4 space-y-3">
            {/* 키워드 검색 */}
            <form className="flex gap-2" method="GET">
              {category && <input type="hidden" name="category" value={category} />}
              {subtype  && <input type="hidden" name="subtype"  value={subtype}  />}
              {source   && <input type="hidden" name="source"   value={source}   />}
              <input
                name="q"
                defaultValue={q}
                placeholder="문제 내용 검색..."
                className="flex-1 min-w-0 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
              />
              <button type="submit" className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition">
                검색
              </button>
            </form>

            {/* 카테고리 + 서브타입 필터 */}
            <QuestionsFilter
              currentCategory={category}
              currentSubtype={subtype}
              currentSource={source}
              currentQ={q}
            />

            {/* 출처 필터 chips */}
            <div className="flex flex-wrap gap-1.5">
              {[
                { value: '', label: '모든 출처' },
                { value: 'teacher', label: '직접 출제' },
                { value: 'ai_generated', label: 'AI 생성' },
              ].map(opt => (
                <Link
                  key={opt.value}
                  href={`/teacher/questions?${category ? `category=${category}&` : ''}${subtype ? `subtype=${subtype}&` : ''}${opt.value ? `source=${opt.value}&` : ''}${q ? `q=${q}` : ''}`}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition ${source === (opt.value || undefined) || (!source && !opt.value) ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {opt.label}
                </Link>
              ))}
            </div>
          </div>

          {/* 문제 카드 목록 */}
          {questions.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
              <BookOpen size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-400 font-medium">문제가 없어요</p>
              <p className="text-gray-300 text-sm mt-1">AI로 생성하거나 직접 출제해보세요</p>
            </div>
          ) : (
            <QuestionsClient listItems={listItems as Parameters<typeof QuestionsClient>[0]['listItems']} />
          )}
        </div>
      </div>
    </div>
  )
}
