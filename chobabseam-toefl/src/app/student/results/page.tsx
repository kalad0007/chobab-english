import { createClient, getUserFromCookie } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { FileText, Trophy, Star, Clock } from 'lucide-react'

function scoreBadgeColor(pct: number): string {
  if (pct >= 80) return 'bg-emerald-100 text-emerald-700'
  if (pct >= 60) return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-700'
}

function progressBarColor(pct: number): string {
  if (pct >= 80) return 'bg-emerald-500'
  if (pct >= 60) return 'bg-amber-400'
  return 'bg-red-400'
}

export default async function StudentResultsPage() {
  const supabase = await createClient()
  const user = await getUserFromCookie()
  if (!user) return null

  // All submissions with exam info
  const { data: submissions } = await supabase
    .from('submissions')
    .select('id, exam_id, status, score, total_points, submitted_at, exams(title, classes(name))')
    .eq('student_id', user.id)
    .in('status', ['submitted', 'graded'])
    .order('submitted_at', { ascending: false })

  // Overall stats
  const totalExams = submissions?.length ?? 0
  const gradedSubmissions = submissions?.filter(s => s.status === 'graded') ?? []
  const avgScore =
    gradedSubmissions.length > 0
      ? Math.round(
          gradedSubmissions.reduce(
            (sum, s) => sum + ((s.score ?? 0) / (s.total_points || 1)) * 100,
            0,
          ) / gradedSubmissions.length,
        )
      : null
  const totalXP = gradedSubmissions.reduce((sum, s) => sum + (s.score ?? 0), 0)

  return (
    <div className="p-7">
      {/* Header */}
      <div className="mb-7">
        <h1 className="text-2xl font-extrabold text-gray-900">📊 성적 확인</h1>
        <p className="text-gray-500 text-sm mt-1">내 시험 기록</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-7">
        {/* 총 응시 횟수 */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 border-t-[3px] border-t-blue-500 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">총 응시 횟수</p>
              <p className="text-3xl font-extrabold text-gray-900 mt-1">{totalExams}</p>
              <p className="text-xs text-gray-500 mt-0.5">제출 완료</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <FileText size={20} />
            </div>
          </div>
        </div>

        {/* 평균 점수 */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 border-t-[3px] border-t-emerald-500 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">평균 점수</p>
              <p className="text-3xl font-extrabold text-gray-900 mt-1">
                {avgScore !== null ? `${avgScore}%` : '—'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">채점 완료 기준</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Trophy size={20} />
            </div>
          </div>
        </div>

        {/* 획득 XP */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 border-t-[3px] border-t-amber-500 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">획득 XP</p>
              <p className="text-3xl font-extrabold text-gray-900 mt-1">{totalXP.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-0.5">점수 합산</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Star size={20} />
            </div>
          </div>
        </div>
      </div>

      {/* Submission list */}
      {totalExams === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center shadow-sm">
          <FileText size={48} className="mx-auto text-gray-200 mb-4" />
          <p className="font-semibold text-gray-500">아직 응시한 시험이 없어요</p>
          <p className="text-sm text-gray-400 mt-1">선생님이 출제한 시험에 응시해보세요!</p>
          <Link
            href="/student/exams"
            className="inline-block mt-4 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition"
          >
            시험 보러 가기 →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(submissions ?? []).map((sub: any) => {
            const exam = sub.exams
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const className: string = (exam?.classes as any)?.name ?? ''
            const examTitle: string = exam?.title ?? '알 수 없는 시험'
            const isGraded = sub.status === 'graded'
            const pct =
              isGraded && sub.total_points
                ? Math.round(((sub.score ?? 0) / sub.total_points) * 100)
                : null

            return (
              <div
                key={sub.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left: title + meta */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-2 mb-1.5">
                      <h3 className="font-bold text-gray-900 text-sm">{examTitle}</h3>
                      {className && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                          {className}
                        </span>
                      )}
                      {/* Status badge */}
                      {isGraded ? (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                          채점완료
                        </span>
                      ) : (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                          제출완료
                        </span>
                      )}
                    </div>

                    {/* Submitted date */}
                    {sub.submitted_at && (
                      <div className="flex items-center gap-1 text-xs text-gray-400 mb-3">
                        <Clock size={11} />
                        <span>{formatDate(sub.submitted_at)} 제출</span>
                      </div>
                    )}

                    {/* Score / progress bar */}
                    {isGraded && pct !== null ? (
                      <div className="flex items-center gap-3">
                        <div className="flex-1 bg-gray-100 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${progressBarColor(pct)}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${scoreBadgeColor(pct)}`}>
                          {pct}%
                        </span>
                      </div>
                    ) : !isGraded ? (
                      <p className="text-xs text-amber-600 font-medium">⏳ 채점 대기 중</p>
                    ) : null}
                  </div>

                  {/* Right: score + link */}
                  <div className="flex-shrink-0 flex flex-col items-end gap-2">
                    {isGraded && sub.total_points ? (
                      <div className="text-right">
                        <span className="text-2xl font-extrabold text-gray-900">{sub.score ?? 0}</span>
                        <span className="text-gray-400 text-sm font-medium"> / {sub.total_points}점</span>
                      </div>
                    ) : null}

                    {isGraded && sub.exam_id && (
                      <Link
                        href={`/student/exams/${sub.exam_id}/result`}
                        className="text-xs font-bold px-3 py-1.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition"
                      >
                        결과 보기 →
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
