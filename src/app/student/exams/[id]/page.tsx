'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, ChevronRight, CheckSquare, Clock } from 'lucide-react'
import { renderWithUnderlines, usesAlphaOptions, optionLabel, DEFAULT_TIME_LIMITS, AUDIO_BUFFER, getMaxScore, calculateSectionBand, calculateOverallBand, CATEGORY_LABELS } from '@/lib/utils'
import AudioPlayer from '@/components/ui/AudioPlayer'
import SpeakingRecorder from '@/components/ui/SpeakingRecorder'
import BuildASentencePlayer from '@/components/ui/BuildASentencePlayer'
import FillBlankPlayer from '@/components/ui/FillBlankPlayer'
import EmailPassageRenderer from '@/components/ui/EmailPassageRenderer'
import SentenceCompletionPlayer from '@/components/ui/SentenceCompletionPlayer'

const SECTION_BADGE: Record<string, { bg: string; text: string }> = {
  reading:   { bg: 'bg-blue-100',    text: 'text-blue-700' },
  listening: { bg: 'bg-indigo-100',  text: 'text-indigo-700' },
  writing:   { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  speaking:  { bg: 'bg-amber-100',   text: 'text-amber-700' },
}

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
  explanation?: string | null
  email_to?: string | null
  email_subject?: string | null
  passage_group_id?: string | null  // 세트 문제 그룹 ID
}

export default function ExamTakePage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const examId = params.id as string
  const supabase = createClient()
  const deploymentId = searchParams.get('deployment')

  const [exam, setExam] = useState<{ title: string; time_limit: number | null } | null>(null)
  const [maxBandCeiling, setMaxBandCeiling] = useState<number>(6.0)
  const [questions, setQuestions] = useState<Question[]>([])
  const [current, setCurrent] = useState(() => {
    try {
      const saved = localStorage.getItem(`exam_${params.id}_current`)
      return saved !== null ? parseInt(saved) : 0
    } catch { return 0 }
  })
  const [timeLeft, setTimeLeft] = useState<number | null>(null)       // 시험 전체 타이머
  const [questionTimeLeft, setQuestionTimeLeft] = useState<number | null>(null) // 문제별 타이머
  const [qTimes, setQTimes] = useState<Record<string, number>>({})   // 문제별/세트별 남은 시간 저장
  const [audioReady, setAudioReady] = useState<Set<string>>(new Set()) // 오디오 재생 완료된 문제 ID
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submissionId, setSubmissionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  // 리스닝 재생 횟수 추적
  const [playedCounts, setPlayedCounts] = useState<Record<string, number>>({})

  // localStorage 헬퍼
  const lsKey = (k: string) => `exam_${examId}_${k}`
  const lsGet = (k: string) => { try { return localStorage.getItem(lsKey(k)) } catch { return null } }
  const lsSet = (k: string, v: string) => { try { localStorage.setItem(lsKey(k), v) } catch {} }
  const lsDel = (k: string) => { try { localStorage.removeItem(lsKey(k)) } catch {} }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      // exam + questions는 adminClient API로 조회 (RLS 우회)
      const res = await fetch(`/api/student/exam/${examId}`)
      if (!res.ok) { setLoading(false); return }
      const { exam: examData, examQuestions } = await res.json()

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
        // 새 시험 시작 — 이전 localStorage 초기화
        lsDel('timeLeft'); lsDel('qTimes'); lsDel('current'); lsDel('audioReady')
        const { data: newSub } = await supabase.from('submissions').insert({
          exam_id: examId,
          student_id: user.id,
          deployment_id: deploymentId ?? null,
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

      // 전체 시간 = 각 문제 time_limit + 오디오 버퍼 합계 (localStorage 복원 우선)
      const totalTime = qs.reduce((sum, q) => {
        const base = q.time_limit ?? DEFAULT_TIME_LIMITS[q.question_subtype ?? ''] ?? 0
        const buffer = AUDIO_BUFFER[q.question_subtype ?? ''] ?? 0
        return sum + base + buffer
      }, 0)
      const savedTimeLeft = lsGet('timeLeft')
      setTimeLeft(savedTimeLeft !== null ? parseInt(savedTimeLeft) : (totalTime > 0 ? totalTime : null))

      // 문제별 남은 시간 복원
      const savedQTimes = lsGet('qTimes')
      if (savedQTimes) setQTimes(JSON.parse(savedQTimes))

      // 오디오 재생 완료 문제 복원
      const savedAudioReady = lsGet('audioReady')
      if (savedAudioReady) setAudioReady(new Set(JSON.parse(savedAudioReady)))

      // 마지막으로 보던 문제 복원
      const savedCurrent = lsGet('current')
      if (savedCurrent !== null) setCurrent(parseInt(savedCurrent))

      setLoading(false)
    }
    load().catch(() => setLoading(false))
  }, [examId])

  // 전체 타이머 — 매초 localStorage 동기화
  useEffect(() => {
    if (timeLeft === null) return
    if (timeLeft <= 0) { handleSubmit(); return }
    lsSet('timeLeft', String(timeLeft))
    const t = setTimeout(() => setTimeLeft(t => (t ?? 1) - 1), 1000)
    return () => clearTimeout(t)
  }, [timeLeft])

  // 문제별 타이머 — 문제 변경 시 저장된 시간 또는 full limit으로 설정 (세트 문제는 합산 타이머)
  useEffect(() => {
    if (questions.length === 0) return
    const q = questions[current]
    lsSet('current', String(current))

    // 세트 문제 여부 확인 (passage_group_id 있는 경우)
    const groupId = q.passage_group_id
    const timerKey = groupId ? `set_${groupId}` : q.id

    // 세트 타이머 limit: 그룹의 모든 문제 time_limit 합산
    let limit: number | null
    if (groupId) {
      const groupQs = questions.filter(gq => gq.passage_group_id === groupId)
      const total = groupQs.reduce((sum, gq) => {
        return sum + (gq.time_limit ?? DEFAULT_TIME_LIMITS[gq.question_subtype ?? ''] ?? 0)
      }, 0)
      limit = total > 0 ? total : null
    } else {
      limit = q.time_limit ?? DEFAULT_TIME_LIMITS[q.question_subtype ?? ''] ?? null
    }

    const hasAudio = (q.category === 'listening' || q.category === 'speaking') && (q.audio_url || q.audio_script)

    if (hasAudio && !audioReady.has(q.id)) {
      // 오디오가 있고 아직 재생 안 됨 → 타이머 대기
      setQuestionTimeLeft(null)
    } else {
      // localStorage에서 직접 읽어 stale closure 방지
      let saved: number | undefined
      const savedStr = lsGet('qTimes')
      if (savedStr) {
        try { saved = JSON.parse(savedStr)[timerKey] } catch {}
      }
      setQuestionTimeLeft(saved !== undefined ? saved : limit)
    }
  }, [current, questions, audioReady])

  // 문제별 타이머 카운트다운 + 매초 qTimes 저장
  useEffect(() => {
    if (questionTimeLeft === null) return
    if (questionTimeLeft <= 0) {
      if (current < questions.length - 1) setCurrent(c => c + 1)
      return
    }
    // 현재 문제의 남은 시간을 qTimes에 저장 (세트는 set_groupId 키 사용)
    if (questions.length > 0) {
      const cq = questions[current]
      if (cq) {
        const saveKey = cq.passage_group_id ? `set_${cq.passage_group_id}` : cq.id
        setQTimes(prev => {
          const updated = { ...prev, [saveKey]: questionTimeLeft }
          lsSet('qTimes', JSON.stringify(updated))
          return updated
        })
      }
    }
    const t = setTimeout(() => setQuestionTimeLeft(t => (t ?? 1) - 1), 1000)
    return () => clearTimeout(t)
  }, [questionTimeLeft])

  // 오디오 재생 완료 → 타이머 시작
  function handleAudioEnded(questionId: string) {
    setAudioReady(prev => {
      const next = new Set(prev)
      next.add(questionId)
      lsSet('audioReady', JSON.stringify([...next]))
      return next
    })
    // 해당 문제가 현재 문제이면 타이머 시작 (localStorage에서 직접 읽어 stale closure 방지)
    if (questions[current]?.id === questionId) {
      const q = questions[current]
      const groupId = q.passage_group_id
      const timerKey = groupId ? `set_${groupId}` : q.id
      let limit: number | null
      if (groupId) {
        const groupQs = questions.filter(gq => gq.passage_group_id === groupId)
        const total = groupQs.reduce((s, gq) => s + (gq.time_limit ?? DEFAULT_TIME_LIMITS[gq.question_subtype ?? ''] ?? 0), 0)
        limit = total > 0 ? total : null
      } else {
        limit = q.time_limit ?? DEFAULT_TIME_LIMITS[q.question_subtype ?? ''] ?? null
      }
      let saved: number | undefined
      const savedStr = lsGet('qTimes')
      if (savedStr) { try { saved = JSON.parse(savedStr)[timerKey] } catch {} }
      setQuestionTimeLeft(saved !== undefined ? saved : limit)
    }
  }

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
    // 제출 시 localStorage 정리
    lsDel('timeLeft'); lsDel('qTimes'); lsDel('current'); lsDel('audioReady')

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
        if (isFillBlank) {
          // Partial Credit: 정답 개수 비율로 점수 계산
          const correct = (q.answer ?? '').split(',').map(a => a.trim().toLowerCase())
          const student = studentAns.split(',').map(a => a.trim().toLowerCase())
          const correctCount = correct.filter((c, i) => c === student[i]).length
          isCorrect = correctCount === correct.length
          earnedScore = correct.length > 0
            ? Math.round((correctCount / correct.length) * maxScore * 10) / 10
            : 0
        } else {
          isCorrect = q.answer?.trim().toLowerCase() === studentAns.trim().toLowerCase()
          earnedScore = isCorrect ? maxScore : 0
        }
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

    setSubmitting(false)
    setSubmitted(true)
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen text-gray-400">로딩 중...</div>

  if (submitted) return (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-50 px-6">
      <div className="text-center animate-[fadeInUp_0.6s_ease-out]">
        <div className="text-7xl mb-6 animate-[bounceIn_0.8s_ease-out]">🎉</div>
        <h1 className="text-3xl font-black text-gray-900 mb-3">수고하셨습니다!</h1>
        <p className="text-gray-500 text-base mb-2">시험이 성공적으로 제출되었습니다.</p>
        <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 mb-8">
          ✍️ Writing · Speaking 문제는 선생님 채점 후 결과가 반영됩니다.
        </p>
        <button
          onClick={() => router.push('/student/dashboard')}
          className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-base transition shadow-lg"
        >
          확인
        </button>
      </div>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(30px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes bounceIn {
          0%   { transform: scale(0.3); opacity: 0; }
          50%  { transform: scale(1.15); opacity: 1; }
          80%  { transform: scale(0.95); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  )

  const q = questions[current]
  const answeredCount = Object.keys(answers).filter(k => answers[k]).length
  const minutes = timeLeft !== null ? Math.floor(timeLeft / 60) : null
  const seconds = timeLeft !== null ? timeLeft % 60 : null

  const isListening = q?.category === 'listening'
  const isSpeaking = q?.category === 'speaking'
  const isInterview = q?.question_subtype === 'take_an_interview'
  const isFirstInInterviewBlock = isInterview && (
    current === 0 ||
    questions[current - 1]?.question_subtype !== 'take_an_interview' ||
    questions[current - 1]?.passage !== q?.passage
  )

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
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* 섹션 헤더 */}
                {q.category && (() => {
                  const style = SECTION_BADGE[q.category]
                  const label = CATEGORY_LABELS[q.category] ?? q.category
                  return style ? (
                    <div className={`px-6 py-2.5 ${style.bg}`}>
                      <span className={`text-sm font-extrabold ${style.text} uppercase tracking-widest`}>{label}</span>
                    </div>
                  ) : null
                })()}
                <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-purple-600 uppercase tracking-widest">
                      문제 {q.order_num} / {questions.length}
                    </span>
                    {isListening && (
                      <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">🎧 리스닝</span>
                    )}
                    {isSpeaking && !isInterview && (
                      <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">🎤 스피킹</span>
                    )}
                    {isInterview && (
                      <span className="text-xs font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">🎤 인터뷰</span>
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

                {/* 리스닝/스피킹: 오디오 플레이어 (audio_url 또는 audio_script 중 하나만 있어도 표시) */}
                {(isListening || isSpeaking) && (q.audio_url || q.audio_script) && (
                  <div className="mb-5">
                    <AudioPlayer
                      key={q.id}
                      audioUrl={q.audio_url}
                      script={q.audio_script}
                      playLimit={q.audio_play_limit ?? 1}
                      initialPlayCount={playedCounts[q.id] ?? 0}
                      onPlayed={(count) => setPlayedCounts(prev => ({ ...prev, [q.id]: count }))}
                      onEnded={() => handleAudioEnded(q.id)}
                      disableStop={isListening}
                    />
                  </div>
                )}

                {/* 인터뷰 세트 소개 — 첫 질문에만 표시 */}
                {isFirstInInterviewBlock && q.passage && (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-5">
                    <p className="text-xs font-bold text-orange-600 uppercase tracking-wide mb-1">🎤 인터뷰</p>
                    <p className="text-sm font-semibold text-orange-900">{q.passage}</p>
                  </div>
                )}

                {/* 지문 (fill-blank JSON 타입은 별도 렌더링, take_an_interview는 위에서 처리, email_writing은 passage=한글번역이라 숨김) */}
                {q.passage && q.question_subtype !== 'complete_the_words' && q.question_subtype !== 'sentence_completion' && q.question_subtype !== 'email_writing' && !isInterview && (
                  q.question_subtype === 'daily_life_email' || q.question_subtype === 'daily_life_campus_email' ? (
                    <div className="mb-5">
                      <EmailPassageRenderer text={q.passage} />
                    </div>
                  ) : (
                    <div className="bg-blue-50 border-l-4 border-blue-400 rounded-r-xl p-4 text-sm text-gray-700 leading-7 mb-5">
                      {renderWithUnderlines(q.passage)}
                    </div>
                  )
                )}

                {/* take_an_interview: 오디오 없으면 speaking_prompt 텍스트로 폴백 */}
                {isInterview && !q.audio_url && q.speaking_prompt && (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-5">
                    <p className="text-xs font-semibold text-orange-600 mb-1">면접 질문</p>
                    <p className="text-base font-semibold text-gray-900">{q.speaking_prompt}</p>
                  </div>
                )}

                {/* 문제 본문 (sentence_reordering / fill-blank는 별도 처리, take_an_interview는 오디오로만 전달, email_writing은 아래 별도 렌더링) */}
                {q.question_subtype !== 'sentence_reordering' && q.question_subtype !== 'complete_the_words' && q.question_subtype !== 'sentence_completion' && q.question_subtype !== 'email_writing' && !isInterview && (
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
                      return (
                        <SentenceCompletionPlayer
                          content={raw ?? ''}
                          value={answers[q.id] ?? ''}
                          onChange={(v) => saveAnswer(q.id, v)}
                        />
                      )
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
                ) : q.question_subtype === 'email_writing' ? (
                  /* Email Writing — 새 디자인 */
                  (() => {
                    const lines = q.content.split('\n')
                    const mustIdx = lines.findIndex(l => /your email must include|in your email|do the following/i.test(l))
                    const scenario = mustIdx > 0 ? lines.slice(0, mustIdx).join('\n').trim() : ''
                    const remaining = mustIdx >= 0 ? lines.slice(mustIdx) : lines
                    const bullets = remaining.filter(l => l.trim().startsWith('•') || l.trim().startsWith('-'))
                    const mustLabel = remaining.find(l => /your email must include|in your email|do the following/i.test(l))?.trim() ?? 'In your email, you MUST:'
                    return (
                      <div className="space-y-4 mb-5">
                        {/* 시나리오 — 일반 텍스트 */}
                        {scenario && (
                          <p className="text-base font-semibold text-gray-900 leading-7">{scenario}</p>
                        )}
                        {/* MUST 체크리스트 */}
                        {bullets.length > 0 && (
                          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                            <p className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-1.5">
                              <span>☑</span> {mustLabel}
                            </p>
                            <ul className="space-y-1">
                              {bullets.map((b, i) => (
                                <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                                  <span className="text-blue-500 mt-0.5">•</span>
                                  <span>{b.replace(/^[•\-]\s*/, '')}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {/* 이메일 답안 영역 */}
                        <div className="border border-gray-200 rounded-2xl overflow-hidden">
                          {(q.email_to || q.email_subject) && (
                            <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 space-y-1">
                              {q.email_to && (
                                <p className="text-sm text-gray-500">To: <span className="font-bold text-gray-900">{q.email_to}</span></p>
                              )}
                              {q.email_subject && (
                                <p className="text-sm text-gray-500">Subject: <span className="font-bold text-gray-900">{q.email_subject}</span></p>
                              )}
                            </div>
                          )}
                          <textarea
                            value={answers[q.id] ?? ''}
                            onChange={e => saveAnswer(q.id, e.target.value)}
                            placeholder={q.email_to ? `Dear ${q.email_to.split(',')[0].trim()},\n\n` : '여기에 이메일을 작성하세요...'}
                            rows={8}
                            className="w-full px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                          />
                        </div>
                      </div>
                    )
                  })()
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
              </div>
            )}
          </div>

          {/* 문제 번호 그리드 */}
          <div className="w-full md:w-44 flex-shrink-0">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs font-bold text-gray-400 mb-3">문제 현황</p>
              {(() => {
                // 섹션별로 그룹핑
                const sectionOrder = ['reading', 'listening', 'writing', 'speaking']
                const groups: Record<string, { q: Question; i: number }[]> = {}
                questions.forEach((q2, i) => {
                  const cat = q2.category ?? 'other'
                  if (!groups[cat]) groups[cat] = []
                  groups[cat].push({ q: q2, i })
                })
                const orderedKeys = [
                  ...sectionOrder.filter(k => groups[k]),
                  ...Object.keys(groups).filter(k => !sectionOrder.includes(k)),
                ]
                return orderedKeys.map(cat => {
                  const style = SECTION_BADGE[cat]
                  const label = CATEGORY_LABELS[cat] ?? cat
                  return (
                    <div key={cat} className="mb-3">
                      <p className={`text-xs font-bold mb-1.5 ${style?.text ?? 'text-gray-500'}`}>{label}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {groups[cat].map(({ q: q2, i }) => (
                          <button key={i} onClick={() => setCurrent(i)}
                            className={`w-7 h-7 flex-shrink-0 rounded-md text-xs font-bold border-2 transition ${
                              i === current ? 'bg-purple-600 border-purple-600 text-white' :
                              answers[q2.id] ? 'bg-blue-50 border-blue-400 text-blue-700' :
                              'bg-white border-gray-200 text-gray-400 hover:border-gray-300'
                            }`}>
                            {i + 1}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })
              })()}
              <div className="mt-2 space-y-1 text-xs text-gray-400">
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
