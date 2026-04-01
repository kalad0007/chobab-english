'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle, Loader2 } from 'lucide-react'
import { getMaxScore, mapToOldToeflScore } from '@/lib/utils'
import { recalcSubmissionBands } from '@/lib/grading'

// Writing 루브릭 항목 (각 1~4점)
const WRITING_RUBRIC = [
  { key: 'task_achievement', label: '과제 완수', desc: '주제에 맞게 요구 사항을 충족했는가' },
  { key: 'coherence',        label: '논리적 흐름', desc: '문단 구성과 연결이 자연스러운가' },
  { key: 'language_use',     label: '언어 사용',  desc: '어휘·문법의 다양성과 정확도' },
] as const

type WritingRubricKey = typeof WRITING_RUBRIC[number]['key']
type RubricScores = Record<WritingRubricKey, number>

const RUBRIC_LABELS = ['', '미흡 (1)', '보통 (2)', '양호 (3)', '우수 (4)']

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function GradeEssayPanel({ answer }: { answer: any }) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = answer.questions as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sub = answer.submissions as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profile = sub?.profiles as any

  const maxScore = getMaxScore(q?.question_subtype)

  // 저장된 루브릭 복원 (재채점 시)
  const savedRubric = answer.rubric_scores as RubricScores | null
  const [rubric, setRubric] = useState<RubricScores>(savedRubric ?? {
    task_achievement: 0,
    coherence: 0,
    language_use: 0,
  })

  // 루브릭 합산 → 최종 점수 환산 (3개 항목 × 4점 만점 = 12점 → maxScore 비례)
  const rubricTotal = rubric.task_achievement + rubric.coherence + rubric.language_use
  const rubricMax = WRITING_RUBRIC.length * 4  // 12
  const computedScore = rubricTotal > 0
    ? Math.round((rubricTotal / rubricMax) * maxScore * 10) / 10
    : 0
  const allFilled = WRITING_RUBRIC.every(r => rubric[r.key] > 0)

  async function grade() {
    if (!allFilled || loading) return
    setLoading(true)

    const { error: updateError } = await supabase.from('submission_answers').update({
      is_correct: computedScore >= maxScore * 0.5,
      score: computedScore,
      rubric_scores: rubric,
    }).eq('id', answer.id)

    if (updateError) {
      setLoading(false)
      setError('채점 저장 실패: ' + updateError.message)
      return
    }

    // 섹션별 밴드 재계산
    await recalcSubmissionBands(supabase, sub?.id ?? '', sub?.exam_id ?? '')

    setLoading(false)
    setSaved(true)
    setTimeout(() => window.location.reload(), 800)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-bold text-gray-400">{sub?.exams?.title}</span>
        <span className="text-xs text-gray-300">•</span>
        <span className="text-xs font-semibold text-blue-600">{profile?.name}</span>
        <span className="ml-auto text-xs text-gray-400">배점 {maxScore}점</span>
      </div>

      <div className="mb-4">
        <p className="text-xs font-bold text-gray-500 mb-1.5">문제</p>
        <p className="text-sm text-gray-800 bg-gray-50 rounded-xl px-4 py-3">{q?.content}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <div>
          <p className="text-xs font-bold text-gray-500 mb-1.5">정답 예시</p>
          <p className="text-sm text-emerald-700 bg-emerald-50 rounded-xl px-4 py-3 font-medium">{q?.answer}</p>
        </div>
        <div>
          <p className="text-xs font-bold text-gray-500 mb-1.5">학생 답안</p>
          <p className="text-sm text-gray-800 bg-blue-50 rounded-xl px-4 py-3 whitespace-pre-wrap break-words">{answer.student_answer}</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* 루브릭 채점 */}
      <div className="border border-gray-100 rounded-xl overflow-hidden mb-4">
        <div className="bg-gray-50 px-4 py-2 flex items-center justify-between">
          <span className="text-xs font-bold text-gray-600">루브릭 채점</span>
          <span className="text-xs text-gray-400">각 항목 1~4점 선택</span>
        </div>
        <div className="divide-y divide-gray-50">
          {WRITING_RUBRIC.map(({ key, label, desc }) => (
            <div key={key} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <span className="text-sm font-bold text-gray-800">{label}</span>
                  <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                </div>
                <span className={`text-sm font-black px-2 py-0.5 rounded-lg ${
                  rubric[key] === 0 ? 'text-gray-300' :
                  rubric[key] <= 2 ? 'text-amber-600 bg-amber-50' :
                  'text-emerald-600 bg-emerald-50'
                }`}>
                  {rubric[key] > 0 ? `${rubric[key]}점` : '—'}
                </span>
              </div>
              <div className="flex gap-2">
                {[1, 2, 3, 4].map(v => (
                  <button
                    key={v}
                    onClick={() => setRubric(prev => ({ ...prev, [key]: v }))}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                      rubric[key] === v
                        ? v <= 2 ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {RUBRIC_LABELS[v]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 환산 점수 미리보기 + 저장 */}
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-gray-50 rounded-xl px-4 py-2.5">
          <span className="text-xs text-gray-400">환산 점수: </span>
          <span className={`text-sm font-black ${allFilled ? 'text-blue-600' : 'text-gray-300'}`}>
            {allFilled ? `${computedScore} / ${maxScore}점` : '항목을 모두 선택하세요'}
          </span>
          {allFilled && (
            <span className="text-xs text-gray-400 ml-2">
              ({rubricTotal}/{rubricMax} → {Math.round(computedScore / maxScore * 100)}%)
            </span>
          )}
        </div>
        <button onClick={grade} disabled={!allFilled || loading || saved}
          className={`flex items-center gap-2 px-5 py-2.5 disabled:opacity-40 text-white rounded-xl text-sm font-bold transition ${
            saved ? 'bg-emerald-500' : 'bg-blue-600 hover:bg-blue-700'
          }`}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={16} />}
          {saved ? '채점 완료 ✓' : '채점 저장'}
        </button>
      </div>

      {allFilled && (
        <p className="mt-2 text-xs text-gray-400 text-right">
          구 TOEFL 참고: {mapToOldToeflScore(computedScore / maxScore * 6.0)}
        </p>
      )}
    </div>
  )
}
