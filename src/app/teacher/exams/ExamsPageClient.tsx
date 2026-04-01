'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, Clock, Users, FileText, ChevronRight, X, Loader2, CalendarDays, Timer, BookOpen, Trash2, Bell, CheckCircle2, ArrowRight } from 'lucide-react'
import { deployExam, deleteDeployment, deleteExam, sendEncouragement, updateDeploymentStatus } from './actions'
import { createClient } from '@/lib/supabase/client'

// ── 타입 ──────────────────────────────────────────────────────────

interface ExamDraft {
  id: string
  title: string
  description: string | null
  time_limit: number | null
  created_at: string
  qCount: number
  calculated_time_mins: number | null
}

interface Deployment {
  id: string
  exam_id: string
  exam_title: string
  class_id: string
  class_name: string
  start_at: string
  end_at: string
  time_limit_mins: number | null
  status: string
  totalStudents: number
  submittedCount: number
}

interface ClassOption {
  id: string
  name: string
}

interface Props {
  drafts: ExamDraft[]
  active: Deployment[]
  grading: Deployment[]
  completed: Deployment[]
  classes: ClassOption[]
}

// ── D-Day 계산 ────────────────────────────────────────────────────

function getDDay(endAt: string): string {
  const diff = Math.ceil((new Date(endAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (diff < 0) return '마감됨'
  if (diff === 0) return 'D-Day'
  return `D-${diff}`
}

// ── 배포 카드 ─────────────────────────────────────────────────────

function DeploymentCard({ dep, onDelete, onClick }: { dep: Deployment; onDelete: (id: string) => void; onClick: () => void }) {
  const pct = dep.totalStudents > 0
    ? Math.round((dep.submittedCount / dep.totalStudents) * 100) : 0
  const dday = getDDay(dep.end_at)
  const isUrgent = dday === 'D-Day' || dday === 'D-1'
  const [deleting, setDeleting] = useState(false)

  const statusColors: Record<string, string> = {
    scheduled: 'bg-amber-50 border-amber-200',
    active:    'bg-blue-50 border-blue-200',
    grading:   'bg-purple-50 border-purple-200',
    completed: 'bg-emerald-50 border-emerald-200',
  }

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`"${dep.exam_title}" 배포를 삭제하시겠습니까?\n(학생 제출 기록은 유지됩니다)`)) return
    setDeleting(true)
    try {
      await deleteDeployment(dep.id)
      onDelete(dep.id)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div onClick={onClick}
      className={`block rounded-xl border shadow-sm hover:shadow-md transition p-3 md:p-5 group cursor-pointer ${statusColors[dep.status] ?? 'bg-white border-gray-100'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex-1 min-w-0 pr-2">
          <p className="text-[10px] font-bold text-gray-400 leading-none mb-0.5">{dep.class_name}</p>
          <h3 className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition truncate">{dep.exam_title}</h3>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-lg ${
            isUrgent ? 'bg-red-500 text-white' : 'bg-white/80 text-gray-600'
          }`}>
            {dday}
          </span>
          <button onClick={handleDelete} disabled={deleting}
            className="w-6 h-6 flex items-center justify-center rounded-lg bg-white/80 hover:bg-red-100 text-gray-400 hover:text-red-500 transition disabled:opacity-40">
            {deleting ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
          </button>
        </div>
      </div>

      {/* 응시율 프로그레스 바 */}
      <div className="mb-2">
        <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
          <span className="flex items-center gap-0.5">
            <Users size={10} />
            {dep.submittedCount}/{dep.totalStudents}명 응시
          </span>
          <span className="font-bold text-gray-700">{pct}%</span>
        </div>
        <div className="h-1.5 bg-white/60 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-blue-500' : 'bg-amber-400'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-gray-400">
        {dep.time_limit_mins && (
          <span className="flex items-center gap-0.5"><Timer size={10} />{dep.time_limit_mins}분</span>
        )}
        <span className="flex items-center gap-0.5">
          <CalendarDays size={10} />
          {new Date(dep.end_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} 마감
        </span>
        <ChevronRight size={12} className="ml-auto text-gray-300 group-hover:text-blue-400 transition" />
      </div>
    </div>
  )
}

// ── 배포 상세 모달 ────────────────────────────────────────────────

function DeploymentModal({ dep, onClose, onCompleted }: { dep: Deployment; onClose: () => void; onCompleted?: (id: string) => void }) {
  const supabase = createClient()
  const [students, setStudents] = useState<{ id: string; name: string; email: string }[]>([])
  const [submissions, setSubmissions] = useState<{
    student_id: string; submitted_at: string | null
    score: number | null; total_points: number | null; percentage: number | null; status: string
  }[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'pending' | 'submitted'>('pending')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [pendingWriting, setPendingWriting] = useState(0)
  const [pendingSpeaking, setPendingSpeaking] = useState(0)

  useEffect(() => {
    async function load() {
      const [{ data: members }, { data: subs }] = await Promise.all([
        supabase.from('class_members').select('student_id, profiles(id, name, email)').eq('class_id', dep.class_id),
        supabase.from('submissions').select('student_id, submitted_at, score, total_points, percentage, status').eq('deployment_id', dep.id),
      ])

      // 채점 대기 현황 조회 (submission IDs 재사용)
      if (subs && subs.length > 0) {
        const submissionIds = await supabase
          .from('submissions').select('id').eq('deployment_id', dep.id)
        const ids = (submissionIds.data ?? []).map((s: { id: string }) => s.id)
        if (ids.length > 0) {
          const [{ count: wCount }, { count: sCount }] = await Promise.all([
            supabase.from('submission_answers')
              .select('*, questions!inner(type, category)', { count: 'exact', head: true })
              .in('submission_id', ids).is('is_correct', null)
              .in('questions.type', ['essay', 'short_answer'])
              .neq('questions.category', 'speaking'),
            supabase.from('submission_answers')
              .select('*, questions!inner(category)', { count: 'exact', head: true })
              .in('submission_id', ids).is('is_correct', null)
              .eq('questions.category', 'speaking'),
          ])
          setPendingWriting(wCount ?? 0)
          setPendingSpeaking(sCount ?? 0)
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setStudents((members ?? []).map((m: any) => ({ id: m.profiles?.id ?? m.student_id, name: m.profiles?.name ?? '알 수 없음', email: m.profiles?.email ?? '' })))
      setSubmissions(subs ?? [])
      setLoading(false)
    }
    load()
  }, [dep.id])

  const subMap = Object.fromEntries(submissions.map(s => [s.student_id, s]))
  const submitted = students.filter(s => { const sub = subMap[s.id]; return sub && (sub.status === 'submitted' || sub.status === 'graded') })
  const pending = students.filter(s => !subMap[s.id] || subMap[s.id].status === 'in_progress')
  const pct = students.length > 0 ? Math.round((submitted.length / students.length) * 100) : 0
  const avgScore = submitted.length > 0
    ? Math.round(submitted.reduce((a, s) => a + (subMap[s.id]?.percentage ?? 0), 0) / submitted.length) : null
  const dday = getDDay(dep.end_at)
  const isActive = dep.status === 'active' || dep.status === 'scheduled'
  const isGrading = dep.status === 'grading'

  async function handleEncourage() {
    setSending(true)
    try { await sendEncouragement(dep.id, pending.map(s => s.id)) } finally { setSending(false) }
    setDone(true); setTimeout(() => setDone(false), 3000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-t-2xl md:rounded-2xl w-full md:max-w-lg max-h-[88vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between rounded-t-2xl z-10">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-blue-600">{dep.class_name}</p>
            <h3 className="font-extrabold text-gray-900 truncate">{dep.exam_title}</h3>
            <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-0.5 flex-wrap">
              <span>{new Date(dep.start_at).toLocaleDateString('ko-KR')} ~ {new Date(dep.end_at).toLocaleDateString('ko-KR')}</span>
              {dep.time_limit_mins && <span><Clock size={10} className="inline mr-0.5" />{dep.time_limit_mins}분</span>}
              <span className={`font-bold ${dday === '마감됨' ? 'text-gray-400' : dday === 'D-Day' || dday === 'D-1' ? 'text-red-500' : 'text-blue-600'}`}>{dday}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
            {isGrading && (
              <>
                <Link href={`/teacher/deployments/${dep.id}/grading`}
                  className="text-[11px] font-bold px-2 py-1 bg-purple-100 text-purple-700 rounded-lg">
                  채점 →
                </Link>
                <button onClick={async () => {
                    setCompleting(true)
                    await updateDeploymentStatus(dep.id, 'completed')
                    setCompleting(false)
                    onCompleted?.(dep.id)
                    onClose()
                  }}
                  disabled={completing}
                  className="text-[11px] font-bold px-2 py-1 bg-emerald-600 text-white rounded-lg flex items-center gap-0.5">
                  {completing ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle2 size={10} />} 확정
                </button>
              </>
            )}
            <Link href={`/teacher/exams/${dep.exam_id}`}
              className="text-[11px] font-bold px-2 py-1 border border-gray-200 rounded-lg flex items-center gap-0.5 text-gray-600">
              문제 <ArrowRight size={10} />
            </Link>
            <button onClick={onClose} className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition">
              <X size={13} />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {/* 요약 카드 */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
              <p className="text-2xl font-extrabold text-gray-900">{loading ? '—' : students.length}</p>
              <p className="text-[11px] text-gray-400">총 학생</p>
            </div>
            <div className="bg-blue-50 rounded-xl border border-blue-100 p-3 text-center">
              <p className="text-2xl font-extrabold text-blue-700">{loading ? '—' : submitted.length}</p>
              <p className="text-[11px] text-blue-400">응시 완료</p>
            </div>
            <div className={`rounded-xl border p-3 text-center ${!loading && pending.length === 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
              <p className={`text-2xl font-extrabold ${!loading && pending.length === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>{loading ? '—' : pending.length}</p>
              <p className={`text-[11px] ${!loading && pending.length === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>미응시</p>
            </div>
          </div>

          {/* 응시율 바 */}
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-600">전체 응시율</span>
              <span className="text-lg font-extrabold text-gray-900">{pct}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-blue-500' : 'bg-amber-400'}`}
                style={{ width: `${pct}%` }} />
            </div>
            {avgScore !== null && <p className="text-[11px] text-gray-400 mt-1.5 text-right">가채점 평균 {avgScore}%</p>}
          </div>

          {/* 학생 명단 */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
              <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
                <button onClick={() => setTab('pending')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition ${tab === 'pending' ? 'bg-white shadow-sm text-amber-600' : 'text-gray-500'}`}>
                  미응시 {!loading && <span className="font-bold">{pending.length}</span>}
                </button>
                <button onClick={() => setTab('submitted')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition ${tab === 'submitted' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}>
                  응시 완료 {!loading && <span className="font-bold">{submitted.length}</span>}
                </button>
              </div>
              {tab === 'pending' && !loading && pending.length > 0 && isActive && (
                <button onClick={handleEncourage} disabled={sending || done}
                  className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg transition ${done ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'} disabled:opacity-60`}>
                  {sending ? <Loader2 size={10} className="animate-spin" /> : <Bell size={10} />}
                  {done ? '발송 완료!' : `${pending.length}명 독려`}
                </button>
              )}
            </div>

            {loading ? (
              <div className="py-8 flex justify-center"><Loader2 size={18} className="animate-spin text-gray-300" /></div>
            ) : tab === 'pending' ? (
              pending.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">🎉 모든 학생이 응시했어요!</p>
              ) : pending.map((s, i) => (
                <div key={s.id} className={`flex items-center px-4 py-2.5 ${i > 0 ? 'border-t border-gray-50' : ''}`}>
                  <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-xs font-bold text-amber-600 flex-shrink-0 mr-2.5">{s.name[0]}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{s.name}</p>
                    <p className="text-[11px] text-gray-400 truncate">{s.email}</p>
                  </div>
                  <span className="text-[11px] text-amber-500 font-semibold bg-amber-50 px-1.5 py-0.5 rounded-full">미응시</span>
                </div>
              ))
            ) : (
              submitted.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">아직 응시한 학생이 없어요</p>
              ) : submitted.map((s, i) => {
                const sub = subMap[s.id]
                return (
                  <div key={s.id} className={`flex items-center px-4 py-2.5 ${i > 0 ? 'border-t border-gray-50' : ''}`}>
                    <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600 flex-shrink-0 mr-2.5">{s.name[0]}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{s.name}</p>
                      <p className="text-[11px] text-gray-400">{sub?.submitted_at ? new Date(sub.submitted_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</p>
                    </div>
                    {sub?.percentage != null ? (
                      <div className="text-right flex-shrink-0">
                        <p className={`text-sm font-bold ${sub.percentage >= 80 ? 'text-emerald-600' : sub.percentage >= 60 ? 'text-blue-600' : 'text-amber-600'}`}>{sub.percentage}%</p>
                        {sub.score != null && sub.total_points != null && <p className="text-[11px] text-gray-400">{sub.score}/{sub.total_points}점</p>}
                      </div>
                    ) : (
                      <span className="text-[11px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">채점 대기</span>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* 채점 대기 현황 */}
        {!loading && (pendingWriting > 0 || pendingSpeaking > 0) && (
          <Link href="/teacher/grading"
            className="flex items-center gap-3 bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 hover:bg-purple-100 transition">
            <div className="flex-1">
              <p className="text-xs font-bold text-purple-700 mb-1">✏️ 채점 대기 중</p>
              <div className="flex gap-3 text-[11px]">
                {pendingWriting > 0 && (
                  <span className="bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full">
                    Writing {pendingWriting}개
                  </span>
                )}
                {pendingSpeaking > 0 && (
                  <span className="bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full">
                    Speaking {pendingSpeaking}개
                  </span>
                )}
              </div>
            </div>
            <ArrowRight size={14} className="text-purple-400 flex-shrink-0" />
          </Link>
        )}
      </div>
    </div>
  )
}

// ── 초안 카드 ─────────────────────────────────────────────────────

function DraftCard({ exam, onDeploy, onDeleted }: {
  exam: ExamDraft
  onDeploy: (exam: ExamDraft) => void
  onDeleted: (id: string) => void
}) {
  const [deleting, setDeleting] = useState(false)

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    if (!confirm(`"${exam.title}" 초안을 삭제하시겠습니까?\n삭제 후 복구할 수 없습니다.`)) return
    setDeleting(true)
    try {
      await deleteExam(exam.id)
      onDeleted(exam.id)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 md:p-5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex-1 min-w-0 pr-2">
          <h3 className="text-sm font-bold text-gray-900 truncate">{exam.title}</h3>
          <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-0.5">
            <span className="flex items-center gap-0.5"><FileText size={10} />{exam.qCount}문제</span>
            {exam.time_limit && <span className="flex items-center gap-0.5"><Clock size={10} />{exam.time_limit}분</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-gray-400" />초안
          </span>
          <button onClick={handleDelete} disabled={deleting}
            className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-red-100 text-gray-300 hover:text-red-500 transition disabled:opacity-40">
            {deleting ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
          </button>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <Link href={`/teacher/exams/${exam.id}`}
          className="flex-1 text-center text-xs font-semibold px-2 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition">
          문제 보기
        </Link>
        <button onClick={() => onDeploy(exam)}
          className="flex-1 text-center text-xs font-bold px-2 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition flex items-center justify-center gap-1">
          <Plus size={11} /> 출제하기
        </button>
      </div>
    </div>
  )
}

// ── 배포 모달 ─────────────────────────────────────────────────────

function DeployModal({ exam, classes, onClose }: {
  exam: ExamDraft
  classes: ClassOption[]
  onClose: () => void
}) {
  const [classId, setClassId] = useState(classes[0]?.id ?? '')
  const [startAt, setStartAt] = useState(() => {
    const d = new Date(); d.setMinutes(0, 0, 0)
    return d.toISOString().slice(0, 16)
  })
  const [endAt, setEndAt] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 7); d.setHours(23, 59, 0, 0)
    return d.toISOString().slice(0, 16)
  })
  const [timeLimitMins, setTimeLimitMins] = useState<string>(
    exam.time_limit ? String(exam.time_limit)
    : exam.calculated_time_mins ? String(exam.calculated_time_mins)
    : ''
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!classId) { setError('반을 선택해주세요'); return }
    if (!startAt || !endAt) { setError('기간을 설정해주세요'); return }
    if (new Date(endAt) <= new Date(startAt)) { setError('종료일은 시작일보다 이후여야 해요'); return }

    setLoading(true)
    setError('')
    try {
      await deployExam({
        examId: exam.id,
        classId,
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        timeLimitMins: timeLimitMins ? parseInt(timeLimitMins) : null,
      })
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900">시험 출제하기</h3>
            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{exam.title}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition">
            <X size={14} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* 반 선택 */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1.5">대상 반</label>
            {classes.length === 0 ? (
              <p className="text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                반이 없어요. 먼저 반을 만들어주세요.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {classes.map(cls => (
                  <button key={cls.id} type="button"
                    onClick={() => setClassId(cls.id)}
                    className={`text-sm font-semibold px-3 py-2.5 rounded-xl border transition ${
                      classId === cls.id
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'
                    }`}>
                    {cls.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 기간 */}
          <div className="space-y-2">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1.5">시작일시</label>
              <input type="datetime-local" value={startAt} onChange={e => setStartAt(e.target.value)}
                step="60"
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-blue-400 transition" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1.5">종료일시</label>
              <input type="datetime-local" value={endAt} onChange={e => setEndAt(e.target.value)}
                step="60"
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-blue-400 transition" />
            </div>
          </div>

          {/* 제한시간 */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1.5">
              응시 제한시간 (분)
            </label>
            <input type="number" min="1" max="300" value={timeLimitMins}
              onChange={e => setTimeLimitMins(e.target.value)}
              placeholder="예: 120"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-blue-400 transition" />
          </div>

          {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <button type="submit" disabled={loading || classes.length === 0}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold transition">
            {loading ? <><Loader2 size={14} className="animate-spin" />배포 중...</> : '📢 출제하기'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── 메인 클라이언트 컴포넌트 ──────────────────────────────────────

type TabKey = 'draft' | 'active' | 'grading' | 'completed'

export default function ExamsPageClient({ drafts, active, grading, completed, classes }: Props) {
  const [tab, setTab] = useState<TabKey>(active.length > 0 ? 'active' : 'draft')
  const [filterClass, setFilterClass] = useState<string>('all')
  const [deployTarget, setDeployTarget] = useState<ExamDraft | null>(null)
  const [selectedDep, setSelectedDep] = useState<Deployment | null>(null)
  const [localDrafts, setLocalDrafts] = useState(drafts)
  const [localActive, setLocalActive] = useState(active)
  const [localGrading, setLocalGrading] = useState(grading)
  const [localCompleted, setLocalCompleted] = useState(completed)

  // 서버 재렌더링 후 새 props 반영
  useEffect(() => { setLocalActive(active) }, [active])
  useEffect(() => { setLocalGrading(grading) }, [grading])
  useEffect(() => { setLocalCompleted(completed) }, [completed])

  function handleDelete(id: string) {
    setLocalActive(prev => prev.filter(d => d.id !== id))
    setLocalGrading(prev => prev.filter(d => d.id !== id))
    setLocalCompleted(prev => prev.filter(d => d.id !== id))
  }

  const tabs: { key: TabKey; label: string; short: string; count: number; color: string }[] = [
    { key: 'draft',     label: '초안',      short: '초안', count: localDrafts.length,   color: 'text-gray-600' },
    { key: 'active',    label: '진행 중',   short: '진행', count: localActive.length,   color: 'text-blue-600' },
    { key: 'grading',   label: '채점 대기', short: '채점', count: localGrading.length,  color: 'text-purple-600' },
    { key: 'completed', label: '완료',      short: '완료', count: localCompleted.length, color: 'text-emerald-600' },
  ]

  const deploymentsByTab: Record<TabKey, Deployment[]> = {
    draft: [], active: localActive, grading: localGrading, completed: localCompleted
  }

  const filteredDeployments = (deploymentsByTab[tab] ?? []).filter(d =>
    filterClass === 'all' || d.class_id === filterClass
  )

  return (
    <div className="p-3 md:p-7">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-3 md:mb-6">
        <div>
          <h1 className="text-lg md:text-2xl font-extrabold text-gray-900">📝 시험 관리</h1>
          <p className="text-gray-500 text-xs md:text-sm mt-0.5">
            초안 {localDrafts.length} · 진행 중 {active.length} · 채점 대기 {grading.length}
          </p>
        </div>
        <Link href="/teacher/exams/smart"
          className="flex items-center gap-1.5 px-3 py-2 md:px-4 md:py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs md:text-sm font-bold transition shadow-sm">
          <Plus size={14} />
          <span className="hidden md:inline">새 시험 만들기</span>
          <span className="md:hidden">새 시험</span>
        </Link>
      </div>

      {/* 탭 + 필터 */}
      <div className="flex items-center justify-between mb-3 md:mb-5 gap-2">
        <div className="flex gap-0.5 md:gap-1 bg-gray-100 rounded-xl p-1 flex-1 md:flex-none">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1 md:gap-1.5 px-2 md:px-3.5 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-semibold transition whitespace-nowrap flex-1 md:flex-none justify-center ${
                tab === t.key
                  ? 'bg-white shadow-sm text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}>
              <span className="md:hidden">{t.short}</span>
              <span className="hidden md:inline">{t.label}</span>
              <span className={`text-[10px] md:text-xs font-bold px-1 md:px-1.5 py-0.5 rounded-full ${
                tab === t.key ? `bg-gray-100 ${t.color}` : 'bg-gray-200 text-gray-500'
              }`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* 반별 필터 (초안 탭 제외) */}
        {tab !== 'draft' && classes.length > 0 && (
          <select value={filterClass} onChange={e => setFilterClass(e.target.value)}
            className="text-xs md:text-sm border border-gray-200 rounded-xl px-2 md:px-3 py-1.5 md:py-2 outline-none focus:border-blue-400 bg-white flex-shrink-0">
            <option value="all">전체 반</option>
            {classes.map(cls => (
              <option key={cls.id} value={cls.id}>{cls.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* 콘텐츠 */}
      {tab === 'draft' ? (
        localDrafts.length === 0 ? (
          <Empty />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {localDrafts.map(exam => (
              <DraftCard key={exam.id} exam={exam} onDeploy={setDeployTarget}
                onDeleted={id => setLocalDrafts(prev => prev.filter(d => d.id !== id))} />
            ))}
          </div>
        )
      ) : (
        filteredDeployments.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <p className="text-gray-400 font-medium">
              {tab === 'active' ? '진행 중인 시험이 없어요' :
               tab === 'grading' ? '채점 대기 중인 시험이 없어요' : '완료된 시험이 없어요'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredDeployments.map(dep => (
              <DeploymentCard key={dep.id} dep={dep} onDelete={handleDelete} onClick={() => setSelectedDep(dep)} />
            ))}
          </div>
        )
      )}

      {/* 배포 상세 플로팅 모달 */}
      {selectedDep && (
        <DeploymentModal
          dep={selectedDep}
          onClose={() => setSelectedDep(null)}
          onCompleted={(id) => {
            const dep = localGrading.find(d => d.id === id) ?? localActive.find(d => d.id === id)
            if (dep) setLocalCompleted(prev => [{ ...dep, status: 'completed' }, ...prev])
            setLocalGrading(prev => prev.filter(d => d.id !== id))
            setLocalActive(prev => prev.filter(d => d.id !== id))
            setTab('completed')
          }}
        />
      )}

      {/* 배포 모달 */}
      {deployTarget && (
        <DeployModal
          exam={deployTarget}
          classes={classes}
          onClose={() => setDeployTarget(null)}
        />
      )}
    </div>
  )
}

function Empty() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
      <BookOpen size={48} className="mx-auto text-gray-200 mb-4" />
      <p className="font-semibold text-gray-500">초안 시험이 없어요</p>
      <p className="text-sm text-gray-400 mt-1">스마트 빌더에서 새 시험을 만들어보세요</p>
      <Link href="/teacher/exams/smart"
        className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition">
        <Plus size={15} /> 시험 만들기
      </Link>
    </div>
  )
}
