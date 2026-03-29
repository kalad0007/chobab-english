'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, X } from 'lucide-react'
import { TOEFL_TOPICS } from '@/app/teacher/vocab/constants'

const TOPIC_EMOJI: Record<string, string> = Object.fromEntries(TOEFL_TOPICS.map(t => [t.value, t.emoji]))
const TOPIC_LABEL: Record<string, string> = Object.fromEntries(TOEFL_TOPICS.map(t => [t.value, t.label]))

interface Annotation {
  type: 'highlight' | 'chunk' | 'vocab'
  start: number; end: number
  word?: string; definition_ko?: string; definition_en?: string; synonyms?: string[]
}

interface Paragraph {
  id: string; order_num: number
  text: string; text_ko: string; explanation: string
  annotations: Annotation[]
}

interface Passage {
  id: string; title: string
  topic_category: string; difficulty: number; source?: string
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
  para, onVocabClick,
}: {
  para: Paragraph
  onVocabClick: (ann: Annotation, e: React.MouseEvent) => void
}) {
  const parts = renderParts(para.text, para.annotations)
  return (
    <p className="text-base leading-relaxed text-gray-800">
      {parts.map((p, i) => {
        if (p.type === 'plain') return <span key={i}>{p.text}</span>
        if (p.type === 'highlight') return <mark key={i} className="bg-yellow-200 rounded-sm px-0.5">{p.text}</mark>
        if (p.type === 'chunk') return (
          <span key={i}>
            <span className="text-gray-800">{p.text}</span>
            <span className="text-gray-300 font-bold mx-1.5 select-none">/</span>
          </span>
        )
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

export default function PassageReader({
  passage, paragraphs,
}: {
  passage: Passage
  paragraphs: Paragraph[]
}) {
  const [transOpen, setTransOpen] = useState<Set<string>>(new Set())
  const [expOpen, setExpOpen] = useState<Set<string>>(new Set())
  const [popup, setPopup] = useState<VocabPopup | null>(null)

  function toggleTrans(id: string) {
    setTransOpen(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleExp(id: string) {
    setExpOpen(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
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
        {/* Title */}
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
            const hasTrans = !!para.text_ko
            const hasExp = !!para.explanation
            return (
              <div key={para.id}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">¶{idx + 1}</span>
                </div>

                {/* English text */}
                <AnnotatedParagraph para={para} onVocabClick={handleVocabClick} />

                {/* Translation (revealed on toggle) */}
                {showTrans && hasTrans && (
                  <div className="mt-3 pl-4 border-l-2 border-blue-200">
                    <p className="text-sm text-blue-700 leading-normal">{para.text_ko}</p>
                  </div>
                )}

                {/* Explanation (revealed on toggle) */}
                {showExp && hasExp && (
                  <div className="mt-3 pl-4 border-l-2 border-emerald-200">
                    <p className="text-[11px] font-bold text-emerald-600 mb-1">독해 해설</p>
                    <p className="text-sm text-emerald-800 leading-normal">{para.explanation}</p>
                  </div>
                )}

                {/* Toggle buttons */}
                {(hasTrans || hasExp) && (
                  <div className="flex gap-2 mt-3">
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
                  </div>
                )}
              </div>
            )
          })}
        </div>
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
