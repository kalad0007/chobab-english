'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Bell, Loader2, CheckCircle2, Clock, ArrowLeft } from 'lucide-react'
import { sendEncouragement, updateDeploymentStatus } from '../../exams/actions'

interface Student {
  id: string
  name: string
  email: string
}

interface SubmissionRow {
  student_id: string
  submitted_at: string | null
  score: number | null
  total_points: number | null
  percentage: number | null
  status: string
}

interface Props {
  deploymentId: string
  examId: string
  examTitle: string
  className: string
  startAt: string
  endAt: string
  timeLimitMins: number | null
  status: string
  students: Student[]
  submissions: SubmissionRow[]
}

function getDDay(endAt: string): string {
  const diff = Math.ceil((new Date(endAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (diff < 0) return '마감됨'
  if (diff === 0) return 'D-Day'
  return `D-${diff}`
}

export default function DeploymentClient({
  deploymentId, examId, examTitle, className, startAt, endAt,
  timeLimitMins, status, students, submissions
}: Props) {
  const [tab, setTab] = useState<'submitted' | 'pending'>('pending')
  const [sending, setSending] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [done, setDone] = useState(false)

  const submissionMap = Object.fromEntries(submissions.map(s => [s.student_id, s]))
  const submitted = students.filter(s => {
    const sub = submissionMap[s.id]
    return sub && (sub.status === 'submitted' || sub.status === 'graded')
  })
  const pending = students.filter(s => !submissionMap[s.id] || submissionMap[s.id].status === 'in_progress')

  const pct = students.length > 0 ? Math.round((submitted.length / students.length) * 100) : 0
  const avgScore = submitted.length > 0
    ? Math.round(submitted.reduce((acc, s) => {
        const sub = submissionMap[s.id]
        return acc + (sub?.percentage ?? 0)
      }, 0) / submitted.length)
    : null

  async function handleEncourage() {
    const pendingIds = pending.map(s => s.id)
    if (pendingIds.length === 0) return
    setSending(true)
    try { await sendEncouragement(deploymentId, pendingIds) } finally { setSending(false) }
    setDone(true)
    setTimeout(() => setDone(false), 3000)
  }

  async function handleComplete() {
    if (!confirm('최종 성적을 확정하고 학생에게 공개하시겠습니까?')) return
    setCompleting(true)
    try { await updateDeploymentStatus(deploymentId, 'completed') } finally { setCompleting(false) }
  }

  const dday = getDDay(endAt)
  const isActive = status === 'active' || status === 'scheduled'
  const isGrading = status === 'grading'

  return (
    <div className="p-4 md:p-7 max-w-4xl">
      {/* 뒤로가기 */}
      <Link href="/teacher/exams" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5 transition">
        <ArrowLeft size={15} /> 시험 관리
      </Link>

      {/* 헤더 */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <p className="text-sm font-bold text-blue-600 mb-1">{className}</p>
          <h1 className="text-2xl font-extrabold text-gray-900">{examTitle}</h1>
          <div className="flex items-center gap-3 text-xs text-gray-400 mt-2">
            <span>{new Date(startAt).toLocaleDateString('ko-KR')} ~ {new Date(endAt).toLocaleDateString('ko-KR')}</span>
            {timeLimitMins && <span><Clock size={11} className="inline mr-1" />{timeLimitMins}분 제한</span>}
            <span className={`font-bold ${dday === '마감됨' ? 'text-gray-400' : dday === 'D-Day' || dday === 'D-1' ? 'text-red-500' : 'text-blue-600'}`}>
              {dday}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {isGrading && (
            <>
              <Link href={`/teacher/deployments/${deploymentId}/grading`}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold bg-purple-100 text-purple-700 hover:bg-purple-200 rounded-xl transition">
                채점하러 가기 →
              </Link>
              <button onClick={handleComplete} disabled={completing}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 rounded-xl transition">
                {completing ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                최종 성적 확정
              </button>
            </>
          )}
          <Link href={`/teacher/exams/${examId}`}
            className="px-4 py-2 text-sm font-semibold border border-gray-200 rounded-xl hover:bg-gray-50 transition">
            문제 보기
          </Link>
        </div>
      </div>

      {/* 요약 카드 3개 */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-3xl font-extrabold text-gray-900">{students.length}</p>
          <p className="text-xs text-gray-400 mt-1">총 학생</p>
        </div>
        <div className="bg-blue-50 rounded-2xl border border-blue-100 shadow-sm p-4 text-center">
          <p className="text-3xl font-extrabold text-blue-700">{submitted.length}</p>
          <p className="text-xs text-blue-400 mt-1">응시 완료</p>
        </div>
        <div className={`rounded-2xl border shadow-sm p-4 text-center ${
          pending.length > 0 ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100'
        }`}>
          <p className={`text-3xl font-extrabold ${pending.length > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
            {pending.length}
          </p>
          <p className={`text-xs mt-1 ${pending.length > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>미응시</p>
        </div>
      </div>

      {/* 응시율 바 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-bold text-gray-700">전체 응시율</span>
          <span className="text-2xl font-extrabold text-gray-900">{pct}%</span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${
            pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-blue-500' : 'bg-amber-400'
          }`} style={{ width: `${pct}%` }} />
        </div>
        {avgScore !== null && (
          <p className="text-xs text-gray-400 mt-2 text-right">가채점 평균 {avgScore}%</p>
        )}
      </div>

      {/* 학생 명단 탭 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setTab('pending')}
              className={`px-4 py-1.5 text-sm font-semibold rounded-md transition ${
                tab === 'pending' ? 'bg-white shadow-sm text-amber-600' : 'text-gray-500 hover:text-gray-700'
              }`}>
              미응시 <span className="text-xs font-bold ml-1">{pending.length}</span>
            </button>
            <button onClick={() => setTab('submitted')}
              className={`px-4 py-1.5 text-sm font-semibold rounded-md transition ${
                tab === 'submitted' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`}>
              응시 완료 <span className="text-xs font-bold ml-1">{submitted.length}</span>
            </button>
          </div>

          {/* 독려 알림 버튼 */}
          {tab === 'pending' && pending.length > 0 && isActive && (
            <button onClick={handleEncourage} disabled={sending || done}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition ${
                done
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
              } disabled:opacity-60`}>
              {sending ? <Loader2 size={11} className="animate-spin" /> : <Bell size={11} />}
              {done ? '알림 발송 완료!' : `${pending.length}명 독려 알림`}
            </button>
          )}
        </div>

        {/* 미응시 목록 */}
        {tab === 'pending' && (
          <div>
            {pending.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-gray-400">
                🎉 모든 학생이 응시했어요!
              </div>
            ) : (
              pending.map((s, i) => (
                <div key={s.id} className={`flex items-center px-5 py-3 ${i > 0 ? 'border-t border-gray-50' : ''}`}>
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-xs font-bold text-amber-600 flex-shrink-0 mr-3">
                    {s.name[0]}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-800">{s.name}</p>
                    <p className="text-xs text-gray-400">{s.email}</p>
                  </div>
                  <span className="text-xs text-amber-500 font-semibold bg-amber-50 px-2 py-0.5 rounded-full">미응시</span>
                </div>
              ))
            )}
          </div>
        )}

        {/* 응시 완료 목록 */}
        {tab === 'submitted' && (
          <div>
            {submitted.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-gray-400">아직 응시한 학생이 없어요</div>
            ) : (
              submitted.map((s, i) => {
                const sub = submissionMap[s.id]
                return (
                  <div key={s.id} className={`flex items-center px-5 py-3 ${i > 0 ? 'border-t border-gray-50' : ''}`}>
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600 flex-shrink-0 mr-3">
                      {s.name[0]}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-800">{s.name}</p>
                      <p className="text-xs text-gray-400">
                        {sub?.submitted_at
                          ? new Date(sub.submitted_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                          : '제출 시간 불명'}
                      </p>
                    </div>
                    {sub?.percentage != null ? (
                      <div className="text-right">
                        <p className={`text-sm font-bold ${sub.percentage >= 80 ? 'text-emerald-600' : sub.percentage >= 60 ? 'text-blue-600' : 'text-amber-600'}`}>
                          {sub.percentage}%
                        </p>
                        {sub.score != null && sub.total_points != null && (
                          <p className="text-xs text-gray-400">{sub.score}/{sub.total_points}점</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">채점 대기</span>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}
