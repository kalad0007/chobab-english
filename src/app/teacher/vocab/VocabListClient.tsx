'use client'

import { useState, useTransition, useEffect } from 'react'
import Link from 'next/link'
import {
  Search, Volume2, Pencil, Trash2, VolumeX, Plus, X,
  ChevronDown, BookA, Layers, Check, Send, BookOpen,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { deleteVocabWord } from './actions'
import { addCustomTopic, deleteCustomTopic } from './topic-actions'
import { createVocabSetFromWordIds } from './set-actions'

interface Word {
  id: string
  word: string
  part_of_speech: string
  definition_ko: string
  synonyms: string[]
  topic_category: string
  difficulty: number
  audio_url: string | null
  is_active: boolean
  created_at: string
}

interface CustomTopic {
  id: string; value: string; label: string; emoji: string
}

const POS_COLOR: Record<string, string> = {
  adjective: 'bg-blue-100 text-blue-700', noun: 'bg-emerald-100 text-emerald-700',
  verb: 'bg-violet-100 text-violet-700', adverb: 'bg-amber-100 text-amber-700',
  preposition: 'bg-rose-100 text-rose-700', conjunction: 'bg-teal-100 text-teal-700',
  phrase: 'bg-orange-100 text-orange-700',
}
const DIFF_COLOR = (d: number) => d >= 4.5 ? 'text-red-500' : d >= 3.5 ? 'text-orange-500' : d >= 2.5 ? 'text-yellow-600' : 'text-emerald-600'
const CUSTOM_TOPIC_EMOJI = '🏷️'

export default function VocabListClient({
  initialWords, topics, customTopics: initialCustomTopics,
}: {
  initialWords: Word[]
  topics: { value: string; label: string; emoji: string }[]
  customTopics: CustomTopic[]
}) {
  const [words, setWords] = useState(initialWords)
  const [search, setSearch] = useState('')
  const [filterTopic, setFilterTopic] = useState('all')
  const [isPending, startTransition] = useTransition()
  const [playingId, setPlayingId] = useState<string | null>(null)

  // Topic management
  const [customTopics, setCustomTopics] = useState(initialCustomTopics)
  const [allTopics, setAllTopics] = useState(topics)
  const [showTopicManager, setShowTopicManager] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [addingTopic, setAddingTopic] = useState(false)
  const [topicError, setTopicError] = useState('')

  // Set creation mode
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showSetPanel, setShowSetPanel] = useState(false)
  const [setTitle, setSetTitle] = useState('')
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([])
  const [selectedClasses, setSelectedClasses] = useState<Set<string>>(new Set())
  const [creatingSet, setCreatingSet] = useState(false)
  const [setError, setSetError] = useState('')

  useEffect(() => {
    if (!selectMode) return
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      createClient().from('classes').select('id, name').eq('teacher_id', user.id).order('created_at')
        .then(({ data }) => setClasses(data ?? []))
    })
  }, [selectMode])

  function handleDelete(id: string) {
    if (!confirm('이 단어를 삭제하시겠습니까?')) return
    startTransition(async () => {
      await deleteVocabWord(id)
      setWords(prev => prev.filter(w => w.id !== id))
    })
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return
    if (!confirm(`선택한 ${selected.size}개 단어를 삭제하시겠습니까?`)) return
    const ids = [...selected]
    for (const id of ids) await deleteVocabWord(id)
    setWords(prev => prev.filter(w => !ids.includes(w.id)))
    setSelected(new Set())
  }

  function playAudio(word: Word) {
    if (!word.audio_url) return
    if (playingId === word.id) { setPlayingId(null); return }
    const audio = new Audio(word.audio_url)
    setPlayingId(word.id)
    audio.onended = () => setPlayingId(null)
    audio.onerror = () => setPlayingId(null)
    audio.play()
  }

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
    if (filterTopic === topic.value) setFilterTopic('all')
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function enterSelectMode() {
    setSelectMode(true)
    setSelected(new Set())
    setShowSetPanel(false)
  }

  function exitSelectMode() {
    setSelectMode(false)
    setSelected(new Set())
    setShowSetPanel(false)
    setSetTitle('')
    setSelectedClasses(new Set())
  }

  async function handleCreateSet() {
    if (!setTitle.trim()) return setSetError('세트 이름을 입력하세요')
    if (selected.size === 0) return setSetError('단어를 선택하세요')
    setCreatingSet(true); setSetError('')

    // Guess topic from majority of selected words
    const selWords = words.filter(w => selected.has(w.id))
    const topicCount: Record<string, number> = {}
    for (const w of selWords) topicCount[w.topic_category] = (topicCount[w.topic_category] ?? 0) + 1
    const dominantTopic = Object.entries(topicCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'general'
    const avgDiff = selWords.reduce((s, w) => s + w.difficulty, 0) / selWords.length

    const result = await createVocabSetFromWordIds({
      title: setTitle.trim(),
      topic_category: dominantTopic,
      difficulty: Math.round(avgDiff * 2) / 2,
      classIds: [...selectedClasses],
      wordIds: [...selected],
    })
    setCreatingSet(false)
    if (result.error) return setSetError(result.error)
    exitSelectMode()
    window.location.href = '/teacher/vocab/sets'
  }

  const filtered = words.filter(w => {
    if (filterTopic !== 'all' && w.topic_category !== filterTopic) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return w.word.toLowerCase().includes(q) || w.definition_ko.includes(q) ||
             w.synonyms.some(s => s.toLowerCase().includes(q))
    }
    return true
  })

  const topicCounts: Record<string, number> = {}
  for (const w of words) topicCounts[w.topic_category] = (topicCounts[w.topic_category] ?? 0) + 1

  return (
    <div>
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 flex-1 max-w-64">
          <Search size={13} className="text-gray-400 flex-shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="단어, 뜻, 동의어..."
            className="text-sm text-gray-900 flex-1 focus:outline-none" />
        </div>
        <select value={filterTopic} onChange={e => setFilterTopic(e.target.value)}
          className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none">
          <option value="all">전체 주제</option>
          {allTopics.filter(t => topicCounts[t.value]).map(t => (
            <option key={t.value} value={t.value}>{t.emoji} {t.label} ({topicCounts[t.value]})</option>
          ))}
        </select>
        <button onClick={() => setShowTopicManager(v => !v)}
          className="flex items-center gap-1 text-xs font-bold px-2.5 py-2 bg-white border border-gray-200 hover:border-blue-300 text-gray-500 hover:text-blue-600 rounded-xl transition">
          주제 <ChevronDown size={12} className={`transition-transform ${showTopicManager ? 'rotate-180' : ''}`} />
        </button>

        {/* Set creation button */}
        {!selectMode ? (
          <button onClick={enterSelectMode}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition ml-auto">
            <Layers size={13} /> 선택
          </button>
        ) : (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-blue-600 font-bold">{selected.size}개 선택</span>
            <button onClick={() => setSelected(new Set(filtered.map(w => w.id)))}
              className="text-xs text-gray-500 hover:text-gray-700 underline">전체</button>
            <button onClick={() => setSelected(new Set())}
              className="text-xs text-gray-400 hover:text-gray-600 underline">해제</button>
            <button onClick={exitSelectMode}
              className="text-xs font-bold px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition">
              취소
            </button>
            {selected.size > 0 && (
              <>
                <button onClick={handleBulkDelete}
                  className="text-xs font-bold px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg transition">
                  선택 삭제
                </button>
                <button onClick={() => setShowSetPanel(true)}
                  className="text-xs font-bold px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition">
                  세트로 묶기 →
                </button>
              </>
            )}
          </div>
        )}

        {!selectMode && <span className="text-xs text-gray-400">{filtered.length}개</span>}
      </div>

      {/* Topic manager panel */}
      {showTopicManager && (
        <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-4 mb-4">
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

      {/* Set creation panel */}
      {showSetPanel && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-4">
          <p className="text-sm font-extrabold text-blue-800 mb-3">
            <Layers size={14} className="inline mr-1.5 -mt-0.5" />
            {selected.size}개 단어로 세트 만들기
          </p>
          <div className="space-y-3">
            <input value={setTitle} onChange={e => setSetTitle(e.target.value)}
              placeholder="세트 이름을 입력하세요"
              className="w-full border border-blue-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
            {classes.length > 0 && (
              <div>
                <p className="text-xs text-blue-600 font-bold mb-2">배포할 반 (미선택 시 임시저장)</p>
                <div className="flex flex-wrap gap-2">
                  {classes.map(cls => {
                    const on = selectedClasses.has(cls.id)
                    return (
                      <button key={cls.id} onClick={() => setSelectedClasses(prev => {
                        const next = new Set(prev); on ? next.delete(cls.id) : next.add(cls.id); return next
                      })}
                        className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border-2 transition ${on ? 'border-blue-500 bg-white text-blue-700' : 'border-blue-200 text-blue-400 hover:border-blue-400'}`}>
                        {on && <Check size={11} />} {cls.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            {setError && <p className="text-xs text-red-500">{setError}</p>}
            <div className="flex gap-2">
              <button onClick={() => setShowSetPanel(false)}
                className="flex-1 py-2 text-sm font-bold text-gray-500 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition">
                취소
              </button>
              <button onClick={handleCreateSet} disabled={creatingSet || !setTitle.trim()}
                className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition disabled:opacity-50">
                {creatingSet ? '저장 중...' : selectedClasses.size > 0 ? <><Send size={14} /> {selectedClasses.size}개 반에 배포</> : <><BookOpen size={14} /> 임시저장</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compact word list */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {filtered.map((word, idx) => {
          const topic = allTopics.find(t => t.value === word.topic_category)
          const isSelected = selected.has(word.id)
          return (
            <div key={word.id}
              className={`flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0 group transition
                ${selectMode ? 'cursor-pointer hover:bg-blue-50' : 'hover:bg-gray-50'}
                ${isSelected ? 'bg-blue-50' : ''}
              `}
              onClick={selectMode ? () => toggleSelect(word.id) : undefined}
            >
              {/* Checkbox (select mode) */}
              {selectMode && (
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition
                  ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                  {isSelected && <Check size={10} className="text-white" />}
                </div>
              )}

              {/* Word */}
              <p className="font-extrabold text-gray-900 text-sm w-28 truncate flex-shrink-0">{word.word}</p>

              {/* POS badge */}
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 hidden sm:inline ${POS_COLOR[word.part_of_speech] ?? 'bg-gray-100 text-gray-600'}`}>
                {word.part_of_speech}
              </span>

              {/* Definition */}
              <p className="text-xs text-gray-500 flex-1 truncate">{word.definition_ko}</p>

              {/* Synonyms - desktop only */}
              <div className="hidden lg:flex gap-1 flex-shrink-0 w-36 overflow-hidden">
                {word.synonyms.slice(0, 2).map(s => (
                  <span key={s} className="text-[10px] bg-purple-50 text-purple-500 font-medium px-1.5 py-0.5 rounded-full truncate">{s}</span>
                ))}
              </div>

              {/* Topic + difficulty */}
              <span className="text-[11px] text-gray-400 flex-shrink-0 hidden md:block w-20 truncate text-right">
                {topic?.emoji} {topic?.label ?? word.topic_category}
              </span>
              <span className={`text-[11px] font-bold flex-shrink-0 w-12 text-right ${DIFF_COLOR(word.difficulty)}`}>
                B{word.difficulty.toFixed(1)}
              </span>

              {/* Actions */}
              {!selectMode && (
                <div className="flex gap-0.5 flex-shrink-0 transition">
                  {word.audio_url ? (
                    <button onClick={() => playAudio(word)}
                      className="p-1.5 rounded-lg text-sky-500 hover:bg-sky-50 transition">
                      {playingId === word.id ? <Volume2 size={13} className="animate-pulse" /> : <Volume2 size={13} />}
                    </button>
                  ) : (
                    <span className="p-1.5 text-red-400" title="TTS 없음"><VolumeX size={13} /></span>
                  )}
                  <Link href={`/teacher/vocab/${word.id}/edit`}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition">
                    <Pencil size={13} />
                  </Link>
                  <button onClick={() => handleDelete(word.id)} disabled={isPending}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition disabled:opacity-40">
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {words.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
          <BookA size={48} className="mx-auto text-gray-200 mb-4" />
          <p className="font-bold text-gray-400 text-lg">아직 단어가 없어요</p>
          <p className="text-sm text-gray-300 mt-1 mb-6">첫 번째 TOEFL 어휘 카드를 만들어 보세요</p>
          <Link href="/teacher/vocab/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition">
            <Plus size={15} /> 새 단어 추가
          </Link>
        </div>
      )}
      {words.length > 0 && filtered.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <p className="text-gray-400 font-medium text-sm">검색 결과가 없어요</p>
        </div>
      )}
    </div>
  )
}
