import { createClient, getUserFromCookie } from '@/lib/supabase/server'
import Link from 'next/link'
import { CATEGORY_LABELS, getDiffInfo, usesAlphaOptions, optionLabel } from '@/lib/utils'
import { CheckCircle, XCircle, Trophy, Star } from 'lucide-react'

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
    .from('exams').select('title, show_result_immediately, description').eq('id', examId).single()

  const { data: answers } = await supabase
    .from('submission_answers')
    .select('question_id, student_answer, is_correct, score, questions(content, passage, answer, explanation, category, options, type, difficulty, question_subtype)')
    .eq('submission_id', submission?.id)

  const correctCount = (answers ?? []).filter(a => a.is_correct).length
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalMC = (answers ?? []).filter(a => (a.questions as any)?.type === 'multiple_choice').length

  const pct = submission?.percentage ?? 0

  // maxBand 파싱 (score×0.1, total_points×0.1 방식으로 저장됨)
  const bandScore   = (submission?.score ?? 0) / 10          // e.g. 35 → 3.5
  const maxBandVal  = (submission?.total_points ?? 60) / 10  // e.g. 55 → 5.5
  const bandInfo    = getDiffInfo(bandScore)

  // 단순 정답률 (표시용)
  const simplePct = totalMC > 0 ? Math.round((correctCount / totalMC) * 100) : 0

  return (
    <div className="p-7 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">📊 시험 결과</h1>
        <p className="text-gray-500 text-sm mt-1">{exam?.title}</p>
      </div>

      {/* 점수 카드 — Band Score 중심 */}
      <div className={`rounded-2xl p-6 mb-6 text-center ${
        bandScore >= 5.0 ? 'bg-gradient-to-br from-purple-600 to-indigo-700' :
        bandScore >= 4.0 ? 'bg-gradient-to-br from-blue-500 to-blue-700' :
        bandScore >= 3.0 ? 'bg-gradient-to-br from-emerald-500 to-teal-600' :
        'bg-gradient-to-br from-amber-500 to-orange-600'
      }`}>
        <Trophy size={32} className="mx-auto text-white/80 mb-2" />

        {/* 메인: 밴드 점수 */}
        <div className="text-7xl font-black text-white mb-1 tracking-tight">
          {bandScore.toFixed(1)}
        </div>
        <div className="text-white/80 text-lg font-bold mb-0.5">Band Score</div>
        <div className="text-white/60 text-sm">
          {bandInfo.level} · {bandInfo.name} · Max {maxBandVal.toFixed(1)}
        </div>

        {/* 서브: 가중 성취도 & 정답률 */}
        <div className="mt-4 pt-4 border-t border-white/20 flex items-center justify-center gap-6 text-sm">
          <div className="text-center">
            <div className="text-white font-extrabold text-xl">{pct}%</div>
            <div className="text-white/60 text-xs">난이도 가중 성취도</div>
          </div>
          {totalMC > 0 && (
            <div className="text-center">
              <div className="text-white font-extrabold text-xl">{correctCount}/{totalMC}</div>
              <div className="text-white/60 text-xs">단순 정답</div>
            </div>
          )}
        </div>

        {/* 가산점 메시지 */}
        {pct > simplePct && simplePct > 0 && (
          <div className="mt-3 flex items-center justify-center gap-1 text-white/80 text-xs">
            <Star size={11} className="fill-yellow-300 text-yellow-300" />
            어려운 문제를 많이 맞혀 가산점이 부여되었습니다!
          </div>
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

            // fill-blank 여부: content나 passage가 JSON 배열이면
            const isFillBlank = (typeof q.content === 'string' && q.content.trimStart().startsWith('['))
              || (typeof q.passage === 'string' && q.passage.trimStart().startsWith('['))

            // explanation이 JSON이면 파싱해서 explanation 필드만 추출
            let explanationText = q.explanation ?? ''
            if (explanationText.trimStart().startsWith('{')) {
              try { explanationText = JSON.parse(explanationText).explanation ?? '' } catch { explanationText = '' }
            }

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
                    {/* fill-blank는 JSON이므로 content 직접 표시 안 함 */}
                    {!isFillBlank && (
                      <p className="text-sm font-medium text-gray-800 mb-2">{q.content}</p>
                    )}
                    {/* fill-blank: 정답 vs 내 답 표시 */}
                    {isFillBlank && (
                      <div className="space-y-1 mb-2">
                        {(q.answer ?? '').split(',').map((correct: string, ci: number) => {
                          const studentWord = (a.student_answer ?? '').split(',')[ci]?.trim() ?? ''
                          const isWordCorrect = correct.trim().toLowerCase() === studentWord.toLowerCase()
                          return (
                            <div key={ci} className={`flex items-center gap-2 text-xs p-1.5 rounded-lg ${isWordCorrect ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                              <span className="font-bold">{ci + 1}.</span>
                              <span className="font-semibold">정답: {correct.trim()}</span>
                              {!isWordCorrect && studentWord && <span className="text-red-500 ml-1">내 답: {studentWord}</span>}
                              {!isWordCorrect && !studentWord && <span className="text-gray-400 ml-1">(미입력)</span>}
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {q.options && !isFillBlank && (() => {
                      const alpha = usesAlphaOptions(q.category, q.question_subtype)
                      return (
                      <div className="space-y-1 mb-2">
                        {q.options.map((opt: { num: number; text: string }) => (
                          <div key={opt.num} className={`flex items-center gap-2 text-xs p-1.5 rounded-lg ${
                            String(opt.num) === q.answer ? 'bg-green-50 text-green-700 font-semibold' :
                            String(opt.num) === a.student_answer && !a.is_correct ? 'bg-red-50 text-red-700' : 'text-gray-600'
                          }`}>
                            <span className="font-bold">{optionLabel(opt.num, alpha)}.</span> {opt.text}
                            {String(opt.num) === q.answer && <span className="ml-auto">✓ 정답</span>}
                            {String(opt.num) === a.student_answer && !a.is_correct && <span className="ml-auto text-red-500">내 답</span>}
                          </div>
                        ))}
                      </div>
                      )
                    })()}
                    {explanationText && (
                      <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-800">
                        💡 {explanationText}
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
