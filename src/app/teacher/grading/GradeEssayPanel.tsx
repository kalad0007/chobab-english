'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle, Loader2 } from 'lucide-react'
import { getMaxScore, calculateSectionBand, calculateOverallBand, mapToOldToeflScore } from '@/lib/utils'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function GradeEssayPanel({ answer }: { answer: any }) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = answer.questions as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sub = answer.submissions as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profile = sub?.profiles as any

  const maxScore = getMaxScore(q?.question_subtype)
  const [score, setScore] = useState<string>(String(maxScore))

  async function grade() {
    const numScore = parseFloat(score)
    if (isNaN(numScore) || numScore < 0 || numScore > maxScore) return
    setLoading(true)

    await supabase.from('submission_answers').update({
      is_correct: numScore >= maxScore * 0.5,
      score: numScore,
    }).eq('id', answer.id)

    // 섹션별 밴드 재계산
    const { data: allAnswers } = await supabase
      .from('submission_answers')
      .select('score, is_correct, questions(category, question_subtype)')
      .eq('submission_id', sub?.id ?? '')

    const { data: exam } = await supabase
      .from('exams').select('max_band_ceiling').eq('id', sub?.exam_id ?? '').single()
    const ceiling = exam?.max_band_ceiling ?? 6.0

    if (allAnswers) {
      const cats = ['reading', 'listening', 'writing', 'speaking'] as const
      const sectionBands: Record<string, number | null> = {}

      for (const cat of cats) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const qs = allAnswers.filter(a => (a.questions as any)?.category === cat)
        if (qs.length === 0) continue
        const allGraded = qs.every(a => a.is_correct !== null)
        if (!allGraded) continue
        const earned = qs.reduce((s, a) => s + (a.score ?? 0), 0)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const max = qs.reduce((s, a) => s + getMaxScore((a.questions as any)?.question_subtype), 0)
        sectionBands[cat] = calculateSectionBand(earned, max, ceiling)
      }

      const overallBand = calculateOverallBand(Object.values(sectionBands))
      const gradedCount = allAnswers.filter(a => a.is_correct !== null).length

      await supabase.from('submissions').update({
        reading_band:   sectionBands.reading   ?? undefined,
        listening_band: sectionBands.listening ?? undefined,
        writing_band:   sectionBands.writing   ?? undefined,
        speaking_band:  sectionBands.speaking  ?? undefined,
        overall_band:   overallBand > 0 ? overallBand : undefined,
        ...(gradedCount === allAnswers.length ? { status: 'graded' } : {}),
      }).eq('id', sub?.id ?? '')
    }

    router.refresh()
    setLoading(false)
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

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <p className="text-xs font-bold text-gray-500 mb-1.5">정답 예시</p>
          <p className="text-sm text-emerald-700 bg-emerald-50 rounded-xl px-4 py-3 font-medium">{q?.answer}</p>
        </div>
        <div>
          <p className="text-xs font-bold text-gray-500 mb-1.5">학생 답안</p>
          <p className="text-sm text-gray-800 bg-blue-50 rounded-xl px-4 py-3">{answer.student_answer}</p>
        </div>
      </div>

      {/* 점수 입력 + 채점 */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={score}
            onChange={e => setScore(e.target.value)}
            min={0} max={maxScore} step={0.5}
            className="w-20 px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm font-bold text-gray-400">/ {maxScore}점</span>
        </div>
        {/* 빠른 버튼 */}
        <button onClick={() => setScore(String(maxScore))}
          className="px-3 py-2 text-xs font-bold bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition">
          만점
        </button>
        <button onClick={() => setScore('0')}
          className="px-3 py-2 text-xs font-bold bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition">
          0점
        </button>
        <button onClick={grade} disabled={loading || score === ''}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl text-sm font-bold transition">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={16} />}
          채점 저장
        </button>
      </div>

      {/* 선생님용 참고: Band 환산 미리보기 */}
      {score !== '' && !isNaN(parseFloat(score)) && (
        <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
          <span>이 문제 기여도:</span>
          <span className="font-bold text-gray-600">
            {parseFloat(score)}/{maxScore} = {Math.round((parseFloat(score) / maxScore) * 100)}%
          </span>
          <span className="text-gray-300">|</span>
          <span>구 TOEFL 참고: {mapToOldToeflScore(parseFloat(score) / maxScore * 6.0)}</span>
        </div>
      )}
    </div>
  )
}
