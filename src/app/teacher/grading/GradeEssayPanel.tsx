'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function GradeEssayPanel({ answer }: { answer: any }) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [comment, setComment] = useState('')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = answer.questions as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sub = answer.submissions as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profile = sub?.profiles as any

  async function grade(isCorrect: boolean) {
    setLoading(true)
    const score = isCorrect ? 5 : 0

    await supabase.from('submission_answers').update({
      is_correct: isCorrect,
      score,
    }).eq('id', answer.id)

    // 전체 submission 점수 재계산
    const { data: allAnswers } = await supabase
      .from('submission_answers')
      .select('score, is_correct')
      .eq('submission_id', sub?.id ?? '')

    if (allAnswers) {
      const totalScore = allAnswers.reduce((acc, a) => acc + (a.score ?? 0), 0)
      const gradedCount = allAnswers.filter(a => a.is_correct !== null).length
      const totalCount = allAnswers.length

      if (gradedCount === totalCount) {
        const { data: examQ } = await supabase
          .from('exam_questions')
          .select('points')
          .eq('exam_id', sub?.exam_id ?? '')
        const totalPoints = (examQ ?? []).reduce((acc, q) => acc + q.points, 0)
        const pct = totalPoints > 0 ? Math.round((totalScore / totalPoints) * 100) : 0

        await supabase.from('submissions').update({
          score: totalScore,
          total_points: totalPoints,
          percentage: pct,
          status: 'graded',
        }).eq('id', sub?.id ?? '')
      }
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

      <div className="flex gap-2">
        <button
          onClick={() => grade(true)}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white rounded-xl text-sm font-bold transition"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={16} />}
          정답 (5점)
        </button>
        <button
          onClick={() => grade(false)}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white rounded-xl text-sm font-bold transition"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={16} />}
          오답 (0점)
        </button>
      </div>
    </div>
  )
}
