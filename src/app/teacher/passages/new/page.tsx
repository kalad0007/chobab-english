'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Trash2, ChevronUp, ChevronDown, Sparkles, Loader2,
  Check, Send, BookOpen, ChevronLeft, Highlighter, Scissors, BookA, X, Wand2
} from 'lucide-react'
import { createPassage, type Annotation } from '../actions'
import { TOEFL_TOPICS } from '../../vocab/constants'
import { createClient } from '@/lib/supabase/client'

const DIFFICULTY_OPTIONS = [
  { value: 2.0, label: 'Band 2.0 (A2)' }, { value: 2.5, label: 'Band 2.5 (B1-)' },
  { value: 3.0, label: 'Band 3.0 (B1)' }, { value: 3.5, label: 'Band 3.5 (B1+)' },
  { value: 4.0, label: 'Band 4.0 (B2)' }, { value: 4.5, label: 'Band 4.5 (B2+)' },
  { value: 5.0, label: 'Band 5.0 (C1)' },
]

interface ParagraphState {
  id: string
  text: string
  text_ko: string
  annotations: Annotation[]
  mode: 'edit' | 'annotate'
  translating: boolean
}

interface Toolbar {
  x: number; y: number
  paraId: string; start: number; end: number
  step: 'main' | 'vocab'
}

interface VocabWord {
  id: string; word: string; definition_ko: string; definition_en: string; synonyms: string[]
}

function uid() { return Math.random().toString(36).slice(2) }

function getTextOffset(container: Node, targetNode: Node, targetOffset: number): number {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  let total = 0
  let node = walker.nextNode()
  while (node) {
    if (node === targetNode) return total + targetOffset
    total += node.textContent?.length ?? 0
    node = walker.nextNode()
  }
  return total + targetOffset
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

function AnnotatedView({
  para, onMouseUp,
}: {
  para: ParagraphState
  onMouseUp: (paraId: string, start: number, end: number, x: number, y: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  function handleMouseUp() {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !sel.rangeCount || !ref.current) return
    const range = sel.getRangeAt(0)
    const start = getTextOffset(ref.current, range.startContainer, range.startOffset)
    const end = getTextOffset(ref.current, range.endContainer, range.endOffset)
    if (start >= end) return
    const rect = range.getBoundingClientRect()
    onMouseUp(para.id, start, end, rect.left + rect.width / 2, rect.top - 8)
  }

  const parts = renderParts(para.text, para.annotations)

  return (
    <div
      ref={ref}
      onMouseUp={handleMouseUp}
      className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm leading-relaxed text-gray-800 select-text cursor-text min-h-[80px]"
    >
      {parts.map((p, i) => {
        if (p.type === 'plain') return <span key={i}>{p.text}</span>
        if (p.type === 'highlight') return <mark key={i} className="bg-yellow-300 rounded px-0.5">{p.text}</mark>
        if (p.type === 'chunk') return (
          <span key={i}>
            <span className="bg-sky-100 text-sky-800 rounded px-0.5">{p.text}</span>
            <span className="text-gray-400 font-bold mx-1 select-none">/</span>
          </span>
        )
        if (p.type === 'vocab') return (
          <span key={i} className="text-purple-700 underline underline-offset-2 decoration-dotted cursor-pointer">
            {p.text}
          </span>
        )
        return <span key={i}>{p.text}</span>
      })}
      {para.text.length === 0 && <span className="text-gray-300 italic">본문을 입력한 뒤 주석 모드를 사용하세요</span>}
    </div>
  )
}

export default function NewPassagePage() {
  const router = useRouter()

  const [title, setTitle] = useState('')
  const [topic, setTopic] = useState('history_world')
  const [difficulty, setDifficulty] = useState(3.0)
  const [source, setSource] = useState('')
  const [paragraphs, setParagraphs] = useState<ParagraphState[]>([
    { id: uid(), text: '', text_ko: '', annotations: [], mode: 'edit', translating: false },
  ])
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([])
  const [selectedClasses, setSelectedClasses] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [showAiPanel, setShowAiPanel] = useState(false)
  const [aiParaCount, setAiParaCount] = useState(4)
  const [aiGenerating, setAiGenerating] = useState(false)

  const [toolbar, setToolbar] = useState<Toolbar | null>(null)
  const [vocabQuery, setVocabQuery] = useState('')
  const [vocabResults, setVocabResults] = useState<VocabWord[]>([])
  const [vocabLoading, setVocabLoading] = useState(false)
  const toolbarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function loadClasses() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('classes').select('id, name').eq('teacher_id', user.id).order('created_at')
      setClasses(data ?? [])
    }
    loadClasses()
  }, [])

  // Dismiss toolbar on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setToolbar(null)
        setVocabQuery('')
        setVocabResults([])
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  // Vocab search
  useEffect(() => {
    if (!vocabQuery.trim() || toolbar?.step !== 'vocab') { setVocabResults([]); return }
    const t = setTimeout(async () => {
      setVocabLoading(true)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setVocabLoading(false); return }
      const { data } = await supabase
        .from('vocab_words')
        .select('id, word, definition_ko, definition_en, synonyms')
        .eq('teacher_id', user.id)
        .ilike('word', `%${vocabQuery}%`)
        .limit(6)
      setVocabResults(data ?? [])
      setVocabLoading(false)
    }, 250)
    return () => clearTimeout(t)
  }, [vocabQuery, toolbar?.step])

  function updatePara(id: string, updates: Partial<ParagraphState>) {
    setParagraphs(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))
  }

  function addParagraph() {
    setParagraphs(prev => [...prev, { id: uid(), text: '', text_ko: '', annotations: [], mode: 'edit', translating: false }])
  }

  function removeParagraph(id: string) {
    setParagraphs(prev => prev.filter(p => p.id !== id))
  }

  function moveParagraph(id: string, dir: -1 | 1) {
    setParagraphs(prev => {
      const idx = prev.findIndex(p => p.id === id)
      const next = [...prev]
      const swap = idx + dir
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]]
      return next
    })
  }

  async function translateParagraph(id: string) {
    const para = paragraphs.find(p => p.id === id)
    if (!para?.text.trim()) return
    updatePara(id, { translating: true })
    try {
      const res = await fetch('/api/ai/passage-translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: para.text, topic }),
      })
      const data = await res.json()
      if (data.text_ko) updatePara(id, { text_ko: data.text_ko })
    } finally {
      updatePara(id, { translating: false })
    }
  }

  function handleAnnotationSelect(paraId: string, start: number, end: number, x: number, y: number) {
    setToolbar({ x, y, paraId, start, end, step: 'main' })
    setVocabQuery('')
    setVocabResults([])
  }

  function addAnnotation(type: 'highlight' | 'chunk' | 'vocab', word?: VocabWord) {
    if (!toolbar) return
    const ann: Annotation = {
      type, start: toolbar.start, end: toolbar.end,
      ...(word && {
        wordId: word.id, word: word.word,
        definition_ko: word.definition_ko, definition_en: word.definition_en,
        synonyms: word.synonyms,
      }),
    }
    setParagraphs(prev => prev.map(p =>
      p.id === toolbar.paraId
        ? { ...p, annotations: [...p.annotations, ann] }
        : p
    ))
    setToolbar(null)
    setVocabQuery('')
    setVocabResults([])
    window.getSelection()?.removeAllRanges()
  }

  function removeAnnotation(paraId: string, idx: number) {
    setParagraphs(prev => prev.map(p =>
      p.id === paraId
        ? { ...p, annotations: p.annotations.filter((_, i) => i !== idx) }
        : p
    ))
  }

  async function handleAiGenerate() {
    setAiGenerating(true); setError('')
    const topicObj = TOEFL_TOPICS.find(t => t.value === topic)
    try {
      const res = await fetch('/api/ai/passage-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, topicLabel: topicObj?.label, difficulty, paraCount: aiParaCount }),
      })
      const data = await res.json()
      if (!res.ok) return setError('AI 생성 실패: ' + (data.error ?? ''))
      if (data.title) setTitle(data.title)
      if (data.paragraphs?.length) {
        setParagraphs(data.paragraphs.map((text: string) => ({
          id: uid(), text, text_ko: '', annotations: [], mode: 'edit' as const, translating: false,
        })))
      }
      setShowAiPanel(false)
    } catch {
      setError('AI 생성 중 오류가 발생했습니다')
    } finally {
      setAiGenerating(false)
    }
  }

  async function handleSave() {
    if (!title.trim()) return setError('제목을 입력하세요')
    const validParas = paragraphs.filter(p => p.text.trim())
    if (validParas.length === 0) return setError('문단을 최소 1개 이상 입력하세요')
    setSaving(true); setError('')
    const result = await createPassage({
      title, topic_category: topic, difficulty, source,
      classIds: [...selectedClasses],
      paragraphs: validParas.map((p, i) => ({
        order_num: i + 1, text: p.text, text_ko: p.text_ko, annotations: p.annotations,
      })),
    })
    setSaving(false)
    if (result.error) return setError(result.error)
    router.push('/teacher/passages')
  }

  return (
    <div className="p-4 md:p-7 max-w-3xl mx-auto pb-16">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.back()} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition">
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-extrabold text-gray-900">새 지문 만들기</h1>
          <p className="text-sm text-gray-400 mt-0.5">문단을 입력하고 AI 번역 및 주석을 추가하세요</p>
        </div>
        <button onClick={() => setShowAiPanel(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-xl transition">
          <Wand2 size={15} /> AI 생성
        </button>
      </div>

      {/* AI generation panel */}
      {showAiPanel && (
        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5 mb-4">
          <p className="text-sm font-extrabold text-purple-800 mb-3 flex items-center gap-2">
            <Wand2 size={15} /> AI 지문 자동 생성
          </p>
          <p className="text-xs text-purple-600 mb-3">
            위에서 설정한 <strong>주제</strong>와 <strong>난이도</strong>를 기준으로 TOEFL 스타일 지문을 생성합니다.
          </p>
          <div className="flex items-center gap-3 mb-4">
            <label className="text-xs font-bold text-purple-700">문단 수</label>
            <input type="range" min={2} max={6} step={1} value={aiParaCount}
              onChange={e => setAiParaCount(Number(e.target.value))}
              className="flex-1 accent-purple-600" />
            <span className="text-lg font-extrabold text-purple-700 w-6 text-center">{aiParaCount}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowAiPanel(false)}
              className="flex-1 py-2 text-sm font-bold text-gray-500 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition">
              취소
            </button>
            <button onClick={handleAiGenerate} disabled={aiGenerating}
              className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition disabled:opacity-50">
              {aiGenerating ? <><Loader2 size={15} className="animate-spin" /> 생성 중...</> : <><Sparkles size={15} /> 지문 생성</>}
            </button>
          </div>
        </div>
      )}

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-4">{error}</div>}

      {/* Metadata */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4 space-y-4">
        <div>
          <label className="text-xs font-bold text-gray-500 mb-1.5 block">제목 *</label>
          <input value={title} onChange={e => setTitle(e.target.value)}
            placeholder="예: The Agricultural Revolution"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-gray-500 mb-1.5 block">주제</label>
            <select value={topic} onChange={e => setTopic(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none">
              {TOEFL_TOPICS.map(t => <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 mb-1.5 block">난이도</label>
            <select value={difficulty} onChange={e => setDifficulty(Number(e.target.value))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none">
              {DIFFICULTY_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 mb-1.5 block">출처 (선택)</label>
          <input value={source} onChange={e => setSource(e.target.value)}
            placeholder="예: ETS Official Guide 2024 p.45"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none" />
        </div>
      </div>

      {/* Paragraphs */}
      <div className="space-y-4 mb-4">
        {paragraphs.map((para, idx) => (
          <div key={para.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            {/* Para header */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">문단 {idx + 1}</span>
              <div className="flex items-center gap-1">
                {/* Mode toggle */}
                <button
                  onClick={() => updatePara(para.id, { mode: para.mode === 'edit' ? 'annotate' : 'edit' })}
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition ${
                    para.mode === 'annotate'
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'border-gray-200 text-gray-500 hover:border-amber-300 hover:text-amber-600'
                  }`}>
                  {para.mode === 'annotate' ? '✏️ 편집 모드' : '🏷️ 주석 모드'}
                </button>
                {/* AI translate */}
                <button
                  onClick={() => translateParagraph(para.id)}
                  disabled={para.translating || !para.text.trim()}
                  className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition disabled:opacity-40">
                  {para.translating ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                  AI 번역
                </button>
                {/* Move up/down */}
                <button onClick={() => moveParagraph(para.id, -1)} disabled={idx === 0}
                  className="p-1.5 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition disabled:opacity-30">
                  <ChevronUp size={13} />
                </button>
                <button onClick={() => moveParagraph(para.id, 1)} disabled={idx === paragraphs.length - 1}
                  className="p-1.5 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition disabled:opacity-30">
                  <ChevronDown size={13} />
                </button>
                {paragraphs.length > 1 && (
                  <button onClick={() => removeParagraph(para.id)}
                    className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* Text area or annotate view */}
            {para.mode === 'edit' ? (
              <textarea
                value={para.text}
                onChange={e => updatePara(para.id, { text: e.target.value })}
                placeholder="영어 본문을 입력하세요..."
                rows={4}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none leading-relaxed"
              />
            ) : (
              <div>
                <p className="text-[11px] text-amber-600 font-semibold mb-1.5">텍스트를 드래그하여 주석을 추가하세요</p>
                <AnnotatedView para={para} onMouseUp={handleAnnotationSelect} />
              </div>
            )}

            {/* Annotation badges */}
            {para.annotations.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {para.annotations.map((ann, i) => (
                  <span key={i} className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    ann.type === 'highlight' ? 'bg-yellow-100 text-yellow-700' :
                    ann.type === 'chunk' ? 'bg-sky-100 text-sky-700' :
                    'bg-purple-100 text-purple-700'
                  }`}>
                    {ann.type === 'highlight' ? '🟡' : ann.type === 'chunk' ? '✂️' : '📘'}
                    {para.text.slice(ann.start, ann.end).slice(0, 18)}{para.text.slice(ann.start, ann.end).length > 18 ? '…' : ''}
                    <button onClick={() => removeAnnotation(para.id, i)} className="ml-0.5 opacity-60 hover:opacity-100">
                      <X size={9} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Korean translation */}
            <div className="mt-3">
              <label className="text-[11px] font-bold text-blue-500 mb-1 block">한국어 번역</label>
              <textarea
                value={para.text_ko}
                onChange={e => updatePara(para.id, { text_ko: e.target.value })}
                placeholder="AI 번역 버튼을 누르거나 직접 입력하세요..."
                rows={3}
                className="w-full border border-blue-100 bg-blue-50 rounded-xl px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none leading-relaxed"
              />
            </div>
          </div>
        ))}
      </div>

      <button onClick={addParagraph}
        className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 hover:border-blue-300 text-gray-400 hover:text-blue-500 rounded-2xl text-sm font-bold transition mb-6">
        <Plus size={16} /> 문단 추가
      </button>

      {/* Class selection & save */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div>
          <p className="text-xs font-bold text-gray-500 mb-2">배포할 반 선택</p>
          {classes.length === 0 ? (
            <p className="text-sm text-gray-400">등록된 반이 없어요</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {classes.map(cls => {
                const on = selectedClasses.has(cls.id)
                return (
                  <button key={cls.id} onClick={() => setSelectedClasses(prev => {
                    const next = new Set(prev); on ? next.delete(cls.id) : next.add(cls.id); return next
                  })}
                    className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border-2 transition ${on ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                    {on && <Check size={11} />} {cls.name}
                  </button>
                )
              })}
            </div>
          )}
          {selectedClasses.size === 0 && <p className="text-xs text-gray-400 mt-1.5">반을 선택하지 않으면 임시저장됩니다</p>}
        </div>
        <button onClick={handleSave} disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition disabled:opacity-50">
          {saving ? <><Loader2 size={18} className="animate-spin" /> 저장 중...</>
            : selectedClasses.size > 0 ? <><Send size={18} /> {selectedClasses.size}개 반에 배포</>
            : <><BookOpen size={18} /> 임시저장</>}
        </button>
      </div>

      {/* Floating annotation toolbar */}
      {toolbar && (
        <div
          ref={toolbarRef}
          className="fixed z-50"
          style={{ left: toolbar.x, top: toolbar.y, transform: 'translate(-50%, -100%)' }}
        >
          {toolbar.step === 'main' ? (
            <div className="bg-gray-900 text-white rounded-xl shadow-xl flex items-center gap-0.5 p-1">
              <button
                onMouseDown={e => { e.preventDefault(); addAnnotation('highlight') }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg hover:bg-yellow-500 transition">
                <Highlighter size={12} /> 하이라이트
              </button>
              <div className="w-px h-4 bg-gray-600" />
              <button
                onMouseDown={e => { e.preventDefault(); addAnnotation('chunk') }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg hover:bg-sky-500 transition">
                <Scissors size={12} /> 끊어읽기
              </button>
              <div className="w-px h-4 bg-gray-600" />
              <button
                onMouseDown={e => { e.preventDefault(); setToolbar(t => t ? { ...t, step: 'vocab' } : null) }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg hover:bg-purple-500 transition">
                <BookA size={12} /> 어휘 연결
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-3 w-64">
              <p className="text-[11px] font-bold text-gray-500 mb-1">📘 어휘 DB에서 연결</p>
              <p className="text-[10px] text-gray-400 mb-2">어휘 데이터베이스에 저장된 단어명을 입력하세요</p>
              <input
                autoFocus
                value={vocabQuery}
                onChange={e => setVocabQuery(e.target.value)}
                placeholder="예: establish, ancient..."
                className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-400 mb-2"
              />
              {vocabLoading && <p className="text-xs text-gray-400 text-center py-1"><Loader2 size={12} className="animate-spin inline" /></p>}
              {vocabResults.map(w => (
                <button key={w.id}
                  onMouseDown={e => { e.preventDefault(); addAnnotation('vocab', w) }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-purple-50 text-xs transition">
                  <span className="font-bold text-gray-900">{w.word}</span>
                  <span className="text-gray-400 ml-1.5">{w.definition_ko}</span>
                </button>
              ))}
              {!vocabLoading && vocabQuery && vocabResults.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-1">어휘 DB에 없는 단어예요</p>
              )}
              <div className="border-t border-gray-100 mt-2 pt-2">
                <button
                  onMouseDown={e => { e.preventDefault(); addAnnotation('vocab') }}
                  className="w-full text-center text-[11px] text-gray-400 hover:text-purple-600 py-0.5 transition">
                  연결 없이 표시만 추가
                </button>
              </div>
            </div>
          )}
          {/* Caret */}
          <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  )
}
