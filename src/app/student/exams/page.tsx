import { createClient, createAdminClient, getUserFromCookie } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatDate, DEFAULT_TIME_LIMITS, AUDIO_BUFFER } from '@/lib/utils'
import { Clock, CheckCircle, AlertCircle } from 'lucide-react'

export default async function StudentExamsPage() {
  const supabase = await createClient()
  const admin = createAdminClient()
  const user = await getUserFromCookie()
  if (!user) return null

  // 학생이 속한 반 목록
  const { data: classMemberships } = await supabase
    .from('class_members').select('class_id').eq('student_id', user.id)
  const classIds = (classMemberships ?? []).map(m => m.class_id)

  // 배포된 시험 목록 (join 없이 — exam RLS 우회 목적)
  const now = new Date().toISOString()
  const { data: deployments } = classIds.length > 0
    ? await supabase
        .from('exam_deployments')
        .select('id, exam_id, class_id, start_at, end_at, time_limit_mins, status')
        .in('class_id', classIds)
        .lte('start_at', now)
        .neq('status', 'scheduled')
        .order('end_at', { ascending: true })
    : { data: [] }

  // exam 제목/시간은 adminClient로 별도 조회 (draft 포함)
  const examIds = [...new Set((deployments ?? []).map(d => d.exam_id))]
  const { data: exams } = examIds.length > 0
    ? await admin.from('exams').select('id, title, time_limit').in('id', examIds)
    : { data: [] }
  const examMap = Object.fromEntries((exams ?? []).map(e => [e.id, e]))

  // 문제별 시간 합계 계산을 위해 exam_questions + questions 조회
  const { data: examQuestions } = examIds.length > 0
    ? await admin
        .from('exam_questions')
        .select('exam_id, questions(question_subtype, time_limit)')
        .in('exam_id', examIds)
    : { data: [] }
  // exam_id별 총 시간 (초) 계산
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const examTimeTotals: Record<string, number> = {}
  for (const eq of (examQuestions ?? []) as any[]) {
    const q = eq.questions
    if (!q) continue
    const base = q.time_limit ?? DEFAULT_TIME_LIMITS[q.question_subtype ?? ''] ?? 0
    const buffer = AUDIO_BUFFER[q.question_subtype ?? ''] ?? 0
    examTimeTotals[eq.exam_id] = (examTimeTotals[eq.exam_id] ?? 0) + base + buffer
  }

  // 반 이름
  const { data: classes } = classIds.length > 0
    ? await supabase.from('classes').select('id, name').in('id', classIds)
    : { data: [] }
  const classMap = Object.fromEntries((classes ?? []).map(c => [c.id, c]))

  // 내 제출 현황
  const deploymentIds = (deployments ?? []).map(d => d.id)
  const { data: mySubmissions } = deploymentIds.length > 0
    ? await supabase
        .from('submissions')
        .select('deployment_id, exam_id, status, score, total_points, percentage')
        .eq('student_id', user.id)
        .in('deployment_id', deploymentIds)
    : { data: [] }

  const submissionMap = Object.fromEntries((mySubmissions ?? []).map(s => [s.deployment_id, s]))

  return (
    <div className="p-4 md:p-7">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">📝 시험 목록</h1>
        <p className="text-gray-500 text-sm mt-1">선생님이 배정한 시험을 확인하세요</p>
      </div>

      <div className="space-y-3">
        {(deployments ?? []).length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <p className="text-gray-400 font-medium">배정된 시험이 없어요</p>
          </div>
        ) : (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (deployments ?? []).map((dep: any) => {
            const sub = submissionMap[dep.id]
            const exam = examMap[dep.exam_id]
            const cls = classMap[dep.class_id]
            const isSubmitted = sub?.status === 'submitted' || sub?.status === 'graded'
            const isInProgress = sub?.status === 'in_progress'
            const isExpired = dep.end_at && new Date(dep.end_at) < new Date()
            const isCompleted = dep.status === 'completed'
            const totalSecs = examTimeTotals[dep.exam_id]
            const timeLimit: number | null = totalSecs
              ? Math.ceil(totalSecs / 60)
              : (dep.time_limit_mins ?? exam?.time_limit ?? null)

            return (
              <div key={dep.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  isSubmitted ? 'bg-green-100' : (isExpired || isCompleted) ? 'bg-gray-100' : 'bg-blue-100'
                }`}>
                  {isSubmitted
                    ? <CheckCircle size={22} className="text-green-600" />
                    : (isExpired || isCompleted)
                    ? <AlertCircle size={22} className="text-gray-400" />
                    : <Clock size={22} className="text-blue-600" />
                  }
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-900">{exam?.title ?? '시험'}</h3>
                    {cls?.name && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{cls.name}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    {timeLimit && <span className="text-xs text-gray-400">⏱ {timeLimit}분</span>}
                    {dep.end_at && <span className="text-xs text-gray-400">마감: {formatDate(dep.end_at)}</span>}
                    {sub?.status === 'graded' && sub.percentage != null && (
                      <span className="text-xs font-bold text-emerald-600">{sub.percentage}%</span>
                    )}
                  </div>
                </div>
                <div>
                  {isSubmitted && isCompleted ? (
                    <Link href={`/student/exams/${dep.exam_id}/result`}
                      className="px-4 py-2 text-sm font-semibold text-emerald-700 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition">
                      결과 보기
                    </Link>
                  ) : isSubmitted ? (
                    <span className="px-4 py-2 text-sm font-semibold text-gray-500 bg-gray-50 rounded-xl">제출 완료</span>
                  ) : (isExpired || isCompleted) ? (
                    <span className="px-4 py-2 text-sm font-semibold text-gray-400 bg-gray-50 rounded-xl">마감됨</span>
                  ) : (
                    <Link href={`/student/exams/${dep.exam_id}?deployment=${dep.id}`}
                      className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition">
                      {isInProgress ? '이어서 풀기 →' : '시험 시작 →'}
                    </Link>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
