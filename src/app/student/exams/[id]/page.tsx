'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, ChevronRight, CheckSquare, Clock } from 'lucide-react'
import { renderWithUnderlines } from '@/lib/utils'

interface Question {
  id: string
  type: string
  content: string
  passage: string | null
  options: { num: number; text: string }[] | null
  answer: string
  category: string
  points: number
  order_num: number
}

export default function ExamTakePage() {
  const router = useRouter()
  const params = useParams()
  const examId = params.id as string
  const supabase = createClient()

  const [exam, setExam] = useState<{ title: string; time_limit: number | null } | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submissionId, setSubmissionId] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      const [{ data: examData }, { data: examQuestions }] = await Promise.all([
        supabase.from('exams').select('title, time_limit').eq('id', examId).single(),
        supabase.from('exam_questions')
          .select('question_id, order_num, points, questions(*)')
          .eq('exam_id', examId)
          .order('order_num'),
      ])

      setExam(examData)

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

  // 타이머
  useEffect(() => {
    if (timeLeft === null) return
    if (timeLeft <= 0) { handleSubmit(); return }
    const t = setTimeout(() => setTimeLeft(t => (t ?? 1) - 1), 1000)
    return () => clearTimeout(t)
  }, [timeLeft])

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

    // 객관식 자동 채점
    let score = 0
    const { data: { user } } = await supabase.auth.getUser()
    const updates = []
    for (const q of questions) {
      const studentAns = answers[q.id] ?? ''
      const isCorrect = q.type === 'multiple_choice'
        ? q.answer?.trim() === studentAns.trim()
        : false
      if (isCorrect) score += q.points

      updates.push(supabase.from('submission_answers').upsert({
        submission_id: submissionId,
        question_id: q.id,
        student_answer: studentAns,
        is_correct: q.type === 'multiple_choice' ? isCorrect : null,
        score: q.type === 'multiple_choice' ? (isCorrect ? q.points : 0) : 0,
      }, { onConflict: 'submission_id,question_id' }))

      // 오답이면 재학습 큐에 추가
      if (!isCorrect && q.type === 'multiple_choice' && user) {
        await supabase.from('wrong_answer_queue').upsert({
          student_id: user.id,
          original_question_id: q.id,
          next_review_at: new Date().toISOString(),
        }, { onConflict: 'student_id,original_question_id' })
      }
    }

    await Promise.all(updates)
    const totalPoints = questions.reduce((s, q) => s + q.points, 0)

    // 영역별 실력 통계 업데이트 (객관식만) — race condition 방지를 위해 순차 처리
    for (const q of questions.filter(q => q.type === 'multiple_choice')) {
      await fetch('/api/stats/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: q.category,
          isCorrect: q.answer?.trim() === (answers[q.id] ?? '').trim(),
        }),
      })
    }

    await supabase.from('submissions').update({
      status: questions.some(q => q.type !== 'multiple_choice') ? 'submitted' : 'graded',
      score,
      total_points: totalPoints,
      percentage: totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0,
      submitted_at: new Date().toISOString(),
    }).eq('id', submissionId)

    router.push(`/student/exams/${examId}/result`)
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen text-gray-400">로딩 중...</div>

  const q = questions[current]
  const answeredCount = Object.keys(answers).filter(k => answers[k]).length
  const minutes = timeLeft !== null ? Math.floor(timeLeft / 60) : null
  const seconds = timeLeft !== null ? timeLeft % 60 : null

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
            <div className={`text-2xl font-black tabular-nums ${timeLeft < 300 ? 'text-red-500' : 'text-gray-900'}`}>
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </div>
          )}
        </div>

        <div className="flex flex-col md:flex-row gap-5">
          {/* 문제 영역 */}
          <div className="flex-1">
            {q && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="text-xs font-bold text-purple-600 uppercase tracking-widest mb-4">
                  문제 {q.order_num} / {questions.length} · {q.points}점
                </div>

                {q.passage && (
                  <div className="bg-blue-50 border-l-4 border-blue-400 rounded-r-xl p-4 text-sm text-gray-700 leading-7 mb-5">
                    {renderWithUnderlines(q.passage)}
                  </div>
                )}

                <p className="text-base font-semibold text-gray-900 leading-7 mb-5">{renderWithUnderlines(q.content)}</p>

                {q.type === 'multiple_choice' && q.options ? (
                  <div className="space-y-2.5">
                    {q.options.map(opt => (
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
                        }`}>{opt.num}</span>
                        <span className="text-sm">{opt.text}</span>
                      </button>
                    ))}
                  </div>
                ) : (
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
