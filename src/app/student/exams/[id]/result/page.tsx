import { createClient, getUserFromCookie } from '@/lib/supabase/server'
import Link from 'next/link'
import { CATEGORY_LABELS, getDiffInfo, bandToLevel, usesAlphaOptions, optionLabel } from '@/lib/utils'
import { CheckCircle, XCircle, Trophy } from 'lucide-react'

export default async function ExamResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: examId } = await params
  const supabase = await createClient()
  const user = await getUserFromCookie()
  if (!user) return null

  const { data: submission } = await supabase
    .from('submissions')
    .select('id, overall_band, reading_band, listening_band, writing_band, speaking_band, status')
    .eq('exam_id', examId)
    .eq('student_id', user.id)
    .single()

  const { data: exam } = await supabase
    .from('exams').select('title, show_result_immediately, max_band_ceiling').eq('id', examId).single()

  const { data: answers } = await supabase
    .from('submission_answers')
    .select('question_id, student_answer, is_correct, score, questions(content, passage, answer, explanation, category, options, type, difficulty, question_subtype)')
    .eq('submission_id', submission?.id)

  const correctCount = (answers ?? []).filter(a => a.is_correct).length
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalMC = (answers ?? []).filter(a => (a.questions as any)?.type === 'multiple_choice').length

  const overallBand   = submission?.overall_band ?? 0
  const ceilingBand   = exam?.max_band_ceiling ?? 6.0
  const bandInfo      = getDiffInfo(overallBand)

  const sectionBands = [
    { key: 'reading',   label: 'Reading',   band: submission?.reading_band },
    { key: 'listening', label: 'Listening', band: submission?.listening_band },
    { key: 'writing',   label: 'Writing',   band: submission?.writing_band },
    { key: 'speaking',  label: 'Speaking',  band: submission?.speaking_band },
  ].filter(s => s.band != null)

  return (
    <div className="p-7 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">📊 시험 결과</h1>
        <p className="text-gray-500 text-sm mt-1">{exam?.title}</p>
      </div>

      {/* 점수 카드 — Overall Band 중심 */}
      <div className={`rounded-2xl p-6 mb-4 text-center ${
        overallBand >= 5.0 ? 'bg-gradient-to-br from-purple-600 to-indigo-700' :
        overallBand >= 4.0 ? 'bg-gradient-to-br from-blue-500 to-blue-700' :
        overallBand >= 3.0 ? 'bg-gradient-to-br from-emerald-500 to-teal-600' :
        overallBand > 0    ? 'bg-gradient-to-br from-amber-500 to-orange-600' :
        'bg-gradient-to-br from-gray-400 to-gray-600'
      }`}>
        <Trophy size={32} className="mx-auto text-white/80 mb-2" />
        <div className="text-7xl font-black text-white mb-1 tracking-tight">
          {overallBand > 0 ? overallBand.toFixed(1) : '—'}
        </div>
        <div className="text-white/80 text-lg font-bold mb-0.5">Overall Band</div>
        <div className="text-white/60 text-sm">
          {overallBand > 0 ? `${bandInfo.level} · ${bandInfo.name}` : '채점 대기 중'}
          {' · '}Max {ceilingBand.toFixed(1)}
        </div>
        {overallBand > 0 && (
          <div className="mt-2 text-white/50 text-xs">{bandToLevel(overallBand)}</div>
        )}
        {totalMC > 0 && (
          <div className="mt-4 pt-4 border-t border-white/20">
            <div className="text-white font-extrabold text-xl">{correctCount}/{totalMC}</div>
            <div className="text-white/60 text-xs">객관식 정답</div>
          </div>
        )}
      </div>

      {/* 섹션별 밴드 */}
      {sectionBands.length > 0 && (
        <div className={`grid gap-3 mb-6 ${sectionBands.length === 1 ? 'grid-cols-1' : sectionBands.length === 2 ? 'grid-cols-2' : sectionBands.length === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
          {sectionBands.map(s => {
            const b = s.band!
            const info = getDiffInfo(b)
            return (
              <div key={s.key} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
                <div className="text-xs font-bold text-gray-400 mb-1">{s.label}</div>
                <div className={`text-2xl font-black ${b >= 5.0 ? 'text-purple-600' : b >= 4.0 ? 'text-blue-600' : b >= 3.0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {b.toFixed(1)}
                </div>
                <div className={`text-xs px-1.5 py-0.5 rounded-full font-semibold mt-1 inline-block ${info.color}`}>
                  {info.level}
                </div>
              </div>
            )
          })}
        </div>
      )}

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
