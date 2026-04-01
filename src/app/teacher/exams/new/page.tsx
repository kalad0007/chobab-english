'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CATEGORY_LABELS, DIFFICULTY_LEVELS, QUESTION_SUBTYPE_LABELS, ACTIVE_SUBTYPES, getDiffInfo, DEFAULT_TIME_LIMITS, formatSeconds } from '@/lib/utils'
import { Search, Check, X, Clock, ChevronDown, ChevronUp, Trophy, Loader2 } from 'lucide-react'

const PAGE_SIZE = 50

const CATEGORY_COLORS: Record<string, string> = {
  reading:   'bg-blue-100 text-blue-700',
  listening: 'bg-emerald-100 text-emerald-700',
  speaking:  'bg-orange-100 text-orange-700',
  writing:   'bg-purple-100 text-purple-700',
}

const CATEGORY_TABS = [
  { value: 'all',       label: '전체' },
  { value: 'reading',   label: 'R' },
  { value: 'listening', label: 'L' },
  { value: 'writing',   label: 'W' },
  { value: 'speaking',  label: 'S' },
]

interface Question {
  id: string
  content: string
  category: string
  difficulty: number
  type: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options: any[] | null
  answer: string
  subcategory: string | null
  summary: string | null
  question_subtype: string | null
  source: string
  created_at: string
  passage_group_id: string | null
}

interface Class { id: string; name: string }

export default function NewExamPage() {
  const router = useRouter()
  const supabase = createClient()

  // ── 설정 ──
  const [title, setTitle] = useState('')
  const [classId, setClassId] = useState('')
  const [timeLimit, setTimeLimit] = useState(50)
  const [showResult, setShowResult] = useState(true)
  const [maxBand, setMaxBand] = useState(5.5)
  const [classes, setClasses] = useState<Class[]>([])
  const [saving, setSaving] = useState(false)
  const [showQBank, setShowQBank] = useState(true)

  // ── 선택된 문제 (id → 기본 정보 캐시) ──
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [selectedCache, setSelectedCache] = useState<Map<string, Question>>(new Map())

  // ── 문제은행 페이지네이션 ──
  const [questions, setQuestions] = useState<Question[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)

  // ── 필터 ──
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [subtypeFilter, setSubtypeFilter] = useState('')

  const userIdRef = useRef<string | null>(null)

  // 초기 로드
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      userIdRef.current = user.id
      const { data: cls } = await supabase.from('classes').select('id, name').eq('teacher_id', user.id)
      setClasses(cls ?? [])
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 필터 변경 시 리셋 후 재조회
  const fetchQuestions = useCallback(async (resetOffset: boolean) => {
    const uid = userIdRef.current
    if (!uid) return
    setLoading(true)
    const from = resetOffset ? 0 : offset

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = supabase
      .from('questions')
      .select('id, content, category, difficulty, type, options, answer, subcategory, summary, question_subtype, source, created_at, passage_group_id', { count: 'exact' })
      .eq('teacher_id', uid)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)

    if (catFilter !== 'all') query = query.eq('category', catFilter)
    if (subtypeFilter === 'daily_life') {
      // daily_life_* 전체 매칭
      query = query.like('question_subtype', 'daily_life%')
    } else if (subtypeFilter) {
      query = query.eq('question_subtype', subtypeFilter)
    }
    if (search) query = query.or(`content.ilike.%${search}%,summary.ilike.%${search}%`)

    const { data, count } = await query
    const rows = (data ?? []) as Question[]

    if (resetOffset) {
      setQuestions(rows)
      setOffset(PAGE_SIZE)
    } else {
      setQuestions(prev => [...prev, ...rows])
      setOffset(from + PAGE_SIZE)
    }
    setTotalCount(count ?? 0)
    setHasMore(rows.length === PAGE_SIZE)
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catFilter, subtypeFilter, search, offset])

  // 필터/검색 변경 → 리셋
  useEffect(() => {
    if (!userIdRef.current) return
    setOffset(0)
    fetchQuestions(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catFilter, subtypeFilter, search])

  // 사용자 로드 완료 후 최초 조회
  useEffect(() => {
    const check = setInterval(() => {
      if (userIdRef.current) {
        clearInterval(check)
        fetchQuestions(true)
      }
    }, 100)
    return () => clearInterval(check)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggle(q: Question) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(q.id)) {
        next.delete(q.id)
        setSelectedCache(c => { const m = new Map(c); m.delete(q.id); return m })
      } else {
        next.add(q.id)
        setSelectedCache(c => new Map(c).set(q.id, q))
      }
      return next
    })
  }

  async function save(status: 'draft' | 'published') {
    if (!title.trim()) return alert('시험 제목을 입력해주세요')
    if (!classId) return alert('대상 반을 선택해주세요')
    if (selected.size === 0) return alert('문제를 1개 이상 선택해주세요')

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: exam, error } = await supabase.from('exams').insert({
      teacher_id: user.id,
      class_id: classId || null,
      title: title.trim(),
      time_limit: timeLimit,
      show_result_immediately: showResult,
      description: JSON.stringify({ maxBand }),
      status,
    }).select('id').single()

    if (error || !exam) { alert('저장 실패: ' + error?.message); setSaving(false); return }

    const examQuestions = Array.from(selected).map((qId, i) => ({
      exam_id: exam.id, question_id: qId, order_num: i + 1, points: 5,
    }))
    await supabase.from('exam_questions').insert(examQuestions)
    router.push(`/teacher/exams/${exam.id}`)
  }

  const selectedQuestions = Array.from(selectedCache.values())
  const totalEstimatedSeconds = selectedQuestions.reduce((acc, q) =>
    acc + (DEFAULT_TIME_LIMITS[q.question_subtype ?? ''] ?? 30), 0)

  const subtypes = catFilter === 'all' ? [] : (ACTIVE_SUBTYPES[catFilter] ?? [])

  return (
    <div className="p-3 md:p-7 max-w-5xl">
      <div className="mb-3 md:mb-6">
        <h1 className="text-lg md:text-2xl font-extrabold text-gray-900">📝 새 시험 만들기</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6">
        {/* 왼쪽: 기본 설정 */}
        <div className="md:col-span-1 space-y-2 md:space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 md:p-5 space-y-3 md:space-y-4">
            <h2 className="font-bold text-gray-900 text-xs md:text-sm">기본 설정</h2>

            <div className="grid grid-cols-2 gap-2 md:block md:space-y-3">
              <div>
                <label className="text-[10px] md:text-xs font-bold text-gray-500 mb-1 block">시험 제목 *</label>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="예) 3월 모의고사"
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 md:px-3 md:py-2.5 text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-[10px] md:text-xs font-bold text-gray-500 mb-1 block">대상 반 *</label>
                <select value={classId} onChange={e => setClassId(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 md:px-3 md:py-2.5 text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">반 선택</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3 md:block md:space-y-3">
              <div className="flex-1">
                <label className="text-[10px] md:text-xs font-bold text-gray-500 mb-1 flex items-center gap-1">
                  <Clock size={10} /> 제한 시간 (분)
                </label>
                <input type="number" min={5} max={180} value={timeLimit} onChange={e => setTimeLimit(Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 md:px-3 md:py-2.5 text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <label className="flex items-center gap-1.5 cursor-pointer flex-shrink-0">
                <div onClick={() => setShowResult(!showResult)}
                  className={`w-8 h-4 md:w-10 md:h-5 rounded-full transition-colors flex-shrink-0 ${showResult ? 'bg-blue-500' : 'bg-gray-200'}`}>
                  <div className={`w-3 h-3 md:w-4 md:h-4 bg-white rounded-full mt-0.5 transition-transform shadow ${showResult ? 'translate-x-4 md:translate-x-5' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-[10px] md:text-sm text-gray-700 leading-tight">제출 즉시<br className="md:hidden" /> 결과 공개</span>
              </label>
            </div>

            <div>
              <label className="text-[10px] md:text-xs font-bold text-gray-500 mb-1 flex items-center gap-1">
                <Trophy size={10} className="text-orange-500" /> 최고 Band
                <span className={`ml-auto font-extrabold text-[10px] md:text-xs px-1.5 py-0.5 rounded-full ${getDiffInfo(maxBand).color}`}>
                  {getDiffInfo(maxBand).cefr} {getDiffInfo(maxBand).label}
                </span>
              </label>
              <div className="flex flex-wrap gap-1">
                {DIFFICULTY_LEVELS.map(l => (
                  <button key={l.value} onClick={() => setMaxBand(l.value)}
                    className={`px-1.5 py-0.5 rounded text-[10px] md:text-[11px] font-bold transition ${
                      maxBand === l.value ? `${l.color} ring-1 ring-offset-1` : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                    }`}>{l.cefr}</button>
                ))}
              </div>
            </div>
          </div>

          {/* 선택 요약 */}
          <div className="bg-blue-50 rounded-xl border border-blue-100 px-3 py-2 md:p-5">
            <div className="flex items-center justify-between md:block">
              <h2 className="font-bold text-blue-900 text-xs md:text-sm md:mb-3">
                선택 {selected.size}문제 · 총 {selected.size * 5}점
                {selected.size > 0 && <span className="ml-1 text-blue-500 font-normal">· {formatSeconds(totalEstimatedSeconds)}</span>}
              </h2>
              {selectedQuestions.length > 0 && (
                <div className="hidden md:block space-y-1.5 max-h-48 overflow-y-auto mt-2">
                  {selectedQuestions.map((q, i) => (
                    <div key={q.id} className="flex items-start gap-2 text-xs text-blue-800">
                      <span className="font-bold flex-shrink-0 text-blue-400">{i + 1}.</span>
                      <span className="line-clamp-1">{q.summary || q.content}</span>
                      <button onClick={() => toggle(q)} className="flex-shrink-0 ml-auto text-blue-300 hover:text-blue-600"><X size={12} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 저장 버튼 */}
          <div className="flex gap-2 md:block md:space-y-2">
            <button onClick={() => save('published')} disabled={saving}
              className="flex-1 py-2 md:w-full md:py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl text-xs md:text-sm font-bold transition">
              {saving ? '저장 중...' : '🚀 배포'}
            </button>
            <button onClick={() => save('draft')} disabled={saving}
              className="flex-1 py-2 md:w-full md:py-2.5 bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-60 text-gray-700 rounded-xl text-xs md:text-sm font-semibold transition">
              초안 저장
            </button>
          </div>
        </div>

        {/* 오른쪽: 문제은행 */}
        <div className="md:col-span-2">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            {/* 헤더 */}
            <div className="px-3 py-2 md:px-5 md:py-4 border-b border-gray-100 flex items-center justify-between cursor-pointer"
              onClick={() => setShowQBank(!showQBank)}>
              <h2 className="font-bold text-gray-900 text-xs md:text-base flex items-center gap-1.5">
                문제은행
                <span className="text-[10px] md:text-xs font-normal text-gray-400">
                  ({totalCount > 0 ? `${totalCount}개` : '로딩 중...'})
                </span>
              </h2>
              {showQBank ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
            </div>

            {showQBank && (
              <>
                {/* 필터 영역 */}
                <div className="px-3 py-2 md:px-5 md:py-3 border-b border-gray-100 space-y-1.5">
                  {/* 검색 */}
                  <div className="flex gap-1.5">
                    <div className="relative flex-1">
                      <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-300" />
                      <input value={searchInput}
                        onChange={e => setSearchInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') setSearch(searchInput) }}
                        placeholder="문제 검색..."
                        className="w-full pl-6 pr-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <button onClick={() => setSearch(searchInput)}
                      className="px-2.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition">
                      검색
                    </button>
                    {search && (
                      <button onClick={() => { setSearch(''); setSearchInput('') }}
                        className="px-2 py-1.5 bg-gray-100 text-gray-500 rounded-lg text-xs hover:bg-gray-200 transition">
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  {/* 카테고리 탭 */}
                  <div className="flex gap-1">
                    {CATEGORY_TABS.map(tab => (
                      <button key={tab.value}
                        onClick={() => { setCatFilter(tab.value); setSubtypeFilter('') }}
                        className={`px-2.5 py-1 rounded-lg text-[10px] md:text-xs font-bold transition ${
                          catFilter === tab.value
                            ? tab.value === 'all' ? 'bg-gray-800 text-white'
                              : tab.value === 'reading' ? 'bg-blue-600 text-white'
                              : tab.value === 'listening' ? 'bg-emerald-600 text-white'
                              : tab.value === 'writing' ? 'bg-purple-600 text-white'
                              : 'bg-orange-500 text-white'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}>
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* 서브타입 필터 */}
                  {catFilter !== 'all' && subtypes.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      <button onClick={() => setSubtypeFilter('')}
                        className={`px-2 py-0.5 rounded-full text-[9px] font-semibold transition ${!subtypeFilter ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                        전체
                      </button>
                      {subtypes.map(st => (
                        <button key={st.value} onClick={() => setSubtypeFilter(subtypeFilter === st.value ? '' : st.value)}
                          className={`px-2 py-0.5 rounded-full text-[9px] font-semibold transition ${subtypeFilter === st.value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                          {st.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 문제 목록 */}
                <div className="divide-y divide-gray-50 max-h-[60vh] md:max-h-[520px] overflow-y-auto">
                  {loading && questions.length === 0 ? (
                    <div className="flex items-center justify-center py-10 gap-2 text-gray-400">
                      <Loader2 size={16} className="animate-spin" />
                      <span className="text-xs">불러오는 중...</span>
                    </div>
                  ) : questions.length === 0 ? (
                    <p className="text-center py-8 text-xs text-gray-400">문제가 없어요</p>
                  ) : (
                    <>
                      {questions.map(q => {
                        const isSelected = selected.has(q.id)
                        const diff = getDiffInfo(q.difficulty)
                        return (
                          <div key={q.id} onClick={() => toggle(q)}
                            className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition ${isSelected ? 'bg-blue-50 border-l-2 border-blue-400' : 'hover:bg-gray-50 border-l-2 border-transparent'}`}>
                            <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition ${isSelected ? 'bg-blue-600' : 'border-2 border-gray-200'}`}>
                              {isSelected && <Check size={10} className="text-white" strokeWidth={3} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1 mb-0.5 flex-wrap">
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${CATEGORY_COLORS[q.category] ?? 'bg-gray-100 text-gray-600'}`}>
                                  {CATEGORY_LABELS[q.category] ?? q.category}
                                </span>
                                {q.question_subtype && QUESTION_SUBTYPE_LABELS[q.category]?.[q.question_subtype] && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                                    {QUESTION_SUBTYPE_LABELS[q.category][q.question_subtype]}
                                  </span>
                                )}
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${diff.color}`}>
                                  {diff.cefr}
                                </span>
                                {q.source === 'ai_generated' && (
                                  <span className="text-[9px] px-1 py-0.5 rounded-full bg-purple-100 text-purple-600">AI</span>
                                )}
                              </div>
                              <p className="text-xs text-gray-700 line-clamp-1">{q.summary || q.content}</p>
                            </div>
                          </div>
                        )
                      })}

                      {/* 더 불러오기 */}
                      {hasMore && (
                        <div className="px-3 py-3 text-center">
                          <button onClick={() => fetchQuestions(false)} disabled={loading}
                            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-semibold transition disabled:opacity-50">
                            {loading ? <><Loader2 size={12} className="animate-spin" /> 불러오는 중...</> : `다음 ${PAGE_SIZE}개 더 보기`}
                          </button>
                        </div>
                      )}
                      {!hasMore && questions.length > 0 && (
                        <p className="text-center py-2 text-[10px] text-gray-300">전체 {totalCount}개 로드 완료</p>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
