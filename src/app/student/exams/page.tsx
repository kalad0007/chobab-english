import { createClient, getUserFromCookie } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { Clock, CheckCircle, AlertCircle } from 'lucide-react'

export default async function StudentExamsPage() {
  const supabase = await createClient()
  const user = await getUserFromCookie()
  if (!user) return null

  const { data: classMemberships } = await supabase
    .from('class_members').select('class_id').eq('student_id', user.id)
  const classIds = (classMemberships ?? []).map(m => m.class_id)

  const { data: exams } = classIds.length > 0
    ? await supabase.from('exams')
        .select('id, title, description, time_limit, start_at, end_at, status, classes(name)')
        .in('class_id', classIds)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
    : { data: [] }

  // 내 제출 현황
  const examIds = (exams ?? []).map(e => e.id)
  const { data: mySubmissions } = examIds.length > 0
    ? await supabase.from('submissions').select('exam_id, status, score, total_points')
        .eq('student_id', user.id).in('exam_id', examIds)
    : { data: [] }

  const submissionMap = Object.fromEntries((mySubmissions ?? []).map(s => [s.exam_id, s]))

  return (
    <div className="p-7">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">📝 시험 목록</h1>
        <p className="text-gray-500 text-sm mt-1">선생님이 배정한 시험을 확인하세요</p>
      </div>

      <div className="space-y-3">
        {(exams ?? []).length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <p className="text-gray-400 font-medium">배정된 시험이 없어요</p>
          </div>
        ) : (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (exams ?? []).map((exam: any) => {
            const sub = submissionMap[exam.id]
            const isSubmitted = sub?.status === 'submitted' || sub?.status === 'graded'
            const isInProgress = sub?.status === 'in_progress'
            const isExpired = exam.end_at && new Date(exam.end_at) < new Date()

            return (
              <div key={exam.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  isSubmitted ? 'bg-green-100' : isExpired ? 'bg-gray-100' : 'bg-blue-100'
                }`}>
                  {isSubmitted
                    ? <CheckCircle size={22} className="text-green-600" />
                    : isExpired
                    ? <AlertCircle size={22} className="text-gray-400" />
                    : <Clock size={22} className="text-blue-600" />
                  }
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-900">{exam.title}</h3>
                    {exam.classes?.name && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{exam.classes.name}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    {exam.time_limit && <span className="text-xs text-gray-400">⏱ {exam.time_limit}분</span>}
                    {exam.end_at && <span className="text-xs text-gray-400">마감: {formatDate(exam.end_at)}</span>}
                    {sub?.status === 'graded' && (
                      <span className="text-xs font-bold text-emerald-600">{sub.score}/{sub.total_points}점</span>
                    )}
                  </div>
                </div>
                <div>
                  {isSubmitted ? (
                    <Link href={`/student/exams/${exam.id}/result`}
                      className="px-4 py-2 text-sm font-semibold text-emerald-700 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition">
                      결과 보기
                    </Link>
                  ) : isExpired ? (
                    <span className="px-4 py-2 text-sm font-semibold text-gray-400 bg-gray-50 rounded-xl">마감됨</span>
                  ) : (
                    <Link href={`/student/exams/${exam.id}`}
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
