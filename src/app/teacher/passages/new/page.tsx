'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Trash2, ChevronUp, ChevronDown, Sparkles, Loader2,
  Check, Send, BookOpen, ChevronLeft, Highlighter, Scissors, BookA, X, Wand2
} from 'lucide-react'
import { createPassage } from '../actions'
import AutoResizeTextarea from '@/components/ui/AutoResizeTextarea'
import UnderlineTextarea from '@/components/ui/UnderlineTextarea'
import { TOEFL_TOPICS } from '../../vocab/constants'
import { createClient } from '@/lib/supabase/client'
import {
  AnnotatedView, DIFFICULTY_OPTIONS, uid, autoChunkBySentences,
  type ParagraphState, type Toolbar, type VocabWord,
} from '../_shared'
import type { Annotation } from '../actions'

export default function NewPassagePage() {
  const router = useRouter()

  const [title, setTitle] = useState('')
  const [topic, setTopic] = useState('history_world')
  const [difficulty, setDifficulty] = useState(3.0)
  const [source, setSource] = useState('')
  const [paragraphs, setParagraphs] = useState<ParagraphState[]>([
    { id: uid(), text: '', text_ko: '', explanation: '', annotations: [], mode: 'edit', translating: false, vocab_list: [] },
  ])
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([])
  const [selectedClasses, setSelectedClasses] = useState<Set<string>>(new Set())
  const [linkedQIds, setLinkedQIds] = useState<string[]>([])
  const [qSearch, setQSearch] = useState('')
  const [qResults, setQResults] = useState<{ id: string; content: string; summary: string | null }[]>([])
  const [qSearching, setQSearching] = useState(false)
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
    setParagraphs(prev => [...prev, { id: uid(), text: '', text_ko: '', explanation: '', annotations: [], mode: 'edit', translating: false, vocab_list: [] }])
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
      if (data.explanation) updatePara(id, { explanation: data.explanation })
      if (data.vocab) updatePara(id, { vocab_list: data.vocab })
      // auto-chunk if not already chunked
      const hasChunks = para.annotations.some(a => a.type === 'chunk')
      if (!hasChunks) updatePara(id, { annotations: autoChunkBySentences(para.text) })
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

  async function searchQuestions(q: string) {
    if (!q.trim()) { setQResults([]); return }
    setQSearching(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setQSearching(false); return }
    const { data } = await supabase
      .from('questions')
      .select('id, content, summary')
      .eq('teacher_id', user.id)
      .eq('type', 'multiple_choice')
      .eq('is_active', true)
      .or(`content.ilike.%${q}%,summary.ilike.%${q}%`)
      .not('id', 'in', `(${linkedQIds.length > 0 ? linkedQIds.join(',') : '00000000-0000-0000-0000-000000000000'})`)
      .limit(5)
    setQResults(data ?? [])
    setQSearching(false)
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
          id: uid(), text, text_ko: '', explanation: '', vocab_list: [],
          annotations: autoChunkBySentences(text),
          mode: 'edit' as const, translating: false,
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
      questionIds: linkedQIds,
      paragraphs: validParas.map((p, i) => ({
        order_num: i + 1, text: p.text, text_ko: p.text_ko, explanation: p.explanation,
        annotations: p.annotations,
        vocab_json: p.vocab_list,
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
                  AI 번역·해설
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
              <AutoResizeTextarea
                value={para.text}
                onChange={e => updatePara(para.id, { text: e.target.value })}
                placeholder="영어 본문을 입력하세요..."
                minRows={4}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400 leading-relaxed"
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
              <UnderlineTextarea
                value={para.text_ko}
                onChange={v => updatePara(para.id, { text_ko: v })}
                placeholder="AI 번역·해설 버튼을 누르거나 직접 입력하세요..."
                rows={2}
                className="w-full border border-blue-100 bg-blue-50 rounded-xl px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300 leading-normal"
              />
            </div>
            {/* 독해 해설 */}
            <div className="mt-2">
              <label className="text-[11px] font-bold text-emerald-600 mb-1 block">독해 해설</label>
              <UnderlineTextarea
                value={para.explanation}
                onChange={v => updatePara(para.id, { explanation: v })}
                placeholder="AI 번역·해설 버튼을 누르거나 직접 입력하세요..."
                rows={2}
                className="w-full border border-emerald-100 bg-emerald-50 rounded-xl px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-300 leading-normal"
              />
            </div>
            {para.vocab_list && para.vocab_list.length > 0 && (
              <div className="mt-2">
                <label className="text-[11px] font-bold text-purple-600 mb-1 block">📚 주요 어휘</label>
                <div className="overflow-x-auto rounded-xl border border-purple-100">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-purple-50">
                        <th className="text-left px-2 py-1.5 text-purple-600 font-bold border-b border-purple-100 w-1/5">단어</th>
                        <th className="text-left px-2 py-1.5 text-purple-600 font-bold border-b border-purple-100 w-1/5">뜻</th>
                        <th className="text-left px-2 py-1.5 text-purple-600 font-bold border-b border-purple-100">문맥</th>
                      </tr>
                    </thead>
                    <tbody>
                      {para.vocab_list.map((v, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-purple-50/40'}>
                          <td className="px-2 py-1.5 font-semibold text-gray-800 border-b border-purple-50">{v.word}</td>
                          <td className="px-2 py-1.5 text-purple-700 border-b border-purple-50">{v.meaning_ko}</td>
                          <td className="px-2 py-1.5 text-gray-600 border-b border-purple-50 leading-relaxed">{v.context}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <button onClick={addParagraph}
        className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 hover:border-blue-300 text-gray-400 hover:text-blue-500 rounded-2xl text-sm font-bold transition mb-6">
        <Plus size={16} /> 문단 추가
      </button>

      {/* Quiz question linking */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4 space-y-3">
        <h2 className="font-bold text-gray-900">📝 확인 퀴즈 연결 (선택)</h2>
        <p className="text-xs text-gray-400">문제은행에서 객관식 문제를 연결하면 학생이 지문을 읽은 후 퀴즈를 풀 수 있습니다.</p>
        <div className="flex gap-2">
          <input
            value={qSearch}
            onChange={e => { setQSearch(e.target.value); searchQuestions(e.target.value) }}
            placeholder="문제 내용으로 검색..."
            className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          {qSearching && <Loader2 size={16} className="animate-spin text-gray-400 self-center" />}
        </div>
        {qResults.length > 0 && (
          <div className="border border-gray-100 rounded-xl divide-y divide-gray-50 shadow-sm">
            {qResults.map(q => (
              <button key={q.id} onClick={() => { setLinkedQIds(p => [...p, q.id]); setQResults([]); setQSearch('') }}
                className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-blue-50 transition">
                {q.summary || q.content.slice(0, 80)}
              </button>
            ))}
          </div>
        )}
        {linkedQIds.length > 0 && (
          <div className="space-y-1">
            {linkedQIds.map((qid, i) => (
              <div key={qid} className="flex items-center gap-2 text-xs bg-gray-50 px-3 py-2 rounded-lg">
                <span className="text-gray-400 font-bold w-4">{i + 1}</span>
                <span className="flex-1 text-gray-600 truncate font-mono text-[10px]">{qid}</span>
                <button onClick={() => setLinkedQIds(p => p.filter(id => id !== qid))} className="text-gray-300 hover:text-red-400 transition">
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

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
