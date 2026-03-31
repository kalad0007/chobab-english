'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CATEGORY_LABELS, renderWithUnderlines, usesAlphaOptions, optionLabel } from '@/lib/utils'
import { CheckCircle, XCircle } from 'lucide-react'
import Link from 'next/link'
import FillBlankPlayer from '@/components/ui/FillBlankPlayer'
import VocabWords from '@/components/ui/VocabWords'
import SentenceCompletionPlayer from '@/components/ui/SentenceCompletionPlayer'

export interface ReviewItem {
  id: string
  original_question_id: string
  retry_count: number
  question: {
    id: string
    content: string
    passage: string | null
    options: { num: number; text: string }[] | null
    answer: string
    explanation: string | null
    vocab_words: { word: string; def: string; example?: string }[] | null
    category: string
    type: string
    question_subtype: string | null
  }
}

export default function ReviewClient({ initialItems }: { initialItems: ReviewItem[] }) {
  const supabase = createClient()
  const [items] = useState<ReviewItem[]>(initialItems)
  const [current, setCurrent] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [fillAnswer, setFillAnswer] = useState('')
  const [submitted, setSubmitted] = useState(false)

  async function handleAnswer(answer: string) {
    if (submitted) return
    setSelectedAnswer(answer)
    setSubmitted(true)

    const item = items[current]
    const isCorrect = item.question.answer.trim() === answer.trim()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const newRetryCount = item.retry_count + 1
    const mastered = isCorrect && newRetryCount >= 2
    const daysMap = [1, 3, 7, 14, 30]
    const days = isCorrect ? (daysMap[Math.min(newRetryCount - 1, daysMap.length - 1)] ?? 30) : 1
    const nextReview = new Date(Date.now() + days * 86400000).toISOString()

    await supabase.from('wrong_answer_queue').update({
      retry_count: newRetryCount,
      mastered,
      next_review_at: nextReview,
      last_attempt_at: new Date().toISOString(),
    }).eq('id', item.id)

    await fetch('/api/stats/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: item.question.category, isCorrect }),
    })
  }

  function handleNext() {
    if (current < items.length - 1) {
      setCurrent(c => c + 1)
      setSelectedAnswer(null)
      setFillAnswer('')
      setSubmitted(false)
    }
  }

  function handleFillSubmit() {
    const item = items[current]
    const correct = (item.question.answer ?? '').split(',').map(a => a.trim().toLowerCase())
    const student = fillAnswer.split(',').map(a => a.trim().toLowerCase())
    const isCorrect = correct.length > 0 && correct.every((c, i) => c === student[i])
    handleAnswer(isCorrect ? item.question.answer : fillAnswer)
  }

  if (items.length === 0) {
    return (
      <div className="p-7 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <CheckCircle size={56} className="text-emerald-400 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">오늘 복습 완료!</h2>
        <p className="text-gray-500">오늘 복습할 문제가 없어요. 훌륭해요! 🎉</p>
      </div>
    )
  }

  const item = items[current]
  const q = item.question
  const isFillBlank = q.question_subtype === 'complete_the_words' || q.question_subtype === 'sentence_completion'
    || (q.passage?.trimStart().startsWith('[') ?? false)
    || q.content.trimStart().startsWith('[')

  let explanationText = q.explanation ?? ''
  if (explanationText.trimStart().startsWith('{')) {
    try { explanationText = JSON.parse(explanationText).explanation ?? '' } catch { explanationText = '' }
  }

  let fillTokens: unknown[] | null = null
  if (isFillBlank) {
    const raw = q.passage || q.content
    try { fillTokens = JSON.parse(raw ?? '') } catch { fillTokens = null }
  }

  return (
    <div className="p-7 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">🔄 오답 복습</h1>
          <p className="text-gray-500 text-sm mt-1">{current + 1} / {items.length}문제</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{current}개 완료</span>
          <div className="flex gap-1">
            {items.map((_, i) => (
              <div key={i} className={`w-2 h-2 rounded-full ${i < current ? 'bg-emerald-400' : i === current ? 'bg-purple-500' : 'bg-gray-200'}`} />
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2.5 py-1 rounded-full">
            {CATEGORY_LABELS[q.category] ?? q.category}
          </span>
          <span className="text-xs text-gray-400">재시도 {item.retry_count}회</span>
        </div>

        {q.passage && !isFillBlank && q.question_subtype !== 'email_writing' && (
          <div className="bg-blue-50 border-l-4 border-blue-400 rounded-r-xl p-4 text-sm text-gray-700 leading-7 mb-5">
            {renderWithUnderlines(q.passage)}
          </div>
        )}

        {!isFillBlank && (
          <p className="text-base font-semibold text-gray-900 leading-7 mb-5">{renderWithUnderlines(q.content)}</p>
        )}

        {isFillBlank && fillTokens && (
          <div className="bg-gray-50 rounded-xl p-4 mb-4">
            <FillBlankPlayer
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              tokens={fillTokens as any}
              subtype={q.question_subtype}
              value={submitted ? q.answer : fillAnswer}
              onChange={setFillAnswer}
            />
          </div>
        )}
        {isFillBlank && !fillTokens && (
          <div className="mb-4">
            <SentenceCompletionPlayer
              content={q.passage || q.content}
              value={submitted ? q.answer : fillAnswer}
              onChange={setFillAnswer}
              showResult={submitted}
              correctAnswer={q.answer}
            />
          </div>
        )}
        {isFillBlank && !submitted && (
          <button onClick={handleFillSubmit}
            className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-bold transition mb-2">
            제출하기
          </button>
        )}

        {!isFillBlank && q.options && (() => {
          const alpha = usesAlphaOptions(q.category, q.question_subtype)
          return (
            <div className="space-y-2.5">
              {q.options.map(opt => {
                const isCorrectOpt = String(opt.num) === q.answer
                const isSelectedOpt = selectedAnswer === String(opt.num)
                return (
                  <button key={opt.num} onClick={() => handleAnswer(String(opt.num))} disabled={submitted}
                    className={`w-full flex items-start gap-3 p-4 rounded-xl border-2 text-left transition ${
                      !submitted ? (isSelectedOpt ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-blue-300') :
                      isCorrectOpt ? 'border-green-500 bg-green-50' :
                      isSelectedOpt && !isCorrectOpt ? 'border-red-400 bg-red-50' : 'border-gray-200 opacity-60'
                    }`}>
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      !submitted ? (isSelectedOpt ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600') :
                      isCorrectOpt ? 'bg-green-500 text-white' :
                      isSelectedOpt ? 'bg-red-400 text-white' : 'bg-gray-100 text-gray-600'
                    }`}>{optionLabel(opt.num, alpha)}</span>
                    <span className="text-sm">{opt.text}</span>
                    {submitted && isCorrectOpt && <CheckCircle size={16} className="text-green-500 ml-auto flex-shrink-0 mt-0.5" />}
                    {submitted && isSelectedOpt && !isCorrectOpt && <XCircle size={16} className="text-red-400 ml-auto flex-shrink-0 mt-0.5" />}
                  </button>
                )
              })}
            </div>
          )
        })()}
      </div>

      {submitted && (
        <div className={`rounded-2xl p-5 mb-4 ${
          selectedAnswer === q.answer ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            {selectedAnswer === q.answer
              ? <><CheckCircle size={18} className="text-emerald-600" /><span className="font-bold text-emerald-800">정답입니다! 🎉</span></>
              : <><XCircle size={18} className="text-red-500" /><span className="font-bold text-red-700">오답이에요. 정답은 {usesAlphaOptions(q.category, q.question_subtype) ? optionLabel(Number(q.answer), true) : q.answer}번입니다.</span></>
            }
          </div>
          {explanationText && <p className="text-sm text-gray-700">{explanationText}</p>}
          {Array.isArray(q.vocab_words) && q.vocab_words.length > 0 && (
            <div className="mt-2"><VocabWords words={q.vocab_words} /></div>
          )}
          {isFillBlank && submitted && (
            <div className="mt-2 space-y-1">
              {q.answer.split(',').map((correct: string, ci: number) => {
                const studentWord = fillAnswer.split(',')[ci]?.trim() ?? ''
                const isWordCorrect = correct.trim().toLowerCase() === studentWord.toLowerCase()
                return (
                  <div key={ci} className={`text-xs px-2 py-1 rounded-lg flex gap-2 ${isWordCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    <span className="font-bold">{ci + 1}.</span>
                    <span>정답: <strong>{correct.trim()}</strong></span>
                    {!isWordCorrect && studentWord && <span className="text-red-500">내 답: {studentWord}</span>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3">
        {submitted && current < items.length - 1 && (
          <button onClick={handleNext}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition">
            다음 문제 →
          </button>
        )}
        {submitted && current === items.length - 1 && (
          <Link href="/student/dashboard"
            className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-bold text-center transition">
            ✅ 오늘 복습 완료!
          </Link>
        )}
      </div>
    </div>
  )
}
