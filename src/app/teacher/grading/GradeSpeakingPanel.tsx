'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Sparkles, CheckCircle } from 'lucide-react'

interface EvalResult {
  totalScore: number
  pronunciation: number
  grammar: number
  content: number
  confidence: number
  feedback: string
  strengths: string
  improvements: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function GradeSpeakingPanel({ answer }: { answer: any }) {
  const router = useRouter()
  const supabase = createClient()
  const [score, setScore] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [evaluating, setEvaluating] = useState(false)
  const [evalResult, setEvalResult] = useState<EvalResult | null>(null)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = answer.questions as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sub = answer.submissions as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profile = sub?.profiles as any

  const audioUrl = answer.student_answer // URL stored as student_answer

  async function aiEvaluate() {
    if (!audioUrl?.startsWith('http')) return
    setEvaluating(true)

    try {
      // 서버에서 오디오 fetch + 평가 (URL만 전송)
      const res = await fetch('/api/ai/speaking-eval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioUrl,
          prompt: q?.content ?? '',
        }),
      })

      if (!res.ok) throw new Error('평가 실패')
      const result: EvalResult = await res.json()
      setEvalResult(result)
      setScore(String(result.totalScore))
    } catch (e) {
      console.error(e)
      alert('AI 평가 중 오류가 발생했습니다.')
    } finally {
      setEvaluating(false)
    }
  }

  async function saveGrade() {
    const numScore = parseInt(score)
    if (isNaN(numScore)) return
    setSaving(true)

    const feedback = evalResult
      ? `[AI 평가] ${evalResult.feedback}\n✅ ${evalResult.strengths}\n📈 ${evalResult.improvements}`
      : ''

    await supabase.from('submission_answers').update({
      is_correct: numScore >= 60,
      score: numScore,
      teacher_feedback: feedback || null,
    }).eq('id', answer.id)

    // submission 전체 점수 재계산
    const { data: allAnswers } = await supabase
      .from('submission_answers')
      .select('score, is_correct')
      .eq('submission_id', sub?.id ?? '')

    if (allAnswers) {
      const totalScore = allAnswers.reduce((acc, a) => acc + (a.score ?? 0), 0)
      const gradedCount = allAnswers.filter(a => a.is_correct !== null).length
      if (gradedCount === allAnswers.length) {
        const { data: examQ } = await supabase
          .from('exam_questions').select('points').eq('exam_id', sub?.exam_id ?? '')
        const totalPoints = (examQ ?? []).reduce((acc, q) => acc + q.points, 0)
        await supabase.from('submissions').update({
          score: totalScore,
          total_points: totalPoints,
          percentage: totalPoints > 0 ? Math.round((totalScore / totalPoints) * 100) : 0,
          status: 'graded',
        }).eq('id', sub?.id ?? '')
      }
    }

    router.refresh()
    setSaving(false)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">🎤 스피킹</span>
        <span className="text-xs text-gray-400">{sub?.exams?.title}</span>
        <span className="text-xs text-gray-300">•</span>
        <span className="text-xs font-semibold text-blue-600">{profile?.name}</span>
      </div>

      {/* 문제 */}
      <div className="mb-4">
        <p className="text-xs font-bold text-gray-500 mb-1.5">과제</p>
        <p className="text-sm text-gray-800 bg-gray-50 rounded-xl px-4 py-3">{q?.content}</p>
      </div>

      {/* 오디오 플레이어 */}
      {audioUrl?.startsWith('http') ? (
        <div className="mb-4">
          <p className="text-xs font-bold text-gray-500 mb-1.5">학생 녹음</p>
          <audio controls src={audioUrl} className="w-full rounded-xl" />
        </div>
      ) : (
        <div className="mb-4 bg-gray-50 rounded-xl p-3 text-sm text-gray-400 text-center">
          아직 녹음이 제출되지 않았습니다
        </div>
      )}

      {/* AI 평가 결과 */}
      {evalResult && (
        <div className="mb-4 bg-purple-50 border border-purple-100 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-purple-700">🤖 AI 평가 결과</p>
            <span className="text-lg font-black text-purple-700">{evalResult.totalScore}점</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              { label: '발음/유창성', v: evalResult.pronunciation, max: 25 },
              { label: '문법/어휘', v: evalResult.grammar, max: 25 },
              { label: '내용/관련성', v: evalResult.content, max: 25 },
              { label: '자신감/표현', v: evalResult.confidence, max: 25 },
            ].map(({ label, v, max }) => (
              <div key={label} className="bg-white rounded-lg px-3 py-2">
                <span className="text-gray-500">{label}</span>
                <span className="font-bold text-purple-700 ml-1">{v}/{max}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-600 bg-white rounded-lg px-3 py-2">{evalResult.feedback}</p>
        </div>
      )}

      {/* 채점 */}
      <div className="flex gap-2">
        {audioUrl?.startsWith('http') && (
          <button onClick={aiEvaluate} disabled={evaluating}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl text-sm font-bold disabled:opacity-60 transition">
            {evaluating
              ? <><Loader2 size={14} className="animate-spin" /> 평가 중...</>
              : <><Sparkles size={14} /> AI 평가</>
            }
          </button>
        )}
        <input
          type="number"
          value={score}
          onChange={e => setScore(e.target.value)}
          placeholder="점수 입력"
          min={0} max={100}
          className="w-28 px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button onClick={saveGrade} disabled={saving || !score}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white rounded-xl text-sm font-bold transition">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={16} />}
          채점 완료
        </button>
      </div>
    </div>
  )
}
