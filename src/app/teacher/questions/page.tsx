import { createClient, getUserFromCookie } from '@/lib/supabase/server'
import Link from 'next/link'
import { CATEGORY_LABELS, QUESTION_SUBTYPE_LABELS, getDiffInfo } from '@/lib/utils'
import { Sparkles, Plus, BookOpen, Eye, Layers } from 'lucide-react'
import type { Question } from '@/types/database'
import CopyButton from './CopyButton'
import DeleteButton from './DeleteButton'

const CATEGORY_COLORS: Record<string, string> = {
  reading:    'bg-blue-100 text-blue-700',
  listening:  'bg-emerald-100 text-emerald-700',
  speaking:   'bg-orange-100 text-orange-700',
  writing:    'bg-purple-100 text-purple-700',
}

const CATEGORY_ICON: Record<string, string> = {
  reading: '📖', listening: '🎧', speaking: '🎤', writing: '✍️',
}

const SOURCE_LABEL: Record<string, string> = {
  teacher:        '직접 출제',
  ai_generated:   'AI 생성',
  toefl_official: 'TOEFL 기출',
}

// 카테고리별 주요 서브타입 필터 옵션
const SUBTYPE_FILTER: Record<string, { value: string; label: string }[]> = {
  reading: [
    { value: 'complete_the_words',    label: 'Complete the Words' },
    { value: 'sentence_completion',   label: 'Sentence Completion' },
    { value: 'daily_life_email',      label: 'Daily Life Email' },
    { value: 'daily_life_text_chain', label: 'Text Chain' },
    { value: 'academic_passage',      label: 'Academic Passage' },
  ],
  listening: [
    { value: 'choose_response', label: 'Choose a Response' },
    { value: 'conversation',    label: 'Conversation' },
    { value: 'academic_talk',   label: 'Academic Talk' },
  ],
  speaking: [
    { value: 'listen_and_repeat', label: 'Listen & Repeat' },
    { value: 'take_an_interview', label: 'Interview' },
  ],
  writing: [
    { value: 'sentence_reordering',  label: 'Build a Sentence' },
    { value: 'email_writing',        label: 'Write an Email' },
    { value: 'academic_discussion',  label: 'Academic Discussion' },
  ],
}

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
  if (subtype)  query = query.eq('question_subtype', subtype)
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

  // 카테고리별 개수
  const { data: counts } = await supabase
    .from('questions')
    .select('category')
    .eq('teacher_id', user.id)
    .eq('is_active', true)

  const countByCategory: Record<string, number> = {}
  for (const row of counts ?? []) {
    countByCategory[row.category] = (countByCategory[row.category] ?? 0) + 1
  }

  const subtypeOptions = category ? (SUBTYPE_FILTER[category] ?? []) : []

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

      <div className="flex flex-col md:flex-row gap-5">
        {/* 카테고리 사이드바 */}
        <div className="md:w-44 flex-shrink-0">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest px-2 mb-2 hidden md:block">카테고리</p>
          <div className="flex md:flex-col gap-1 overflow-x-auto pb-1 md:pb-0">
            <Link
              href="/teacher/questions"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${!category ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <span>전체</span>
              <span className="text-xs text-gray-400">{Object.values(countByCategory).reduce((a, b) => a + b, 0)}</span>
            </Link>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <div key={key}>
                <Link
                  href={`/teacher/questions?category=${key}`}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${category === key && !subtype ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <span>{label}</span>
                  <span className="text-xs text-gray-400">{countByCategory[key] ?? 0}</span>
                </Link>
                {category === key && (SUBTYPE_FILTER[key] ?? []).map(opt => (
                  <Link
                    key={opt.value}
                    href={`/teacher/questions?category=${key}&subtype=${opt.value}`}
                    className={`flex items-center gap-1.5 pl-6 pr-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${subtype === opt.value ? 'text-blue-600 font-semibold' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                    · {opt.label}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* 문제 목록 */}
        <div className="flex-1 min-w-0">
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

            {/* 서브타입 필터 chips */}
            {subtypeOptions.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <Link
                  href={`/teacher/questions?category=${category ?? ''}${q ? `&q=${q}` : ''}`}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition ${!subtype ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  전체 유형
                </Link>
                {subtypeOptions.map(opt => (
                  <Link
                    key={opt.value}
                    href={`/teacher/questions?category=${category ?? ''}&subtype=${opt.value}${q ? `&q=${q}` : ''}`}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition ${subtype === opt.value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    {opt.label}
                  </Link>
                ))}
              </div>
            )}

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
          <div className="space-y-2">
            {questions.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
                <BookOpen size={40} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-400 font-medium">문제가 없어요</p>
                <p className="text-gray-300 text-sm mt-1">AI로 생성하거나 직접 출제해보세요</p>
              </div>
            ) : (
              <>
                {listItems.map(item => {
                  if (item.kind === 'set') {
                    const { groupId, questions: setQs } = item
                    const rep = setQs[0]
                    const diff = getDiffInfo(rep.difficulty)
                    return (
                      <div key={groupId} className="bg-white rounded-xl border border-indigo-100 shadow-sm p-4 flex items-start gap-4 hover:border-indigo-300 transition group">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 ${CATEGORY_COLORS[rep.category] ?? 'bg-gray-100 text-gray-600'}`}>
                          {CATEGORY_ICON[rep.category] ?? '📘'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[rep.category] ?? 'bg-gray-100 text-gray-600'}`}>
                              {CATEGORY_LABELS[rep.category] ?? rep.category}
                            </span>
                            {rep.subcategory && (
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                # {rep.subcategory}
                              </span>
                            )}
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${diff.color}`}>
                              {diff.cefr} {diff.label}
                            </span>
                            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-bold">
                              <Layers size={10} /> {setQs.length}문제 세트
                            </span>
                            {rep.audio_url && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-sky-100 text-sky-700">🎧 음성있음</span>
                            )}
                          </div>
                          {(rep as QuestionRow & { summary?: string | null }).summary ? (
                            <p className="text-sm text-gray-800 font-medium line-clamp-2">{(rep as QuestionRow & { summary?: string | null }).summary}</p>
                          ) : (
                            <p className="text-sm text-gray-500 italic line-clamp-2">{(rep.passage ?? rep.content ?? '').replace(/\n/g, ' ').slice(0, 120)}…</p>
                          )}
                          <p className="text-xs text-gray-300 mt-1">{new Date(rep.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })} · {setQs.length}문제</p>
                        </div>
                        <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                          <Link href={`/teacher/questions/set/${groupId}`}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition">
                            <Eye size={12} /> 세트 보기
                          </Link>
                        </div>
                      </div>
                    )
                  }
                  const iq = item.question as QuestionRow & { summary?: string | null }
                  const diff = getDiffInfo(iq.difficulty)
                  return (
                    <div key={iq.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-start gap-4 hover:border-blue-200 transition group">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 ${CATEGORY_COLORS[iq.category] ?? 'bg-gray-100 text-gray-600'}`}>
                        {CATEGORY_ICON[iq.category] ?? '📘'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[iq.category] ?? 'bg-gray-100 text-gray-600'}`}>
                            {CATEGORY_LABELS[iq.category] ?? iq.category}
                          </span>
                          {iq.subcategory && (
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                              # {iq.subcategory}
                            </span>
                          )}
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${diff.color}`}>
                            {diff.cefr} {diff.label}
                          </span>
                          {iq.audio_url && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-sky-100 text-sky-700">🎧 음성있음</span>
                          )}
                          {iq.source === 'ai_generated' && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">AI생성</span>
                          )}
                        </div>
                        {iq.summary ? (
                          <p className="text-sm text-gray-800 font-medium line-clamp-2">{iq.summary}</p>
                        ) : (
                          <p className="text-sm text-gray-700 line-clamp-2">{iq.content}</p>
                        )}
                        <p className="text-xs text-gray-300 mt-1">
                          {new Date(iq.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })}
                          {iq.attempt_count > 0 && ` · 정답률 ${Math.round((iq.correct_count / iq.attempt_count) * 100)}% · 출제 ${iq.attempt_count}회`}
                        </p>
                      </div>
                      <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                        <Link href={`/teacher/questions/${iq.id}`}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition">
                          <Eye size={12} /> 미리보기
                        </Link>
                        <Link href={`/teacher/questions/${iq.id}/edit`}
                          className="px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg hover:bg-gray-50 transition">
                          수정
                        </Link>
                        <CopyButton question={iq} />
                        <DeleteButton id={iq.id} />
                      </div>
                    </div>
                  )
                })}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
