import { createClient, getUserFromCookie } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowLeft, Users, Clock, FileText, BarChart2, CheckCircle, BookOpen, Headphones, PenLine, Mic } from 'lucide-react'
import ExamActions from './ExamActions'

// ── 라벨 맵 ───────────────────────────────────────────
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

// ── 문제 요약 카드 ────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function QRow({ idx, q }: { idx: number; q: any }) {
  const label = SUBTYPE_LABEL[q.question_subtype] ?? q.question_subtype ?? q.category
  return (
    <div className="flex items-start gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-xs font-bold text-gray-300 flex-shrink-0 w-5 text-right mt-0.5">{idx}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-700 line-clamp-2">{q.content}</p>
        <span className="text-[11px] text-indigo-400 mt-0.5 block">{label}</span>
      </div>
      {q.difficulty && (
        <span className={`text-[11px] font-semibold flex-shrink-0 px-1.5 py-0.5 rounded-full ${
          q.difficulty === 'hard'   ? 'bg-rose-50 text-rose-500' :
          q.difficulty === 'medium' ? 'bg-amber-50 text-amber-600' :
                                      'bg-emerald-50 text-emerald-600'
        }`}>{q.difficulty === 'hard' ? '상' : q.difficulty === 'medium' ? '중' : '하'}</span>
      )}
    </div>
  )
}

// ── 섹션 헤더 ─────────────────────────────────────────
function SectionHeader({ icon, title, count, color }: {
  icon: React.ReactNode; title: string; count: number; color: string
}) {
  return (
    <div className={`flex items-center justify-between px-5 py-3.5 border-b ${color}`}>
      <div className="flex items-center gap-2 font-bold text-sm">
        {icon}
        {title}
      </div>
      <span className="text-xs font-semibold text-gray-400">{count}문제</span>
    </div>
  )
}

// ── 모듈 뱃지 ─────────────────────────────────────────
function ModBadge({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${color}`}>
      {label} <span className="opacity-70">{count}문</span>
    </span>
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
    .select('id, student_id, score, total_points, percentage, status, submitted_at, profiles(name)')
    .eq('exam_id', examId)
    .order('submitted_at', { ascending: false })

  const avgPct = submissions && submissions.length > 0
    ? Math.round(submissions.reduce((acc, s) => acc + (s.percentage ?? 0), 0) / submissions.length)
    : null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cls = exam.classes as any

  // ── Adaptive (스마트 빌더) 시험 처리 ─────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let adaptiveConfig: any = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let qById: Record<string, any> = {}

  if (exam.description) {
    try {
      const cfg = JSON.parse(exam.description)
      if (cfg.adaptive) {
        adaptiveConfig = cfg

        // 모든 개별 문제 ID 수집
        const allIds = new Set<string>()
        const addIds = (ids: string[]) => ids.forEach(id => allIds.add(id))

        addIds(cfg.m1Ids ?? [])
        addIds(cfg.m2upIds ?? [])
        addIds(cfg.m2downIds ?? [])

        for (const mod of [cfg.listening_m1, cfg.listening_m2up, cfg.listening_m2down]) {
          if (!mod) continue
          addIds(mod.response ?? [])
          for (const s of [...(mod.conversation ?? []), ...(mod.academicTalk ?? [])]) {
            addIds(s.questionIds ?? [])
          }
        }
        addIds(cfg.writing?.reorderingIds ?? [])
        addIds(cfg.writing?.emailIds ?? [])
        addIds(cfg.speaking?.listenRepeatIds ?? [])
        addIds(cfg.speaking?.interviewIds ?? [])

        if (allIds.size > 0) {
          const { data: qs } = await supabase
            .from('questions')
            .select('id, content, category, question_subtype, difficulty')
            .in('id', [...allIds])
          for (const q of qs ?? []) qById[q.id] = q
        }
      }
    } catch { /* ignore */ }
  }

  // ── 일반 시험 문제 목록 ───────────────────────────────
  let examQuestions = null
  let totalQCount = 0

  if (!adaptiveConfig) {
    const { data: eq } = await supabase
      .from('exam_questions')
      .select('*, questions(content, category, type, difficulty)')
      .eq('exam_id', examId)
      .order('order_num')
    examQuestions = eq
    totalQCount = eq?.length ?? 0
  } else {
    // adaptive 전체 문제 수 계산
    let t = 0
    t += (adaptiveConfig.m1Ids ?? []).length + (adaptiveConfig.m2upIds ?? []).length + (adaptiveConfig.m2downIds ?? []).length
    for (const mod of [adaptiveConfig.listening_m1, adaptiveConfig.listening_m2up, adaptiveConfig.listening_m2down]) {
      if (!mod) continue
      t += (mod.response ?? []).length
      for (const s of [...(mod.conversation ?? []), ...(mod.academicTalk ?? [])]) t += (s.questionIds ?? []).length
    }
    t += (adaptiveConfig.writing?.reorderingIds ?? []).length + (adaptiveConfig.writing?.emailIds ?? []).length
    t += (adaptiveConfig.speaking?.listenRepeatIds ?? []).length + (adaptiveConfig.speaking?.interviewIds ?? []).length
    totalQCount = t
  }

  // ── Listening 모듈 렌더 헬퍼 ─────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function renderListeningMod(mod: any, label: string, idxOffset: number) {
    if (!mod) return null
    const respIds: string[] = mod.response ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const convSets: any[] = mod.conversation ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const talkSets: any[] = mod.academicTalk ?? []
    const total = respIds.length + convSets.reduce((a: number, s: any) => a + s.questionIds.length, 0) + talkSets.reduce((a: number, s: any) => a + s.questionIds.length, 0)
    if (total === 0) return null

    let idx = idxOffset
    return (
      <div className="mb-4 last:mb-0">
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50/60">
          <ModBadge label={label} count={total} color="bg-emerald-100 text-emerald-700" />
        </div>
        {respIds.length > 0 && (
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase px-4 py-1.5 bg-gray-50">
              Choose a Response ({respIds.length})
            </p>
            {respIds.map(id => <QRow key={id} idx={idx++} q={qById[id] ?? { content: id, question_subtype: 'choose_response' }} />)}
          </div>
        )}
        {convSets.map((s, si) => (
          <div key={si}>
            <p className="text-[11px] font-bold text-gray-400 uppercase px-4 py-1.5 bg-gray-50">
              Conversation Set {si + 1} ({s.questionIds.length}문제)
            </p>
            {s.questionIds.map((id: string) => <QRow key={id} idx={idx++} q={qById[id] ?? { content: id, question_subtype: 'conversation' }} />)}
          </div>
        ))}
        {talkSets.map((s, si) => (
          <div key={si}>
            <p className="text-[11px] font-bold text-gray-400 uppercase px-4 py-1.5 bg-gray-50">
              Academic Talk Set {si + 1} ({s.questionIds.length}문제)
            </p>
            {s.questionIds.map((id: string) => <QRow key={id} idx={idx++} q={qById[id] ?? { content: id, question_subtype: 'academic_talk' }} />)}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="p-4 md:p-7 max-w-5xl">
      {/* 헤더 */}
      <div className="mb-6">
        <Link href="/teacher/exams" className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-4">
          <ArrowLeft size={14} /> 시험 목록
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-extrabold text-gray-900">{exam.title}</h1>
              {adaptiveConfig && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">스마트 빌더</span>
              )}
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-500">
              {cls && <span>{cls.name}</span>}
              {exam.time_limit && (
                <span className="flex items-center gap-1"><Clock size={13} />{exam.time_limit}분</span>
              )}
              <span className="flex items-center gap-1"><FileText size={13} />{totalQCount}문제</span>
            </div>
          </div>
          <ExamActions examId={examId} currentStatus={exam.status} />
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: '제출자', value: `${submissions?.length ?? 0}명`, icon: Users, color: 'text-blue-600' },
          { label: '평균 점수', value: avgPct !== null ? `${avgPct}%` : '—', icon: BarChart2, color: avgPct !== null && avgPct >= 60 ? 'text-emerald-600' : 'text-amber-500' },
          { label: '총 문제', value: `${totalQCount}문제`, icon: CheckCircle, color: 'text-purple-600' },
          { label: '상태', value: exam.status === 'published' ? '진행중' : exam.status === 'draft' ? '초안' : '종료', icon: FileText, color: exam.status === 'published' ? 'text-blue-600' : 'text-gray-500' },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
            <card.icon size={20} className={`mx-auto mb-1.5 ${card.color}`} />
            <div className={`text-xl font-black ${card.color}`}>{card.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ── 왼쪽: 문제 구성 (2/3) ── */}
        <div className="lg:col-span-2 space-y-4">

          {adaptiveConfig ? (
            <>
              {/* Reading */}
              {(() => {
                const m1 = adaptiveConfig.m1Ids ?? []
                const m2up = adaptiveConfig.m2upIds ?? []
                const m2down = adaptiveConfig.m2downIds ?? []
                const total = m1.length + m2up.length + m2down.length
                if (total === 0) return null
                let idx = 1
                return (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <SectionHeader
                      icon={<BookOpen size={15} className="text-blue-600" />}
                      title="Reading"
                      count={total}
                      color="border-blue-100 bg-blue-50/40"
                    />
                    {m1.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50/30">
                          <ModBadge label="Module 1" count={m1.length} color="bg-blue-100 text-blue-700" />
                        </div>
                        {m1.map((id: string) => <QRow key={id} idx={idx++} q={qById[id] ?? { content: id, question_subtype: '' }} />)}
                      </div>
                    )}
                    {m2up.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50/30">
                          <ModBadge label="Module 2 (향상)" count={m2up.length} color="bg-sky-100 text-sky-700" />
                        </div>
                        {m2up.map((id: string) => <QRow key={id} idx={idx++} q={qById[id] ?? { content: id, question_subtype: '' }} />)}
                      </div>
                    )}
                    {m2down.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50/30">
                          <ModBadge label="Module 2 (보완)" count={m2down.length} color="bg-indigo-100 text-indigo-700" />
                        </div>
                        {m2down.map((id: string) => <QRow key={id} idx={idx++} q={qById[id] ?? { content: id, question_subtype: '' }} />)}
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Listening */}
              {(() => {
                const lm1 = adaptiveConfig.listening_m1
                const lm2up = adaptiveConfig.listening_m2up
                const lm2down = adaptiveConfig.listening_m2down
                const calcMod = (mod: any) => {
                  if (!mod) return 0
                  return (mod.response?.length ?? 0) +
                    (mod.conversation ?? []).reduce((a: number, s: any) => a + s.questionIds.length, 0) +
                    (mod.academicTalk ?? []).reduce((a: number, s: any) => a + s.questionIds.length, 0)
                }
                const total = calcMod(lm1) + calcMod(lm2up) + calcMod(lm2down)
                if (total === 0) return null
                // idx: we start at reading total + 1
                const readStart = (adaptiveConfig.m1Ids?.length ?? 0) + (adaptiveConfig.m2upIds?.length ?? 0) + (adaptiveConfig.m2downIds?.length ?? 0) + 1
                let lIdx = readStart
                return (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <SectionHeader
                      icon={<Headphones size={15} className="text-emerald-600" />}
                      title="Listening"
                      count={total}
                      color="border-emerald-100 bg-emerald-50/40"
                    />
                    {lm1 && calcMod(lm1) > 0 && renderListeningMod(lm1, 'Module 1', lIdx)}
                    {lm2up && calcMod(lm2up) > 0 && renderListeningMod(lm2up, 'Module 2 (향상)', lIdx + calcMod(lm1))}
                    {lm2down && calcMod(lm2down) > 0 && renderListeningMod(lm2down, 'Module 2 (보완)', lIdx + calcMod(lm1) + calcMod(lm2up))}
                  </div>
                )
              })()}

              {/* Writing */}
              {(() => {
                const reordering = adaptiveConfig.writing?.reorderingIds ?? []
                const email = adaptiveConfig.writing?.emailIds ?? []
                const total = reordering.length + email.length
                if (total === 0) return null
                let idx = 1
                return (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <SectionHeader
                      icon={<PenLine size={15} className="text-purple-600" />}
                      title="Writing"
                      count={total}
                      color="border-purple-100 bg-purple-50/40"
                    />
                    {reordering.length > 0 && (
                      <div>
                        <p className="text-[11px] font-bold text-gray-400 uppercase px-4 py-1.5 bg-gray-50">
                          Build a Sentence ({reordering.length})
                        </p>
                        {reordering.map((id: string) => <QRow key={id} idx={idx++} q={qById[id] ?? { content: id, question_subtype: 'sentence_reordering' }} />)}
                      </div>
                    )}
                    {email.length > 0 && (
                      <div>
                        <p className="text-[11px] font-bold text-gray-400 uppercase px-4 py-1.5 bg-gray-50">
                          Write an Email ({email.length})
                        </p>
                        {email.map((id: string) => <QRow key={id} idx={idx++} q={qById[id] ?? { content: id, question_subtype: 'email_writing' }} />)}
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Speaking */}
              {(() => {
                const lr = adaptiveConfig.speaking?.listenRepeatIds ?? []
                const iv = adaptiveConfig.speaking?.interviewIds ?? []
                const total = lr.length + iv.length
                if (total === 0) return null
                let idx = 1
                return (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <SectionHeader
                      icon={<Mic size={15} className="text-orange-500" />}
                      title="Speaking"
                      count={total}
                      color="border-orange-100 bg-orange-50/40"
                    />
                    {lr.length > 0 && (
                      <div>
                        <p className="text-[11px] font-bold text-gray-400 uppercase px-4 py-1.5 bg-gray-50">
                          Listen & Repeat ({lr.length})
                        </p>
                        {lr.map((id: string) => <QRow key={id} idx={idx++} q={qById[id] ?? { content: id, question_subtype: 'listen_and_repeat' }} />)}
                      </div>
                    )}
                    {iv.length > 0 && (
                      <div>
                        <p className="text-[11px] font-bold text-gray-400 uppercase px-4 py-1.5 bg-gray-50">
                          Interview ({iv.length})
                        </p>
                        {iv.map((id: string) => <QRow key={id} idx={idx++} q={qById[id] ?? { content: id, question_subtype: 'take_an_interview' }} />)}
                      </div>
                    )}
                  </div>
                )
              })()}
            </>
          ) : (
            /* 일반 시험 문제 목록 */
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
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
                        <p className="text-sm text-gray-700 line-clamp-2">{q?.content}</p>
                        <span className="text-xs text-purple-500 mt-0.5 block">{q?.category}</span>
                      </div>
                      <span className="text-xs text-gray-400 flex-shrink-0">{eq.points}점</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── 오른쪽: 제출 현황 ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm h-fit">
          <div className="px-5 py-4 border-b border-gray-50">
            <h2 className="font-bold text-gray-900">제출 현황</h2>
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
                      <div className="w-20 bg-gray-100 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full ${pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-blue-500' : 'bg-amber-400'}`}
                          style={{ width: `${pct}%` }} />
                      </div>
                      <span className={`text-sm font-bold w-10 text-right ${pct >= 80 ? 'text-emerald-600' : pct >= 60 ? 'text-blue-600' : 'text-amber-600'}`}>
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
  )
}
