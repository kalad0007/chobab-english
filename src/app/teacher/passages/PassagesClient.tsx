'use client'

import { useState, useMemo, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Pencil, Globe, Lock, Search, X, Plus, ChevronDown } from 'lucide-react'
import { deletePassage } from './actions'
import { addCustomTopic, deleteCustomTopic } from '../vocab/topic-actions'

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
              className={`flex items-center gap-3 px-4 py-3 ${idx < filtered.length - 1 ? 'border-b border-gray-50' : ''} hover:bg-gray-50 group transition`}>
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
                <Link href={`/teacher/passages/${p.id}/edit`}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition">
                  <Pencil size={14} />
                </Link>
                <button
                  onClick={() => handleDelete(p.id)}
                  disabled={isPending}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition disabled:opacity-40">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
