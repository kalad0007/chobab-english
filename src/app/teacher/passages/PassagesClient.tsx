'use client'

import { useState, useMemo, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Pencil, Globe, Lock, Search, X, Plus, ChevronDown, Eye, Loader2, ChevronRight } from 'lucide-react'
import { deletePassage } from './actions'
import { addCustomTopic, deleteCustomTopic } from '../vocab/topic-actions'
import { createClient } from '@/lib/supabase/client'
import { renderParts } from './_shared'
import type { Annotation } from './actions'

const CUSTOM_TOPIC_EMOJI = '🏷️'

interface Passage {
  id: string
  title: string
  topic_category: string
  topicEmoji: string
  topicLabel: string
  difficulty: number
  is_published: boolean
  source: string | null
  paraCount: number
}

interface PreviewPara {
  order_num: number
  text: string
  text_ko: string | null
  explanation: string | null
  annotations: Annotation[]
  vocab_json: { word: string; meaning_ko: string; context: string }[]
}

interface Topic {
  value: string
  label: string
  emoji: string
}

interface CustomTopic {
  id: string
  value: string
  label: string
  emoji: string
}

export default function PassagesClient({
  passages,
  topics,
  customTopics: initialCustomTopics,
}: {
  passages: Passage[]
  topics: Topic[]
  customTopics: CustomTopic[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [filterTopic, setFilterTopic] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'published' | 'draft'>('all')

  // Preview state
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [previewPassage, setPreviewPassage] = useState<Passage | null>(null)
  const [previewParas, setPreviewParas] = useState<PreviewPara[]>([])
  const [previewLoading, setPreviewLoading] = useState(false)
  const [openParas, setOpenParas] = useState<Set<number>>(new Set([0]))

  // Topic management
  const [customTopics, setCustomTopics] = useState(initialCustomTopics)
  const [allTopics, setAllTopics] = useState(topics)
  const [showTopicManager, setShowTopicManager] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [addingTopic, setAddingTopic] = useState(false)
  const [topicError, setTopicError] = useState('')

  async function handleAddTopic() {
    const label = newLabel.trim()
    if (!label) return setTopicError('주제 이름을 입력하세요')
    const value = `custom_${label.replace(/\s+/g, '_').toLowerCase()}_${Date.now()}`
    setAddingTopic(true); setTopicError('')
    const result = await addCustomTopic({ value, label, emoji: CUSTOM_TOPIC_EMOJI })
    setAddingTopic(false)
    if ('error' in result && result.error) return setTopicError(result.error)
    const newTopic: CustomTopic = { id: `temp_${Date.now()}`, value, label, emoji: CUSTOM_TOPIC_EMOJI }
    setCustomTopics(prev => [...prev, newTopic])
    setAllTopics(prev => [...prev, { value, label, emoji: CUSTOM_TOPIC_EMOJI }])
    setNewLabel('')
  }

  async function handleDeleteTopic(topic: CustomTopic) {
    if (!confirm(`'${topic.label}' 주제를 삭제하시겠습니까?`)) return
    await deleteCustomTopic(topic.id)
    setCustomTopics(prev => prev.filter(t => t.id !== topic.id))
    setAllTopics(prev => prev.filter(t => t.value !== topic.value))
    if (filterTopic === topic.value) setFilterTopic('')
  }

  async function openPreview(p: Passage) {
    setPreviewId(p.id)
    setPreviewPassage(p)
    setPreviewParas([])
    setPreviewLoading(true)
    setOpenParas(new Set([0]))
    const supabase = createClient()
    const { data } = await supabase
      .from('passage_paragraphs')
      .select('order_num, text, text_ko, annotations, vocab_json')
      .eq('passage_id', p.id)
      .order('order_num')
    setPreviewParas((data ?? []).map(r => ({
      order_num: r.order_num,
      text: r.text,
      text_ko: r.text_ko,
      explanation: (r as any).explanation ?? null,
      annotations: r.annotations ?? [],
      vocab_json: (r as any).vocab_json ?? [],
    })))
    setPreviewLoading(false)
  }

  function togglePara(idx: number) {
    setOpenParas(prev => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }

  function handleDelete(id: string) {
    if (!confirm('이 지문을 삭제하시겠습니까?')) return
    startTransition(async () => {
      await deletePassage(id)
      router.refresh()
    })
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return passages.filter(p => {
      if (q && !p.title.toLowerCase().includes(q)) return false
      if (filterTopic && p.topic_category !== filterTopic) return false
      if (filterStatus === 'published' && !p.is_published) return false
      if (filterStatus === 'draft' && p.is_published) return false
      return true
    })
  }, [passages, search, filterTopic, filterStatus])

  return (
    <div>
      {/* Filter bar row 1: topic dropdown + search */}
      <div className="flex gap-2 mb-2">
        <select
          value={filterTopic}
          onChange={e => setFilterTopic(e.target.value)}
          className={`border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white flex-shrink-0 ${filterTopic ? 'border-blue-400 text-blue-700 font-semibold' : 'border-gray-200 text-gray-500'}`}
        >
          <option value="">전체 주제</option>
          {allTopics.map(t => (
            <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>
          ))}
        </select>
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="지문 제목 검색..."
            className="w-full pl-8 pr-8 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:border-blue-400 transition bg-white"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Filter bar row 2: topic manage + status filters */}
      <div className="flex items-center gap-2 mb-3">
        <button onClick={() => setShowTopicManager(v => !v)}
          className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 bg-white border border-gray-200 hover:border-blue-300 text-gray-500 hover:text-blue-600 rounded-xl transition">
          주제 <ChevronDown size={12} className={`transition-transform ${showTopicManager ? 'rotate-180' : ''}`} />
        </button>
        {([
          { key: 'all', label: '전체' },
          { key: 'published', label: '배포됨' },
          { key: 'draft', label: '임시저장' },
        ] as { key: 'all' | 'published' | 'draft'; label: string }[]).map(opt => (
          <button
            key={opt.key}
            onClick={() => setFilterStatus(opt.key)}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
              filterStatus === opt.key ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:border-blue-300'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Topic manager panel */}
      {showTopicManager && (
        <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-4 mb-3">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">주제 관리</p>
          {customTopics.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {customTopics.map(t => (
                <span key={t.id} className="flex items-center gap-1.5 bg-purple-50 border border-purple-200 text-purple-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                  {t.emoji} {t.label}
                  <button onClick={() => handleDeleteTopic(t)} className="text-purple-400 hover:text-red-500"><X size={10} /></button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2 items-center">
            <span className="text-base">{CUSTOM_TOPIC_EMOJI}</span>
            <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddTopic()}
              placeholder="새 주제 이름 (예: 해양학, 스포츠과학...)"
              className="flex-1 border border-gray-200 rounded-xl px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400" />
            <button onClick={handleAddTopic} disabled={addingTopic || !newLabel.trim()}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition disabled:opacity-50">
              <Plus size={13} /> 추가
            </button>
          </div>
          {topicError && <p className="text-xs text-red-500 mt-1.5">{topicError}</p>}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {topics.filter(t => !customTopics.some(c => c.value === t.value)).map(t => (
              <span key={t.value} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{t.emoji} {t.label}</span>
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-10">검색 결과가 없어요</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {filtered.map((p, idx) => (
            <div key={p.id}
              onClick={() => openPreview(p)}
              className={`flex items-center gap-3 px-4 py-3 cursor-pointer ${idx < filtered.length - 1 ? 'border-b border-gray-50' : ''} hover:bg-gray-50 group transition`}>
              <span className="text-base flex-shrink-0">{p.topicEmoji}</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 text-sm truncate">{p.title}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {p.topicLabel} · {p.paraCount}문단 · Band {p.difficulty.toFixed(1)}
                  {p.source && <span> · {p.source}</span>}
                </p>
              </div>
              <span className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${p.is_published ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                {p.is_published ? <><Globe size={10} /> 배포됨</> : <><Lock size={10} /> 임시저장</>}
              </span>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                <button
                  onClick={e => { e.stopPropagation(); openPreview(p) }}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 transition">
                  <Eye size={14} />
                </button>
                <Link href={`/teacher/passages/${p.id}/edit`}
                  onClick={e => e.stopPropagation()}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition">
                  <Pencil size={14} />
                </Link>
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(p.id) }}
                  disabled={isPending}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition disabled:opacity-40">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Floating preview overlay */}
      {previewId && previewPassage && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-12 overflow-y-auto" onClick={() => setPreviewId(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 rounded-t-2xl flex items-start justify-between gap-3 z-10">
              <div className="min-w-0">
                <p className="font-extrabold text-gray-900 text-base truncate">{previewPassage.topicEmoji} {previewPassage.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {previewPassage.topicLabel} · {previewPassage.paraCount}문단 · Band {previewPassage.difficulty.toFixed(1)}
                  {previewPassage.source && <span> · {previewPassage.source}</span>}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Link href={`/teacher/passages/${previewId}/edit`}
                  className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition">
                  <Pencil size={12} /> 수정
                </Link>
                <button onClick={() => setPreviewId(null)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition">
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="px-5 py-4 space-y-2">
              {previewLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={24} className="animate-spin text-gray-300" />
                </div>
              ) : previewParas.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">문단이 없습니다</p>
              ) : (
                previewParas.map((para, idx) => {
                  const isOpen = openParas.has(idx)
                  const parts = renderParts(para.text, para.annotations)
                  return (
                    <div key={idx} className="border border-gray-100 rounded-xl overflow-hidden">
                      {/* Accordion header */}
                      <button
                        onClick={() => togglePara(idx)}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-gray-50 transition"
                      >
                        <ChevronRight size={14} className={`text-gray-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-90' : ''}`} />
                        <span className="text-xs font-bold text-gray-500 flex-shrink-0">문단 {idx + 1}</span>
                        <span className="text-xs text-gray-400 truncate flex-1">
                          {para.text.slice(0, 60)}{para.text.length > 60 ? '…' : ''}
                        </span>
                      </button>

                      {/* Accordion body */}
                      {isOpen && (
                        <div className="px-4 pb-4 space-y-2">
                          {/* English text with annotations */}
                          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm leading-relaxed text-gray-800">
                            {parts.map((p, i) => {
                              if (p.type === 'plain') return <span key={i}>{p.text}</span>
                              if (p.type === 'highlight') return <mark key={i} className="bg-yellow-300 rounded px-0.5">{p.text}</mark>
                              if (p.type === 'chunk') return (
                                <span key={i}>
                                  <span className="bg-sky-100 text-sky-800 rounded px-0.5">{p.text}</span>
                                  <span className="text-gray-400 font-bold mx-1">/</span>
                                </span>
                              )
                              if (p.type === 'vocab') return (
                                <span key={i} className="text-purple-700 underline underline-offset-2 decoration-dotted">{p.text}</span>
                              )
                              return <span key={i}>{p.text}</span>
                            })}
                          </div>

                          {/* Korean translation */}
                          {para.text_ko && (
                            <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-100 text-xs text-gray-700 leading-relaxed">
                              <span className="text-[10px] font-bold text-blue-500 block mb-1">번역</span>
                              {para.text_ko}
                            </div>
                          )}

                          {/* Explanation */}
                          {para.explanation && (
                            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100 text-xs text-gray-700 leading-relaxed">
                              <span className="text-[10px] font-bold text-emerald-600 block mb-1">해설</span>
                              {para.explanation}
                            </div>
                          )}

                          {/* Vocab list */}
                          {para.vocab_json.length > 0 && (
                            <div className="overflow-x-auto rounded-xl border border-purple-100">
                              <table className="w-full text-xs border-collapse">
                                <thead>
                                  <tr className="bg-purple-50">
                                    <th className="text-left px-2 py-1.5 text-purple-600 font-bold border-b border-purple-100">단어</th>
                                    <th className="text-left px-2 py-1.5 text-purple-600 font-bold border-b border-purple-100">뜻</th>
                                    <th className="text-left px-2 py-1.5 text-purple-600 font-bold border-b border-purple-100">문맥</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {para.vocab_json.map((v, vi) => (
                                    <tr key={vi} className={vi % 2 === 0 ? 'bg-white' : 'bg-purple-50/40'}>
                                      <td className="px-2 py-1.5 font-semibold text-gray-800 border-b border-purple-50">{v.word}</td>
                                      <td className="px-2 py-1.5 text-purple-700 border-b border-purple-50">{v.meaning_ko}</td>
                                      <td className="px-2 py-1.5 text-gray-600 border-b border-purple-50">{v.context}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
