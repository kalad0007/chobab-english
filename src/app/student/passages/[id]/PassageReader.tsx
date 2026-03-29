'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, X, ChevronRight, RotateCcw, CheckCircle2, XCircle } from 'lucide-react'
import { TOEFL_TOPICS } from '@/app/teacher/vocab/constants'

const TOPIC_EMOJI: Record<string, string> = Object.fromEntries(TOEFL_TOPICS.map(t => [t.value, t.emoji]))
const TOPIC_LABEL: Record<string, string> = Object.fromEntries(TOEFL_TOPICS.map(t => [t.value, t.label]))

interface Annotation {
  type: 'highlight' | 'chunk' | 'vocab'
  start: number; end: number
  word?: string; definition_ko?: string; definition_en?: string; synonyms?: string[]
}

interface VocabItem {
  word: string
  meaning_ko: string
  context: string
}

interface Paragraph {
  id: string; order_num: number
  text: string; text_ko: string; explanation: string
  annotations: Annotation[]
  vocab_list: VocabItem[]
}

interface Passage {
  id: string; title: string
  topic_category: string; difficulty: number; source?: string
}

export interface QuizQuestion {
  id: string
  content: string
  options: { num: number; text: string }[]
  answer: string
  explanation?: string | null
}

interface VocabPopup {
  word: string; definition_ko: string; definition_en: string; synonyms: string[]
  x: number; y: number
}

function renderParts(text: string, annotations: Annotation[]) {
  const sorted = [...annotations].sort((a, b) => a.start - b.start)
  const parts: Array<{ type: string; text: string; ann?: Annotation }> = []
  let pos = 0
  for (const ann of sorted) {
    if (ann.start < pos) continue
    if (ann.start > pos) parts.push({ type: 'plain', text: text.slice(pos, ann.start) })
    parts.push({ type: ann.type, text: text.slice(ann.start, ann.end), ann })
    pos = ann.end
  }
  if (pos < text.length) parts.push({ type: 'plain', text: text.slice(pos) })
  return parts
}

function AnnotatedParagraph({
  para, onVocabClick, chunkReveal,
}: {
  para: Paragraph
  onVocabClick: (ann: Annotation, e: React.MouseEvent) => void
  chunkReveal?: number  // how many chunks to reveal; undefined = show all
}) {
  const parts = renderParts(para.text, para.annotations)
  let chunkIdx = 0
  const totalChunks = parts.filter(p => p.type === 'chunk').length

  return (
    <p className="text-base leading-relaxed text-gray-800">
      {parts.map((p, i) => {
        if (p.type === 'plain') return <span key={i}>{p.text}</span>
        if (p.type === 'highlight') return <mark key={i} className="bg-yellow-200 rounded-sm px-0.5">{p.text}</mark>
        if (p.type === 'chunk') {
          const thisIdx = chunkIdx++
          const revealed = chunkReveal === undefined || thisIdx < chunkReveal
          return (
            <span key={i}>
              {revealed ? (
                <span className="text-gray-800">{p.text}</span>
              ) : (
                <span
                  className="inline-block bg-gray-200 text-gray-200 rounded px-1 select-none"
                  style={{ minWidth: `${Math.max(p.text.length * 7, 24)}px` }}
                >
                  {'█'.repeat(Math.min(p.text.length, 8))}
                </span>
              )}
              {revealed && thisIdx < totalChunks - 1 && <span className="text-gray-300 font-bold mx-1.5 select-none">/</span>}
            </span>
          )
        }
        if (p.type === 'vocab') return (
          <button key={i}
            onClick={e => p.ann && onVocabClick(p.ann, e)}
            className="text-purple-700 underline underline-offset-2 decoration-dotted decoration-purple-400 cursor-pointer hover:text-purple-900 transition font-medium">
            {p.text}
          </button>
        )
        return <span key={i}>{p.text}</span>
      })}
    </p>
  )
}

// ── Quiz component ─────────────────────────────────────────────────
function QuizSection({ questions }: { questions: QuizQuestion[] }) {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)

  if (questions.length === 0) return null

  const score = submitted
    ? questions.filter(q => answers[q.id] === q.answer).length
    : 0

  return (
    <div className="mt-12 border-t-2 border-dashed border-gray-200 pt-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-extrabold text-gray-900">📝 확인 퀴즈</h2>
        {submitted && (
          <span className={`text-sm font-bold px-3 py-1 rounded-full ${
            score === questions.length ? 'bg-emerald-100 text-emerald-700' :
            score >= questions.length / 2 ? 'bg-blue-100 text-blue-700' :
            'bg-orange-100 text-orange-700'
          }`}>
            {score}/{questions.length} 정답
          </span>
        )}
      </div>

      <div className="space-y-6">
        {questions.map((q, qi) => {
          const chosen = answers[q.id]
          const isCorrect = chosen === q.answer
          return (
            <div key={q.id} className={`p-4 rounded-2xl border-2 transition ${
              !submitted ? 'border-gray-100' :
              isCorrect ? 'border-emerald-200 bg-emerald-50' :
              'border-red-200 bg-red-50'
            }`}>
              <p className="text-sm font-semibold text-gray-800 mb-3">
                <span className="text-gray-400 mr-2">{qi + 1}.</span>{q.content}
              </p>
              <div className="space-y-2">
                {q.options.map(opt => {
                  const isSelected = chosen === String(opt.num)
                  const isAnswer = String(opt.num) === q.answer
                  let optClass = 'border-gray-200 bg-white text-gray-700'
                  if (submitted) {
                    if (isAnswer) optClass = 'border-emerald-400 bg-emerald-50 text-emerald-800 font-bold'
                    else if (isSelected && !isAnswer) optClass = 'border-red-300 bg-red-50 text-red-700'
                    else optClass = 'border-gray-100 bg-gray-50 text-gray-400'
                  } else if (isSelected) {
                    optClass = 'border-blue-400 bg-blue-50 text-blue-800 font-bold'
                  }
                  return (
                    <button
                      key={opt.num}
                      disabled={submitted}
                      onClick={() => setAnswers(prev => ({ ...prev, [q.id]: String(opt.num) }))}
                      className={`w-full text-left px-3 py-2 rounded-xl border-2 text-sm transition flex items-center gap-2 ${optClass}`}
                    >
                      <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[11px] font-bold flex-shrink-0">
                        {opt.num}
                      </span>
                      {opt.text}
                      {submitted && isAnswer && <CheckCircle2 size={14} className="ml-auto text-emerald-600 flex-shrink-0" />}
                      {submitted && isSelected && !isAnswer && <XCircle size={14} className="ml-auto text-red-500 flex-shrink-0" />}
                    </button>
                  )
                })}
              </div>
              {submitted && q.explanation && (
                <div className="mt-3 pl-3 border-l-2 border-gray-200">
                  <p className="text-xs text-gray-500 leading-relaxed">{q.explanation}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {!submitted ? (
        <button
          onClick={() => setSubmitted(true)}
          disabled={Object.keys(answers).length < questions.length}
          className="mt-6 w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold rounded-2xl transition text-sm"
        >
          {Object.keys(answers).length < questions.length
            ? `${questions.length - Object.keys(answers).length}문제 남음`
            : '채점하기'}
        </button>
      ) : (
        <button
          onClick={() => { setAnswers({}); setSubmitted(false) }}
          className="mt-6 w-full flex items-center justify-center gap-2 py-3 border-2 border-gray-200 text-gray-500 hover:bg-gray-50 font-bold rounded-2xl transition text-sm"
        >
          <RotateCcw size={14} /> 다시 풀기
        </button>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────
export default function PassageReader({
  passage, paragraphs, quizQuestions = [],
}: {
  passage: Passage
  paragraphs: Paragraph[]
  quizQuestions?: QuizQuestion[]
}) {
  const [transOpen, setTransOpen] = useState<Set<string>>(new Set())
  const [expOpen, setExpOpen] = useState<Set<string>>(new Set())
  const [vocabOpen, setVocabOpen] = useState<Set<string>>(new Set())
  // chunk reveal: paraId → number of chunks revealed (undefined = all shown)
  const [chunkReveal, setChunkReveal] = useState<Record<string, number>>({})
  const [popup, setPopup] = useState<VocabPopup | null>(null)

  function toggleTrans(id: string) {
    setTransOpen(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleExp(id: string) {
    setExpOpen(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleVocab(id: string) {
    setVocabOpen(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function revealNextChunk(paraId: string, total: number) {
    setChunkReveal(prev => {
      const cur = prev[paraId] ?? 0
      if (cur >= total) return prev
      return { ...prev, [paraId]: cur + 1 }
    })
  }
  function resetChunks(paraId: string) {
    setChunkReveal(prev => { const n = { ...prev }; delete n[paraId]; return n })
  }

  function handleVocabClick(ann: Annotation, e: React.MouseEvent) {
    if (!ann.word) return
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    setPopup({
      word: ann.word,
      definition_ko: ann.definition_ko ?? '',
      definition_en: ann.definition_en ?? '',
      synonyms: ann.synonyms ?? [],
      x: rect.left + rect.width / 2,
      y: rect.bottom + 8,
    })
  }

  const emoji = TOPIC_EMOJI[passage.topic_category] ?? '📝'
  const label = TOPIC_LABEL[passage.topic_category] ?? passage.topic_category

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 z-10">
        <Link href="/student/passages" className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition">
          <ChevronLeft size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-400 font-medium truncate">{emoji} {label} · Band {passage.difficulty.toFixed(1)}</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-8">
        <h1 className="text-2xl font-extrabold text-gray-900 mb-1">{passage.title}</h1>
        {passage.source && <p className="text-xs text-gray-400 mb-6">{passage.source}</p>}
        {!passage.source && <div className="mb-6" />}

        {/* Legend */}
        {paragraphs.some(p => p.annotations.length > 0) && (
          <div className="flex flex-wrap gap-3 mb-6 p-3 bg-gray-50 rounded-xl text-xs text-gray-500">
            <span><mark className="bg-yellow-200 rounded px-1">하이라이트</mark> 중요 표현</span>
            <span><span className="text-gray-400 font-bold">/</span> 끊어읽기</span>
            <span><span className="text-purple-700 underline decoration-dotted">어휘</span> 클릭하면 뜻 표시</span>
          </div>
        )}

        {/* Paragraphs */}
        <div className="space-y-8">
          {paragraphs.map((para, idx) => {
            const showTrans = transOpen.has(para.id)
            const showExp = expOpen.has(para.id)
            const showVocab = vocabOpen.has(para.id)
            const hasTrans = !!para.text_ko
            const hasExp = !!para.explanation
            const hasVocab = para.vocab_list.length > 0
            const chunks = para.annotations.filter(a => a.type === 'chunk')
            const hasChunks = chunks.length >= 2
            const revealed = chunkReveal[para.id] ?? (hasChunks ? 0 : undefined)
            const allRevealed = revealed === undefined || (hasChunks && revealed >= chunks.length)

            return (
              <div key={para.id}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">¶{idx + 1}</span>
                  {hasChunks && (
                    <span className="text-[10px] font-bold text-sky-400 px-1.5 py-0.5 bg-sky-50 rounded-full">
                      ✂️ 끊어읽기
                    </span>
                  )}
                </div>

                <AnnotatedParagraph
                  para={para}
                  onVocabClick={handleVocabClick}
                  chunkReveal={hasChunks ? revealed : undefined}
                />

                {/* Chunk controls */}
                {hasChunks && (
                  <div className="flex items-center gap-2 mt-2">
                    {!allRevealed ? (
                      <button
                        onClick={() => revealNextChunk(para.id, chunks.length)}
                        className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white transition"
                      >
                        <ChevronRight size={13} />
                        다음 ({(revealed ?? 0)}/{chunks.length})
                      </button>
                    ) : (
                      <span className="text-xs font-bold text-emerald-600 px-3 py-1.5 bg-emerald-50 rounded-xl">✓ 완료</span>
                    )}
                    {(revealed ?? 0) > 0 && (
                      <button
                        onClick={() => resetChunks(para.id)}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded-xl hover:bg-gray-50 transition"
                      >
                        <RotateCcw size={11} /> 처음부터
                      </button>
                    )}
                    {!allRevealed && (
                      <button
                        onClick={() => setChunkReveal(prev => ({ ...prev, [para.id]: chunks.length }))}
                        className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded-xl hover:bg-gray-50 transition"
                      >
                        전체 보기
                      </button>
                    )}
                  </div>
                )}

                {/* Translation */}
                {showTrans && hasTrans && (
                  <div className="mt-3 pl-4 border-l-2 border-blue-200">
                    <p className="text-sm text-blue-700 leading-normal"
                      dangerouslySetInnerHTML={{ __html: para.text_ko.replace(/\n/g, '<br>') }} />
                  </div>
                )}

                {/* Explanation */}
                {showExp && hasExp && (
                  <div className="mt-3 pl-4 border-l-2 border-emerald-200">
                    <p className="text-[11px] font-bold text-emerald-600 mb-1">독해 해설</p>
                    <p className="text-sm text-emerald-800 leading-normal"
                      dangerouslySetInnerHTML={{ __html: para.explanation.replace(/\n/g, '<br>') }} />
                  </div>
                )}

                {/* Vocab table */}
                {showVocab && hasVocab && (
                  <div className="mt-3 pl-4 border-l-2 border-purple-200">
                    <p className="text-[11px] font-bold text-purple-600 mb-1.5">📚 주요 어휘</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-purple-50">
                            <th className="text-left px-2 py-1.5 text-purple-600 font-bold border border-purple-100 w-1/5">단어</th>
                            <th className="text-left px-2 py-1.5 text-purple-600 font-bold border border-purple-100 w-1/5">뜻</th>
                            <th className="text-left px-2 py-1.5 text-purple-600 font-bold border border-purple-100">문맥</th>
                          </tr>
                        </thead>
                        <tbody>
                          {para.vocab_list.map((v, i) => (
                            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-purple-50/40'}>
                              <td className="px-2 py-1.5 font-semibold text-gray-800 border border-purple-100">{v.word}</td>
                              <td className="px-2 py-1.5 text-purple-700 border border-purple-100">{v.meaning_ko}</td>
                              <td className="px-2 py-1.5 text-gray-600 border border-purple-100 leading-relaxed">{v.context}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Toggle buttons */}
                {(hasTrans || hasExp || hasVocab) && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {hasTrans && (
                      <button
                        onClick={() => toggleTrans(para.id)}
                        className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border-2 transition ${
                          showTrans
                            ? 'border-blue-400 bg-blue-50 text-blue-700'
                            : 'border-gray-200 text-gray-400 hover:border-blue-300 hover:text-blue-500'
                        }`}
                      >
                        🇰🇷 번역 {showTrans ? '▲' : '▼'}
                      </button>
                    )}
                    {hasExp && (
                      <button
                        onClick={() => toggleExp(para.id)}
                        className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border-2 transition ${
                          showExp
                            ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                            : 'border-gray-200 text-gray-400 hover:border-emerald-300 hover:text-emerald-500'
                        }`}
                      >
                        📖 독해 해설 {showExp ? '▲' : '▼'}
                      </button>
                    )}
                    {hasVocab && (
                      <button
                        onClick={() => toggleVocab(para.id)}
                        className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border-2 transition ${
                          showVocab
                            ? 'border-purple-400 bg-purple-50 text-purple-700'
                            : 'border-gray-200 text-gray-400 hover:border-purple-300 hover:text-purple-500'
                        }`}
                      >
                        📚 주요 어휘 {showVocab ? '▲' : '▼'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Quiz section */}
        <QuizSection questions={quizQuestions} />
      </div>

      {/* Vocab popup */}
      {popup && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPopup(null)} />
          <div
            className="fixed z-50 bg-white rounded-2xl shadow-xl border border-gray-200 p-4 w-72"
            style={{ left: Math.min(popup.x - 144, window.innerWidth - 300), top: popup.y }}
          >
            <div className="flex items-start justify-between mb-2">
              <p className="font-extrabold text-gray-900 text-base">{popup.word}</p>
              <button onClick={() => setPopup(null)} className="p-0.5 text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            </div>
            {popup.definition_ko && <p className="text-sm text-gray-700 mb-1">{popup.definition_ko}</p>}
            {popup.definition_en && <p className="text-xs text-gray-400 mb-2">{popup.definition_en}</p>}
            {popup.synonyms.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-gray-100">
                {popup.synonyms.slice(0, 4).map(s => (
                  <span key={s} className="text-[11px] bg-purple-50 text-purple-600 font-semibold px-2 py-0.5 rounded-full">{s}</span>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
