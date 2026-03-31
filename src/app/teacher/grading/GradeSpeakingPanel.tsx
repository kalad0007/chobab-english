'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Sparkles, CheckCircle } from 'lucide-react'
import { getMaxScore, calculateSectionBand, calculateOverallBand, mapToOldToeflScore } from '@/lib/utils'

// Speaking 루브릭 항목 (각 1~4점) — 공식 TOEFL 채점 기준
const SPEAKING_RUBRIC = [
  { key: 'delivery',           label: '전달력',       desc: '발음·유창성·자신감' },
  { key: 'language_use',       label: '언어 사용',    desc: '어휘·문법의 다양성과 정확도' },
  { key: 'topic_development',  label: '주제 전개',    desc: '내용의 관련성과 논리적 구성' },
] as const

type SpeakingRubricKey = typeof SPEAKING_RUBRIC[number]['key']
type RubricScores = Record<SpeakingRubricKey, number>

const RUBRIC_LABELS = ['', '미흡 (1)', '보통 (2)', '양호 (3)', '우수 (4)']

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

// AI 0~25 점수 → 루브릭 1~4 변환
function toRubricScale(value: number, outOf: number): number {
  const ratio = value / outOf
  if (ratio >= 0.75) return 4
  if (ratio >= 0.50) return 3
  if (ratio >= 0.25) return 2
  return 1
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function GradeSpeakingPanel({ answer }: { answer: any }) {
  const router = useRouter()
  const supabase = createClient()
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
  const audioUrl = answer.student_answer

  // 저장된 루브릭 복원 (재채점 시)
  const savedRubric = answer.rubric_scores as RubricScores | null
  const [rubric, setRubric] = useState<RubricScores>(savedRubric ?? {
    delivery: 0,
    language_use: 0,
    topic_development: 0,
  })

  // 루브릭 합산 → 최종 점수 환산 (3개 × 4점 = 12점 → maxPoints 비례)
  const rubricTotal = rubric.delivery + rubric.language_use + rubric.topic_development
  const rubricMax = SPEAKING_RUBRIC.length * 4  // 12
  const computedScore = rubricTotal > 0
    ? Math.round((rubricTotal / rubricMax) * maxPoints * 10) / 10
    : 0
  const allFilled = SPEAKING_RUBRIC.every(r => rubric[r.key] > 0)

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
      if (!res.ok) { setEvalError(data?.detail ?? data?.error ?? `HTTP ${res.status}`); return }

      setEvalResult(data)

      // AI 결과를 루브릭 1~4 점수로 자동 변환
      setRubric({
        delivery:          toRubricScale(data.pronunciation + data.confidence, 50),
        language_use:      toRubricScale(data.grammar, 25),
        topic_development: toRubricScale(data.content, 25),
      })
    } catch (e) {
      setEvalError(String(e))
    } finally {
      setEvaluating(false)
    }
  }

  async function saveGrade() {
    if (!allFilled || saving) return
    setSaving(true)

    const feedback = evalResult
      ? `[AI 평가] ${evalResult.feedback}\n✅ ${evalResult.strengths}\n📈 ${evalResult.improvements}`
      : ''

    await supabase.from('submission_answers').update({
      is_correct: computedScore > 0,
      score: computedScore,
      rubric_scores: rubric,
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

    const studentId = sub?.student_id
    if (studentId) {
      fetch('/api/stats/update-speaking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, percentage: Math.round(computedScore / maxPoints * 100) }),
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
        <span className="ml-auto text-xs text-gray-400">배점 {maxPoints}점</span>
      </div>

      {/* 문제 */}
      <div className="mb-4">
        <p className="text-xs font-bold text-gray-500 mb-1.5">과제</p>
        <p className="text-sm text-gray-800 bg-gray-50 rounded-xl px-4 py-3">{q?.content}</p>
      </div>

      {/* 오디오 + AI 평가 버튼 */}
      {audioUrl?.startsWith('http') ? (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-bold text-gray-500">학생 녹음</p>
            <button onClick={aiEvaluate} disabled={evaluating}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg text-xs font-bold disabled:opacity-60 transition">
              {evaluating
                ? <><Loader2 size={12} className="animate-spin" /> 평가 중...</>
                : <><Sparkles size={12} /> AI 평가 후 자동 입력</>
              }
            </button>
          </div>
          <audio controls src={audioUrl} className="w-full rounded-xl" />
        </div>
      ) : (
        <div className="mb-4 bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm text-amber-700 text-center">
          녹음이 제출되지 않았습니다 — 루브릭을 직접 선택하여 채점할 수 있습니다
        </div>
      )}

      {/* AI 평가 결과 요약 */}
      {evalResult && (
        <div className="mb-4 bg-purple-50 border border-purple-100 rounded-xl p-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-purple-700">🤖 AI 평가 (참고용)</p>
            <span className="text-sm font-black text-purple-700">{evalResult.totalScore}/100</span>
          </div>
          <p className="text-xs text-gray-600">{evalResult.feedback}</p>
          {evalResult.improvements && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1">📈 {evalResult.improvements}</p>
          )}
          <p className="text-xs text-purple-500">루브릭 점수가 자동 입력되었습니다 — 수정 후 저장하세요</p>
        </div>
      )}

      {evalError && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 break-all">
          <p className="font-bold mb-1">⚠️ AI 평가 오류</p>
          <p>{evalError}</p>
        </div>
      )}

      {/* 루브릭 채점 */}
      <div className="border border-gray-100 rounded-xl overflow-hidden mb-4">
        <div className="bg-gray-50 px-4 py-2 flex items-center justify-between">
          <span className="text-xs font-bold text-gray-600">루브릭 채점</span>
          <span className="text-xs text-gray-400">각 항목 1~4점 선택</span>
        </div>
        <div className="divide-y divide-gray-50">
          {SPEAKING_RUBRIC.map(({ key, label, desc }) => (
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

      {/* 환산 점수 + 저장 */}
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-gray-50 rounded-xl px-4 py-2.5">
          <span className="text-xs text-gray-400">환산 점수: </span>
          <span className={`text-sm font-black ${allFilled ? 'text-blue-600' : 'text-gray-300'}`}>
            {allFilled ? `${computedScore} / ${maxPoints}점` : '항목을 모두 선택하세요'}
          </span>
          {allFilled && (
            <span className="text-xs text-gray-400 ml-2">
              ({rubricTotal}/{rubricMax} → {Math.round(computedScore / maxPoints * 100)}%)
            </span>
          )}
        </div>
        <button onClick={saveGrade} disabled={!allFilled || saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white rounded-xl text-sm font-bold transition">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={16} />}
          채점 완료
        </button>
      </div>

      {allFilled && (
        <p className="mt-2 text-xs text-gray-400 text-right">
          구 TOEFL 참고: {mapToOldToeflScore(computedScore / maxPoints * 6.0)}
        </p>
      )}
    </div>
  )
}
