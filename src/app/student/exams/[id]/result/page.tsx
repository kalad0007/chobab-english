import { createClient, getUserFromCookie } from '@/lib/supabase/server'
import Link from 'next/link'
import { CATEGORY_LABELS } from '@/lib/utils'
import { CheckCircle, XCircle, Trophy } from 'lucide-react'

export default async function ExamResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: examId } = await params
  const supabase = await createClient()
  const user = await getUserFromCookie()
  if (!user) return null

  const { data: submission } = await supabase
    .from('submissions')
    .select('id, score, total_points, percentage, status')
    .eq('exam_id', examId)
    .eq('student_id', user.id)
    .single()

  const { data: exam } = await supabase
    .from('exams').select('title, show_result_immediately').eq('id', examId).single()

  const { data: answers } = await supabase
    .from('submission_answers')
    .select('question_id, student_answer, is_correct, score, questions(content, answer, explanation, category, options, type)')
    .eq('submission_id', submission?.id)

  const correctCount = (answers ?? []).filter(a => a.is_correct).length
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalMC = (answers ?? []).filter(a => (a.questions as any)?.type === 'multiple_choice').length

  const pct = submission?.percentage ?? 0

  return (
    <div className="p-7 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">📊 시험 결과</h1>
        <p className="text-gray-500 text-sm mt-1">{exam?.title}</p>
      </div>

      {/* 점수 카드 */}
      <div className={`rounded-2xl p-6 mb-6 text-center ${
        pct >= 80 ? 'bg-gradient-to-br from-emerald-500 to-teal-600' :
        pct >= 60 ? 'bg-gradient-to-br from-blue-500 to-blue-700' :
        'bg-gradient-to-br from-amber-500 to-orange-600'
      }`}>
        <Trophy size={36} className="mx-auto text-white/80 mb-2" />
        <div className="text-6xl font-black text-white mb-1">{submission?.score ?? 0}</div>
        <div className="text-white/70 text-lg">/ {submission?.total_points ?? 0}점</div>
        <div className="text-white/90 font-semibold mt-2 text-xl">{pct}%</div>
        {totalMC > 0 && (
          <div className="text-white/70 text-sm mt-1">{correctCount} / {totalMC}개 정답</div>
        )}
      </div>

      {/* 문항별 결과 */}
      {exam?.show_result_immediately && (
        <div className="space-y-3 mb-6">
          <h2 className="font-bold text-gray-900 mb-3">문항별 결과</h2>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(answers ?? []).map((a: any, i: number) => {
            const q = a.questions
            if (!q) return null
            return (
              <div key={a.question_id}
                className={`bg-white rounded-xl border-2 p-4 ${a.is_correct === false ? 'border-red-200' : a.is_correct ? 'border-green-200' : 'border-gray-200'}`}>
                <div className="flex items-start gap-3">
                  {a.is_correct === true && <CheckCircle size={20} className="text-green-500 flex-shrink-0 mt-0.5" />}
                  {a.is_correct === false && <XCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />}
                  {a.is_correct === null && <div className="w-5 h-5 rounded-full bg-gray-200 flex-shrink-0 mt-0.5" />}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-gray-400">문제 {i + 1}</span>
                      <span className="text-xs text-gray-400">{CATEGORY_LABELS[q.category] ?? q.category}</span>
                    </div>
                    <p className="text-sm font-medium text-gray-800 mb-2">{q.content}</p>
                    {q.options && (
                      <div className="space-y-1 mb-2">
                        {q.options.map((opt: { num: number; text: string }) => (
                          <div key={opt.num} className={`flex items-center gap-2 text-xs p-1.5 rounded-lg ${
                            String(opt.num) === q.answer ? 'bg-green-50 text-green-700 font-semibold' :
                            String(opt.num) === a.student_answer && !a.is_correct ? 'bg-red-50 text-red-700' : 'text-gray-600'
                          }`}>
                            <span className="font-bold">{opt.num}.</span> {opt.text}
                            {String(opt.num) === q.answer && <span className="ml-auto">✓ 정답</span>}
                            {String(opt.num) === a.student_answer && !a.is_correct && <span className="ml-auto text-red-500">내 답</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    {q.explanation && (
                      <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-800">
                        💡 {q.explanation}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="flex gap-3">
        <Link href="/student/dashboard" className="flex-1 py-3 text-center bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition">
          대시보드로
        </Link>
        <Link href="/student/review" className="flex-1 py-3 text-center bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-bold transition">
          오답 복습하기 →
        </Link>
      </div>
    </div>
  )
}
