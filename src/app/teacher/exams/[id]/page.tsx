import { createClient, getUserFromCookie } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowLeft, Users, BookOpen, Headphones, PenLine, Mic, TrendingUp, Award } from 'lucide-react'
import ExamActions from './ExamActions'
import { getDiffInfo } from '@/lib/utils'

const SUBTYPE_LABEL: Record<string, string> = {
  complete_the_words:  'Complete the Words',
  sentence_completion: 'Sentence Completion',
  daily_life:          'Daily Life',
  academic_passage:    'Academic Passage',
  choose_response:     'Choose a Response',
  conversation:        'Conversation',
  campus_announcement: 'Campus Announcement',
  academic_talk:       'Academic Talk',
  sentence_reordering: 'Build a Sentence',
  email_writing:       'Write an Email',
  academic_discussion: 'Academic Discussion',
  listen_and_repeat:   'Listen & Repeat',
  take_an_interview:   'Interview',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function QRow({ idx, q }: { idx: number; q: any }) {
  const label = SUBTYPE_LABEL[q.question_subtype] ?? q.question_subtype ?? q.category
  const display = q.summary ?? q.content
  const diffInfo = q.difficulty != null ? getDiffInfo(q.difficulty) : null
  return (
    <div className="flex items-start gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-[11px] font-bold text-gray-300 flex-shrink-0 w-5 text-right mt-0.5">{idx}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-700 line-clamp-1">{display}</p>
        <span className="text-[11px] text-indigo-400 mt-0.5 block">{label}</span>
      </div>
      {diffInfo && (
        <span className={`text-[10px] font-bold flex-shrink-0 px-1.5 py-0.5 rounded-full ${diffInfo.color}`}>
          {diffInfo.label}
        </span>
      )}
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SubGroup({ title, ids, qById }: { title: string; ids: string[]; qById: Record<string, any>; offset?: number }) {
  if (ids.length === 0) return null
  return (
    <div>
      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide px-4 py-1.5 bg-gray-50/80 border-y border-gray-100">
        {title} <span className="text-gray-300 font-normal">({ids.length})</span>
      </p>
      {ids.map((id, i) => <QRow key={id} idx={i + 1} q={qById[id] ?? { content: id, question_subtype: '' }} />)}
    </div>
  )
}

export default async function ExamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: examId } = await params
  const supabase = await createClient()
  const user = await getUserFromCookie()
  if (!user) return null

  const { data: exam } = await supabase
    .from('exams')
    .select('*, classes(name)')
    .eq('id', examId)
    .eq('teacher_id', user.id)
    .single()

  if (!exam) return <div className="p-7 text-gray-500">시험을 찾을 수 없어요.</div>

  const { data: submissions } = await supabase
    .from('submissions')
    .select('id, score, percentage, submitted_at, profiles(name)')
    .eq('exam_id', examId)
    .order('submitted_at', { ascending: false })

  const avgPct = submissions && submissions.length > 0
    ? Math.round(submissions.reduce((acc, s) => acc + (s.percentage ?? 0), 0) / submissions.length)
    : null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cls = exam.classes as any

  // ── Adaptive 파싱 ────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cfg: any = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let qById: Record<string, any> = {}

  if (exam.description) {
    try {
      const parsed = JSON.parse(exam.description)
      if (parsed.adaptive) {
        cfg = parsed
        const allIds = new Set<string>()
        const add = (ids: string[]) => ids.forEach(id => allIds.add(id))
        add(cfg.m1Ids ?? [])
        add(cfg.m2upIds ?? [])
        add(cfg.m2downIds ?? [])
        for (const mod of [cfg.listening_m1, cfg.listening_m2up, cfg.listening_m2down]) {
          if (!mod) continue
          add(mod.response ?? [])
          for (const s of [...(mod.conversation ?? []), ...(mod.academicTalk ?? [])]) add(s.questionIds ?? [])
        }
        add(cfg.writing?.reorderingIds ?? [])
        add(cfg.writing?.emailIds ?? [])
        add(cfg.speaking?.listenRepeatIds ?? [])
        add(cfg.speaking?.interviewIds ?? [])
        if (allIds.size > 0) {
          const { data: qs } = await supabase
            .from('questions')
            .select('id, content, summary, category, question_subtype, difficulty')
            .in('id', [...allIds])
          for (const q of qs ?? []) qById[q.id] = q
        }
      }
    } catch { /* ignore */ }
  }

  // ── 일반 시험 ────────────────────────────────────────
  let examQuestions = null
  if (!cfg) {
    const { data: eq } = await supabase
      .from('exam_questions')
      .select('*, questions(content, summary, category, question_subtype, difficulty)')
      .eq('exam_id', examId)
      .order('order_num')
    examQuestions = eq
  }

  // ── 섹션별 문제 수 계산 ──────────────────────────────
  const calcMod = (mod: any) => {
    if (!mod) return 0
    return (mod.response?.length ?? 0) +
      (mod.conversation ?? []).reduce((a: number, s: any) => a + s.questionIds.length, 0) +
      (mod.academicTalk ?? []).reduce((a: number, s: any) => a + s.questionIds.length, 0)
  }

  const readCount = cfg ? (cfg.m1Ids?.length ?? 0) + (cfg.m2upIds?.length ?? 0) + (cfg.m2downIds?.length ?? 0) : 0
  const listenCount = cfg ? calcMod(cfg.listening_m1) + calcMod(cfg.listening_m2up) + calcMod(cfg.listening_m2down) : 0
  const writeCount = cfg ? (cfg.writing?.reorderingIds?.length ?? 0) + (cfg.writing?.emailIds?.length ?? 0) : 0
  const speakCount = cfg ? (cfg.speaking?.listenRepeatIds?.length ?? 0) + (cfg.speaking?.interviewIds?.length ?? 0) : 0
  const totalQCount = cfg
    ? readCount + listenCount + writeCount + speakCount
    : examQuestions?.length ?? 0

  const statusCfg = {
    draft:     { label: '초안',   cls: 'bg-gray-100 text-gray-600' },
    published: { label: '진행중', cls: 'bg-emerald-100 text-emerald-700' },
    closed:    { label: '종료',   cls: 'bg-blue-100 text-blue-700' },
  }[exam.status as string] ?? { label: exam.status, cls: 'bg-gray-100 text-gray-500' }

  // Section overview data
  const sections = cfg ? [
    { key: 'reading',   icon: BookOpen,    label: 'Reading',   count: readCount,   color: 'from-blue-500 to-blue-600',    bg: 'bg-blue-50',   text: 'text-blue-700',  border: 'border-blue-100' },
    { key: 'listening', icon: Headphones,  label: 'Listening', count: listenCount, color: 'from-emerald-500 to-teal-600', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100' },
    { key: 'writing',   icon: PenLine,     label: 'Writing',   count: writeCount,  color: 'from-purple-500 to-violet-600', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-100' },
    { key: 'speaking',  icon: Mic,         label: 'Speaking',  count: speakCount,  color: 'from-orange-500 to-amber-500',  bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-100' },
  ] : []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function ListeningModSection({ mod, label }: { mod: any; label: string }) {
    if (!mod || calcMod(mod) === 0) return null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const convSets: any[] = mod.conversation ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const talkSets: any[] = mod.academicTalk ?? []
    return (
      <div className="mb-3 last:mb-0">
        <div className="px-4 py-1.5 bg-emerald-50/60 border-y border-emerald-100/60">
          <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide">{label}</span>
          <span className="text-[11px] text-emerald-500 ml-1">· {calcMod(mod)}문제</span>
        </div>
        <SubGroup title="Choose a Response" ids={mod.response ?? []} qById={qById} />
        {convSets.map((s, i) => (
          <SubGroup key={i} title={`Conversation Set ${i + 1}`} ids={s.questionIds ?? []} qById={qById} />
        ))}
        {talkSets.map((s, i) => (
          <SubGroup key={i} title={`Academic Talk Set ${i + 1}`} ids={s.questionIds ?? []} qById={qById} />
        ))}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="max-w-5xl mx-auto p-4 md:p-7 space-y-5">

        {/* ── 히어로 헤더 ── */}
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-800 via-blue-900 to-indigo-900 rounded-2xl text-white p-6 md:p-8 shadow-xl">
          {/* 배경 장식 */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4 pointer-events-none" />

          <div className="relative">
            <Link href="/teacher/exams" className="inline-flex items-center gap-1 text-xs text-white/50 hover:text-white/80 mb-4 transition">
              <ArrowLeft size={12} /> 시험 목록
            </Link>

            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h1 className="text-2xl md:text-3xl font-extrabold">{exam.title}</h1>
                  {cfg && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-400/30 text-blue-200 border border-blue-400/30">스마트 빌더</span>}
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusCfg.cls}`}>{statusCfg.label}</span>
                </div>
                {cls && <p className="text-sm text-white/50">{cls.name}</p>}
              </div>
              <ExamActions examId={examId} currentStatus={exam.status} />
            </div>

            {/* 핵심 지표 4개 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white/10 rounded-xl px-4 py-3 backdrop-blur-sm border border-white/10">
                <div className="text-2xl font-black">120<span className="text-sm font-semibold ml-0.5">점</span></div>
                <div className="text-xs text-white/60 mt-0.5">TOEFL 총점</div>
              </div>
              {cfg ? (
                <div className="bg-white/10 rounded-xl px-4 py-3 backdrop-blur-sm border border-white/10">
                  <div className="text-2xl font-black flex items-end gap-1">
                    {cfg.maxBand ?? '—'}
                    <span className="text-sm font-semibold mb-0.5">Band</span>
                  </div>
                  <div className="text-xs text-white/60 mt-0.5">최고 출제 밴드</div>
                </div>
              ) : (
                <div className="bg-white/10 rounded-xl px-4 py-3 backdrop-blur-sm border border-white/10">
                  <div className="text-2xl font-black">{totalQCount}<span className="text-sm font-semibold ml-0.5">문</span></div>
                  <div className="text-xs text-white/60 mt-0.5">총 문제 수</div>
                </div>
              )}
              <div className="bg-white/10 rounded-xl px-4 py-3 backdrop-blur-sm border border-white/10">
                <div className="text-2xl font-black">{submissions?.length ?? 0}<span className="text-sm font-semibold ml-0.5">명</span></div>
                <div className="text-xs text-white/60 mt-0.5">제출자</div>
              </div>
              <div className="bg-white/10 rounded-xl px-4 py-3 backdrop-blur-sm border border-white/10">
                <div className={`text-2xl font-black ${avgPct !== null ? (avgPct >= 80 ? 'text-emerald-300' : avgPct >= 60 ? 'text-blue-300' : 'text-amber-300') : ''}`}>
                  {avgPct !== null ? `${avgPct}%` : '—'}
                </div>
                <div className="text-xs text-white/60 mt-0.5">평균 점수</div>
              </div>
            </div>

            {/* 스마트 빌더 밴드 범위 */}
            {cfg && (
              <div className="mt-4 flex items-center gap-3 text-sm text-white/60">
                <Award size={14} className="text-yellow-400" />
                <span>목표 밴드 <strong className="text-white">{cfg.targetBand}</strong></span>
                <span>·</span>
                <TrendingUp size={14} className="text-emerald-400" />
                <span>최고 밴드 <strong className="text-white">{cfg.maxBand}</strong></span>
                <span>·</span>
                <span>총 <strong className="text-white">{totalQCount}문제</strong></span>
              </div>
            )}
          </div>
        </div>

        {/* ── 스마트 빌더: 섹션 오버뷰 카드 4개 ── */}
        {cfg && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {sections.map(s => (
              <div key={s.key} className={`bg-white rounded-2xl border ${s.border} shadow-sm p-4 flex flex-col gap-3`}>
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center shadow-sm`}>
                  <s.icon size={17} className="text-white" />
                </div>
                <div>
                  <div className="text-2xl font-extrabold text-gray-900">{s.count}</div>
                  <div className={`text-xs font-bold ${s.text}`}>{s.label}</div>
                </div>
                {/* 미니 모듈 분포바 */}
                {s.key === 'reading' && cfg && (
                  <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden">
                    {(cfg.m1Ids?.length ?? 0) > 0 && <div className="bg-blue-400 rounded-l-full" style={{ flex: cfg.m1Ids.length }} />}
                    {(cfg.m2upIds?.length ?? 0) > 0 && <div className="bg-sky-300" style={{ flex: cfg.m2upIds.length }} />}
                    {(cfg.m2downIds?.length ?? 0) > 0 && <div className="bg-indigo-300 rounded-r-full" style={{ flex: cfg.m2downIds.length }} />}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── 메인 콘텐츠 ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* 왼쪽: 문제 구성 상세 */}
          <div className="lg:col-span-2 space-y-4">

            {cfg ? (
              <>
                {/* Reading */}
                {readCount > 0 && (
                  <div className="bg-white rounded-2xl border border-blue-100 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3.5 bg-blue-50/50 border-b border-blue-100">
                      <div className="flex items-center gap-2 font-bold text-blue-800 text-sm">
                        <BookOpen size={15} /> Reading
                      </div>
                      <span className="text-xs font-semibold text-blue-400">{readCount}문제</span>
                    </div>
                    {(cfg.m1Ids?.length ?? 0) > 0 && (
                      <div>
                        <div className="px-4 py-1.5 bg-blue-50/30 border-b border-blue-50">
                          <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wide">Module 1</span>
                          <span className="text-[11px] text-blue-400 ml-1">· {cfg.m1Ids.length}문제</span>
                        </div>
                        <SubGroup title="Complete the Words / Sentence Completion / Daily Life / Academic" ids={cfg.m1Ids} qById={qById} />
                      </div>
                    )}
                    {(cfg.m2upIds?.length ?? 0) > 0 && (
                      <div>
                        <div className="px-4 py-1.5 bg-sky-50/50 border-b border-blue-50">
                          <span className="text-[11px] font-bold text-sky-600 uppercase tracking-wide">Module 2 — 향상반</span>
                          <span className="text-[11px] text-sky-400 ml-1">· {cfg.m2upIds.length}문제</span>
                        </div>
                        <SubGroup title="" ids={cfg.m2upIds} qById={qById} />
                      </div>
                    )}
                    {(cfg.m2downIds?.length ?? 0) > 0 && (
                      <div>
                        <div className="px-4 py-1.5 bg-indigo-50/50 border-b border-blue-50">
                          <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wide">Module 2 — 보완반</span>
                          <span className="text-[11px] text-indigo-400 ml-1">· {cfg.m2downIds.length}문제</span>
                        </div>
                        <SubGroup title="" ids={cfg.m2downIds} qById={qById} />
                      </div>
                    )}
                  </div>
                )}

                {/* Listening */}
                {listenCount > 0 && (
                  <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3.5 bg-emerald-50/50 border-b border-emerald-100">
                      <div className="flex items-center gap-2 font-bold text-emerald-800 text-sm">
                        <Headphones size={15} /> Listening
                      </div>
                      <span className="text-xs font-semibold text-emerald-400">{listenCount}문제</span>
                    </div>
                    <ListeningModSection mod={cfg.listening_m1} label="Module 1" />
                    <ListeningModSection mod={cfg.listening_m2up} label="Module 2 — 향상반" />
                    <ListeningModSection mod={cfg.listening_m2down} label="Module 2 — 보완반" />
                  </div>
                )}

                {/* Writing */}
                {writeCount > 0 && (
                  <div className="bg-white rounded-2xl border border-purple-100 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3.5 bg-purple-50/50 border-b border-purple-100">
                      <div className="flex items-center gap-2 font-bold text-purple-800 text-sm">
                        <PenLine size={15} /> Writing
                      </div>
                      <span className="text-xs font-semibold text-purple-400">{writeCount}문제</span>
                    </div>
                    <SubGroup title="Build a Sentence" ids={cfg.writing?.reorderingIds ?? []} qById={qById} />
                    <SubGroup title="Write an Email" ids={cfg.writing?.emailIds ?? []} qById={qById} />
                  </div>
                )}

                {/* Speaking */}
                {speakCount > 0 && (
                  <div className="bg-white rounded-2xl border border-orange-100 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3.5 bg-orange-50/50 border-b border-orange-100">
                      <div className="flex items-center gap-2 font-bold text-orange-800 text-sm">
                        <Mic size={15} /> Speaking
                      </div>
                      <span className="text-xs font-semibold text-orange-400">{speakCount}문제</span>
                    </div>
                    <SubGroup title="Listen & Repeat" ids={cfg.speaking?.listenRepeatIds ?? []} qById={qById} />
                    <SubGroup title="Interview" ids={cfg.speaking?.interviewIds ?? []} qById={qById} />
                  </div>
                )}
              </>
            ) : (
              /* 일반 시험 */
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-50">
                  <h2 className="font-bold text-gray-900">문제 목록</h2>
                </div>
                <div className="divide-y divide-gray-50 max-h-[60vh] overflow-y-auto">
                  {(examQuestions ?? []).map((eq, i) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const q = eq.questions as any
                    return (
                      <div key={eq.id} className="flex items-start gap-3 px-5 py-3">
                        <span className="text-xs font-bold text-gray-300 flex-shrink-0 w-5 text-right">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-700 line-clamp-2">{q?.summary ?? q?.content}</p>
                          <span className="text-xs text-purple-500 mt-0.5 block">{SUBTYPE_LABEL[q?.question_subtype] ?? q?.category}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 오른쪽: 제출 현황 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm h-fit">
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
              <h2 className="font-bold text-gray-900">제출 현황</h2>
              {(submissions?.length ?? 0) > 0 && (
                <span className="text-xs font-bold text-gray-400">{submissions!.length}명</span>
              )}
            </div>
            <div className="divide-y divide-gray-50 max-h-[70vh] overflow-y-auto">
              {(submissions ?? []).length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">아직 제출자가 없어요</p>
              ) : (
                (submissions ?? []).map(sub => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const profile = sub.profiles as any
                  const pct = sub.percentage ?? 0
                  return (
                    <div key={sub.id} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{profile?.name ?? '알 수 없음'}</p>
                        <p className="text-xs text-gray-400">
                          {sub.submitted_at ? new Date(sub.submitted_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-100 rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full ${pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-blue-500' : 'bg-amber-400'}`}
                            style={{ width: `${pct}%` }} />
                        </div>
                        <span className={`text-sm font-bold w-9 text-right ${pct >= 80 ? 'text-emerald-600' : pct >= 60 ? 'text-blue-600' : 'text-amber-600'}`}>
                          {pct}%
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
