'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, ChevronRight, CheckSquare, Clock } from 'lucide-react'
import { renderWithUnderlines, usesAlphaOptions, optionLabel, DEFAULT_TIME_LIMITS, getMaxScore, calculateSectionBand, calculateOverallBand } from '@/lib/utils'
import AudioPlayer from '@/components/ui/AudioPlayer'
import SpeakingRecorder from '@/components/ui/SpeakingRecorder'
import BuildASentencePlayer from '@/components/ui/BuildASentencePlayer'
import FillBlankPlayer from '@/components/ui/FillBlankPlayer'

interface Question {
  id: string
  type: string
  content: string
  passage: string | null
  options: { num: number; text: string }[] | null
  answer: string
  category: string
  difficulty: number          // 난이도 가중치 기반 채점에 사용
  points: number
  order_num: number
  question_subtype?: string | null
  // 리스닝/스피킹
  audio_url?: string | null
  audio_script?: string | null
  audio_play_limit?: number | null
  speaking_prompt?: string | null
  time_limit?: number | null
}

export default function ExamTakePage() {
  const router = useRouter()
  const params = useParams()
  const examId = params.id as string
  const supabase = createClient()

  const [exam, setExam] = useState<{ title: string; time_limit: number | null } | null>(null)
  const [maxBandCeiling, setMaxBandCeiling] = useState<number>(6.0)
  const [questions, setQuestions] = useState<Question[]>([])
  const [current, setCurrent] = useState(0)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)       // 시험 전체 타이머
  const [questionTimeLeft, setQuestionTimeLeft] = useState<number | null>(null) // 문제별 타이머
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submissionId, setSubmissionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  // 리스닝 재생 횟수 추적
  const [playedCounts, setPlayedCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      const [{ data: examData }, { data: examQuestions }] = await Promise.all([
        supabase.from('exams').select('title, time_limit, max_band_ceiling').eq('id', examId).single(),
        supabase.from('exam_questions')
          .select('question_id, order_num, points, questions(*)')
          .eq('exam_id', examId)
          .order('order_num'),
      ])

      setExam(examData)
      if (examData?.max_band_ceiling) setMaxBandCeiling(examData.max_band_ceiling)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const qs: Question[] = (examQuestions ?? []).map((eq: any) => ({
        ...eq.questions,
        points: eq.points,
        order_num: eq.order_num,
      }))
      setQuestions(qs)

      // 기존 제출 찾기 or 새로 생성
      let { data: sub } = await supabase
        .from('submissions')
        .select('id')
        .eq('exam_id', examId)
        .eq('student_id', user.id)
        .single()

      if (!sub) {
        const { data: newSub } = await supabase.from('submissions').insert({
          exam_id: examId,
          student_id: user.id,
          status: 'in_progress',
        }).select('id').single()
        sub = newSub
      }

      if (sub) setSubmissionId(sub.id)

      // 기존 답안 불러오기
      const { data: existingAnswers } = await supabase
        .from('submission_answers')
        .select('question_id, student_answer')
        .eq('submission_id', sub?.id)

      const ansMap: Record<string, string> = {}
      for (const a of existingAnswers ?? []) {
        ansMap[a.question_id] = a.student_answer ?? ''
      }
      setAnswers(ansMap)

      if (examData?.time_limit) setTimeLeft(examData.time_limit * 60)
      setLoading(false)
    }
    load().catch(() => setLoading(false))
  }, [examId])

  // 시험 전체 타이머
  useEffect(() => {
    if (timeLeft === null) return
    if (timeLeft <= 0) { handleSubmit(); return }
    const t = setTimeout(() => setTimeLeft(t => (t ?? 1) - 1), 1000)
    return () => clearTimeout(t)
  }, [timeLeft])

  // 문제별 타이머 — 문제 변경 시 리셋
  useEffect(() => {
    if (questions.length === 0) return
    const q = questions[current]
    const limit = q.time_limit ?? DEFAULT_TIME_LIMITS[q.question_subtype ?? ''] ?? null
    setQuestionTimeLeft(limit)
  }, [current, questions])

  useEffect(() => {
    if (questionTimeLeft === null || questionTimeLeft <= 0) {
      if (questionTimeLeft === 0 && current < questions.length - 1) {
        setCurrent(c => c + 1)
      }
      return
    }
    const t = setTimeout(() => setQuestionTimeLeft(t => (t ?? 1) - 1), 1000)
    return () => clearTimeout(t)
  }, [questionTimeLeft])

  const saveAnswer = useCallback(async (questionId: string, answer: string) => {
    if (!submissionId) return
    setAnswers(prev => ({ ...prev, [questionId]: answer }))
    await supabase.from('submission_answers').upsert({
      submission_id: submissionId,
      question_id: questionId,
      student_answer: answer,
    }, { onConflict: 'submission_id,question_id' })
  }, [submissionId])

  async function handleSubmit() {
    if (!submissionId || submitting) return
    setSubmitting(true)

    const { data: { user } } = await supabase.auth.getUser()

    // ── Step 1: 문제별 earned_score 계산 + submission_answers 저장 ──────────
    const earnedByQuestion: Record<string, number> = {}
    const updates = []

    for (const q of questions) {
      const studentAns = answers[q.id] ?? ''
      const isFillBlank = q.question_subtype === 'complete_the_words' || q.question_subtype === 'sentence_completion'
      const isWordTile = q.question_subtype === 'sentence_reordering'
      const isAutoGraded = (q.type === 'multiple_choice' || q.type === 'short_answer' || isFillBlank || isWordTile) && q.category !== 'speaking'

      const maxScore = getMaxScore(q.question_subtype)
      let isCorrect = false
      let earnedScore = 0

      if (isAutoGraded) {
        isCorrect = isFillBlank
          ? (() => {
              const correct = (q.answer ?? '').split(',').map(a => a.trim().toLowerCase())
              const student = studentAns.split(',').map(a => a.trim().toLowerCase())
              return correct.length > 0 && correct.every((c, i) => c === student[i])
            })()
          : q.answer?.trim().toLowerCase() === studentAns.trim().toLowerCase()
        earnedScore = isCorrect ? maxScore : 0
      }

      earnedByQuestion[q.id] = earnedScore

      updates.push(supabase.from('submission_answers').upsert({
        submission_id: submissionId,
        question_id: q.id,
        student_answer: studentAns,
        is_correct: isAutoGraded ? isCorrect : null,
        score: isAutoGraded ? earnedScore : null,
      }, { onConflict: 'submission_id,question_id' }))

      if (!isCorrect && isAutoGraded && user) {
        await supabase.from('wrong_answer_queue').upsert({
          student_id: user.id,
          original_question_id: q.id,
          next_review_at: new Date().toISOString(),
        }, { onConflict: 'student_id,original_question_id' })
      }
    }

    await Promise.all(updates)

    // ── Step 2: 섹션별 밴드 계산 ──────────────────────────────────────────────
    const cats = ['reading', 'listening', 'writing', 'speaking'] as const
    const sectionBands: Record<string, number | null> = { reading: null, listening: null, writing: null, speaking: null }

    for (const cat of cats) {
      const qs = questions.filter(q => q.category === cat)
      if (qs.length === 0) continue
      const earned = qs.reduce((s, q) => s + (earnedByQuestion[q.id] ?? 0), 0)
      const max = qs.reduce((s, q) => s + getMaxScore(q.question_subtype), 0)
      sectionBands[cat] = calculateSectionBand(earned, max, maxBandCeiling)
    }

    // ── Step 3: 통합 밴드 (자동채점 완료된 섹션만 포함) ───────────────────────
    const overallBand = calculateOverallBand(Object.values(sectionBands))

    // 영역별 실력 통계 업데이트 (객관식 + 단답형)
    for (const q of questions.filter(q => (q.type === 'multiple_choice' || q.type === 'short_answer') && q.category !== 'speaking')) {
      await fetch('/api/stats/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: q.category,
          isCorrect: q.answer?.trim().toLowerCase() === (answers[q.id] ?? '').trim().toLowerCase(),
        }),
      })
    }

    const hasNonAutoGraded = questions.some(q => {
      const sub = q.question_subtype
      const isAutoSub = sub === 'sentence_reordering' || sub === 'complete_the_words' || sub === 'sentence_completion'
      return (q.type === 'essay' && q.category !== 'speaking' && !isAutoSub) || q.category === 'speaking'
    })

    await supabase.from('submissions').update({
      status: hasNonAutoGraded ? 'submitted' : 'graded',
      reading_band:   sectionBands.reading,
      listening_band: sectionBands.listening,
      writing_band:   sectionBands.writing,
      speaking_band:  sectionBands.speaking,
      overall_band:   overallBand > 0 ? overallBand : null,
      submitted_at:   new Date().toISOString(),
    }).eq('id', submissionId)

    router.push(`/student/exams/${examId}/result`)
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen text-gray-400">로딩 중...</div>

  const q = questions[current]
  const answeredCount = Object.keys(answers).filter(k => answers[k]).length
  const minutes = timeLeft !== null ? Math.floor(timeLeft / 60) : null
  const seconds = timeLeft !== null ? timeLeft % 60 : null

  const isListening = q?.category === 'listening'
  const isSpeaking = q?.category === 'speaking'

  return (
    <div className="min-h-screen bg-slate-50 p-3 md:p-5 pt-16 md:pt-5">
      {/* 상단 헤더 */}
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center justify-between mb-5">
          <div>
            <h1 className="font-bold text-gray-900">{exam?.title}</h1>
            <p className="text-xs text-gray-400">{answeredCount}/{questions.length}문제 답변 완료</p>
          </div>
          {timeLeft !== null && (
            <div className={`flex items-center gap-1.5 text-2xl font-black tabular-nums ${timeLeft < 300 ? 'text-red-500' : 'text-gray-900'}`}>
              <Clock size={18} className={timeLeft < 300 ? 'text-red-400' : 'text-gray-400'} />
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </div>
          )}
        </div>

        <div className="flex flex-col md:flex-row gap-5">
          {/* 문제 영역 */}
          <div className="flex-1">
            {q && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-purple-600 uppercase tracking-widest">
                      문제 {q.order_num} / {questions.length} · {q.points}점
                    </span>
                    {isListening && (
                      <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">🎧 리스닝</span>
                    )}
                    {isSpeaking && (
                      <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">🎤 스피킹</span>
                    )}
                  </div>
                  {/* 문제별 카운트다운 타이머 */}
                  {questionTimeLeft !== null && (
                    <div className={`flex items-center gap-1 text-sm font-extrabold tabular-nums px-3 py-1 rounded-xl ${
                      questionTimeLeft <= 10
                        ? 'bg-red-100 text-red-600 animate-pulse'
                        : questionTimeLeft <= 30
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      <Clock size={13} />
                      {questionTimeLeft >= 60
                        ? `${Math.floor(questionTimeLeft / 60)}:${String(questionTimeLeft % 60).padStart(2, '0')}`
                        : `${questionTimeLeft}초`}
                    </div>
                  )}
                </div>

                {/* 리스닝: 오디오 플레이어 */}
                {isListening && (q.audio_url || q.audio_script) && (
                  <div className="mb-5">
                    <AudioPlayer
                      audioUrl={q.audio_url}
                      script={q.audio_script}
                      playLimit={q.audio_play_limit ?? 3}
                      onPlayed={(count) => setPlayedCounts(prev => ({ ...prev, [q.id]: count }))}
                    />
                  </div>
                )}

                {/* 지문 (fill-blank JSON 타입은 별도 렌더링) */}
                {q.passage && q.question_subtype !== 'complete_the_words' && q.question_subtype !== 'sentence_completion' && (
                  <div className="bg-blue-50 border-l-4 border-blue-400 rounded-r-xl p-4 text-sm text-gray-700 leading-7 mb-5">
                    {renderWithUnderlines(q.passage)}
                  </div>
                )}

                {/* 문제 본문 (sentence_reordering / fill-blank는 별도 처리) */}
                {q.question_subtype !== 'sentence_reordering' && q.question_subtype !== 'complete_the_words' && q.question_subtype !== 'sentence_completion' && (
                  <p className="text-base font-semibold text-gray-900 leading-7 mb-5">
                    {renderWithUnderlines(q.content)}
                  </p>
                )}

                {/* 스피킹: 녹음 컴포넌트 */}
                {isSpeaking ? (
                  <SpeakingRecorder
                    prompt={q.speaking_prompt ?? q.content}
                    questionId={q.id}
                    submissionId={submissionId}
                    onRecorded={(audioUrl) => {
                      saveAnswer(q.id, audioUrl)
                    }}
                  />
                ) : q.question_subtype === 'sentence_reordering' && q.options ? (
                  /* Build a Sentence — 워드 타일 클릭 UI */
                  <BuildASentencePlayer
                    personAQuestion={q.content}
                    wordTiles={q.options}
                    value={answers[q.id] ?? ''}
                    onChange={(answer) => saveAnswer(q.id, answer)}
                  />
                ) : (q.question_subtype === 'complete_the_words' || q.question_subtype === 'sentence_completion') ? (
                  /* Fill-blank — 빈칸 채우기 */
                  (() => {
                    const raw = q.passage || q.content
                    try {
                      const tokens = JSON.parse(raw)
                      return (
                        <div className="bg-gray-50 rounded-xl p-4">
                          <FillBlankPlayer
                            tokens={tokens}
                            subtype={q.question_subtype}
                            value={answers[q.id] ?? ''}
                            onChange={(v) => saveAnswer(q.id, v)}
                          />
                        </div>
                      )
                    } catch {
                      return <textarea value={answers[q.id] ?? ''} onChange={e => saveAnswer(q.id, e.target.value)} rows={4} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                    }
                  })()
                ) : q.type === 'multiple_choice' && q.options ? (
                  /* 객관식 보기 */
                  <div className="space-y-2.5">
                    {(() => { const alpha = usesAlphaOptions(q.category, q.question_subtype); return q.options!.map(opt => (
                      <button
                        key={opt.num}
                        onClick={() => saveAnswer(q.id, String(opt.num))}
                        className={`w-full flex items-start gap-3 p-4 rounded-xl border-2 text-left transition ${
                          answers[q.id] === String(opt.num)
                            ? 'border-purple-500 bg-purple-50 text-purple-900'
                            : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                        }`}
                      >
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                          answers[q.id] === String(opt.num) ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'
                        }`}>{optionLabel(opt.num, alpha)}</span>
                        <span className="text-sm">{opt.text}</span>
                      </button>
                    ))})()}</div>
                ) : (
                  /* 서술형/단답형 */
                  <textarea
                    value={answers[q.id] ?? ''}
                    onChange={e => saveAnswer(q.id, e.target.value)}
                    placeholder="답안을 입력하세요..."
                    rows={5}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                )}

                {/* 이전/다음 버튼 */}
                <div className="flex justify-between mt-6">
                  <button onClick={() => setCurrent(c => Math.max(0, c - 1))} disabled={current === 0}
                    className="flex items-center gap-1 px-4 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition">
                    <ChevronLeft size={16} /> 이전
                  </button>
                  {current < questions.length - 1 ? (
                    <button onClick={() => setCurrent(c => Math.min(questions.length - 1, c + 1))}
                      className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition">
                      다음 <ChevronRight size={16} />
                    </button>
                  ) : (
                    <button onClick={handleSubmit} disabled={submitting}
                      className="flex items-center gap-2 px-5 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-60 transition">
                      <CheckSquare size={16} /> {submitting ? '제출 중...' : '시험 제출'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 문제 번호 그리드 */}
          <div className="w-full md:w-44 flex-shrink-0">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs font-bold text-gray-400 mb-3">문제 현황</p>
              <div className="grid grid-cols-5 gap-1.5">
                {questions.map((q2, i) => (
                  <button key={i} onClick={() => setCurrent(i)}
                    className={`aspect-square rounded-lg text-xs font-bold border-2 transition ${
                      i === current ? 'bg-purple-600 border-purple-600 text-white' :
                      answers[q2.id] ? 'bg-blue-50 border-blue-400 text-blue-700' :
                      'bg-white border-gray-200 text-gray-400 hover:border-gray-300'
                    }`}>
                    {i + 1}
                  </button>
                ))}
              </div>
              <div className="mt-3 space-y-1 text-xs text-gray-400">
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-100 border border-blue-400 inline-block" />답변 완료</div>
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-purple-600 inline-block" />현재 문제</div>
              </div>
              <button onClick={handleSubmit} disabled={submitting}
                className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold py-2.5 rounded-xl text-sm transition">
                제출하기
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
