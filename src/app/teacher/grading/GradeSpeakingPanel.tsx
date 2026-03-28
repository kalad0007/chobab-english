'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Sparkles, CheckCircle } from 'lucide-react'
import { getMaxScore, calculateSectionBand, calculateOverallBand, mapToOldToeflScore } from '@/lib/utils'

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
  const [evalError, setEvalError] = useState<string | null>(null)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = answer.questions as any
  const maxPoints = getMaxScore(q?.question_subtype)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sub = answer.submissions as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profile = sub?.profiles as any

  const audioUrl = answer.student_answer // URL stored as student_answer


  async function aiEvaluate() {
    if (!audioUrl?.startsWith('http')) return
    setEvaluating(true)
    setEvalError(null)

    try {
      const res = await fetch('/api/ai/speaking-eval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioUrl, prompt: q?.content ?? '' }),
      })

      const data = await res.json()

      if (!res.ok) {
        const msg = data?.detail ?? data?.error ?? `HTTP ${res.status}`
        setEvalError(msg)
        return
      }
      setEvalResult(data)
      // AI 점수는 참고용(0-100)이므로 자동 입력 안 함 - 교사가 실제 배점 기준으로 직접 입력
    } catch (e) {
      setEvalError(String(e))
    } finally {
      setEvaluating(false)
    }
  }

  async function saveGrade() {
    const numScore = parseFloat(score)
    if (isNaN(numScore) || numScore < 0 || numScore > maxPoints) return
    setSaving(true)

    const feedback = evalResult
      ? `[AI 평가] ${evalResult.feedback}\n✅ ${evalResult.strengths}\n📈 ${evalResult.improvements}`
      : ''

    await supabase.from('submission_answers').update({
      is_correct: numScore > 0,
      score: numScore,
      teacher_feedback: feedback || null,
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

    // 학생 speaking 영역 실력 통계 업데이트
    const studentId = sub?.student_id
    if (studentId) {
      const percentage = Math.round((numScore / maxPoints) * 100)
      fetch('/api/stats/update-speaking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, percentage }),
      }).catch(() => {})
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
        <div className="mb-4 bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm text-amber-700 text-center">
          녹음이 제출되지 않았습니다 — 점수를 직접 입력하여 채점할 수 있습니다
        </div>
      )}

      {/* AI 평가 결과 */}
      {evalResult && (
        <div className="mb-4 bg-purple-50 border border-purple-100 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-purple-700">🤖 AI 평가 결과 (100점 기준 참고용)</p>
            <span className="text-lg font-black text-purple-700">{evalResult.totalScore}/100</span>
          </div>
          <p className="text-xs text-purple-500">※ 실제 배점에 맞게 아래 점수를 직접 입력하세요</p>
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

      {/* 에러 메시지 */}
      {evalError && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 break-all">
          <p className="font-bold mb-1">⚠️ AI 평가 오류</p>
          <p>{evalError}</p>
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
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={score}
            onChange={e => setScore(e.target.value)}
            placeholder="점수"
            min={0} max={maxPoints} step={0.5}
            className="w-20 px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm font-bold text-gray-400">/ {maxPoints}점</span>
        </div>
        {score !== '' && !isNaN(parseFloat(score)) && (
          <span className="text-xs text-gray-400">
            구 TOEFL: {mapToOldToeflScore(parseFloat(score) / maxPoints * 6.0)}
          </span>
        )}
        <button onClick={saveGrade} disabled={saving || !score}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white rounded-xl text-sm font-bold transition">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={16} />}
          채점 완료
        </button>
      </div>
    </div>
  )
}
