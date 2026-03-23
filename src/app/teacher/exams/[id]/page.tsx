import { createClient, getUserFromCookie } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowLeft, Users, Clock, FileText, BarChart2, CheckCircle } from 'lucide-react'
import ExamActions from './ExamActions'

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

  const { data: examQuestions } = await supabase
    .from('exam_questions')
    .select('*, questions(content, category, type, difficulty)')
    .eq('exam_id', examId)
    .order('order_num')

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

  return (
    <div className="p-7 max-w-4xl">
      <div className="mb-6">
        <Link href="/teacher/exams" className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-4">
          <ArrowLeft size={14} /> 시험 목록
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">{exam.title}</h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
              {cls && <span>{cls.name}</span>}
              {exam.time_limit && (
                <span className="flex items-center gap-1"><Clock size={13} />{exam.time_limit}분</span>
              )}
              <span className="flex items-center gap-1"><FileText size={13} />{examQuestions?.length ?? 0}문제</span>
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
          { label: '총점', value: `${(examQuestions?.length ?? 0) * 5}점`, icon: CheckCircle, color: 'text-purple-600' },
          { label: '상태', value: exam.status === 'published' ? '진행중' : exam.status === 'draft' ? '초안' : '종료', icon: FileText, color: exam.status === 'published' ? 'text-blue-600' : 'text-gray-500' },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
            <card.icon size={20} className={`mx-auto mb-1.5 ${card.color}`} />
            <div className={`text-xl font-black ${card.color}`}>{card.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* 문제 목록 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-50">
            <h2 className="font-bold text-gray-900">문제 목록</h2>
          </div>
          <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
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

        {/* 제출 현황 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-50">
            <h2 className="font-bold text-gray-900">제출 현황</h2>
          </div>
          <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
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
