'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Wand2, Loader2, Check, X, ChevronRight, ChevronLeft,
  RefreshCw, BookA, Sparkles, Send, ChevronDown
} from 'lucide-react'
import { createVocabSet } from '../set-actions'
import { TOEFL_TOPICS } from '../constants'
import { getCustomTopics } from '../topic-actions'

const DIFFICULTY_OPTIONS = [
  { value: 2.0, label: 'Band 2.0 (A2 · 초급)' },
  { value: 2.5, label: 'Band 2.5 (B1-)' },
  { value: 3.0, label: 'Band 3.0 (B1 · 중급)' },
  { value: 3.5, label: 'Band 3.5 (B1+)' },
  { value: 4.0, label: 'Band 4.0 (B2 · 고급)' },
  { value: 4.5, label: 'Band 4.5 (B2+)' },
  { value: 5.0, label: 'Band 5.0 (C1 · 심화)' },
]

interface GeneratedWord {
  word: string
  part_of_speech: string
  definition_ko: string
  definition_en: string
  synonyms: string[]
  antonyms: string[]
  example_sentence: string
  example_sentence_ko: string
  audio_url: string | null
  status: 'pending' | 'loading' | 'done' | 'error'
}

const createClient = () => {
  if (typeof window === 'undefined') return null
  // Use browser supabase just to get classes list
  const { createClient: cc } = require('@/lib/supabase/client')
  return cc()
}

export default function VocabGeneratePage() {
  const router = useRouter()

  const [allTopics, setAllTopics] = useState(TOEFL_TOPICS)

  const [existingWords, setExistingWords] = useState<string[]>([])

  // Step 1 state
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [topic, setTopic] = useState('astronomy')
  const [count, setCount] = useState(15)
  const [difficulty, setDifficulty] = useState(3.0)
  const [suggesting, setSuggesting] = useState(false)

  // Step 2 state
  const [suggestedWords, setSuggestedWords] = useState<string[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [generatedWords, setGeneratedWords] = useState<GeneratedWord[]>([])
  const [generating, setGenerating] = useState(false)
  const [genProgress, setGenProgress] = useState(0)

  // Step 3 state
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([])
  const [selectedClasses, setSelectedClasses] = useState<Set<string>>(new Set())
  const [setTitle, setSetTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const topicLabel = allTopics.find(t => t.value === topic)

  // Load custom topics + existing words on mount
  useEffect(() => {
    getCustomTopics().then(custom => {
      if (custom.length > 0) {
        setAllTopics([...TOEFL_TOPICS, ...custom.map(t => ({ value: t.value, label: t.label, emoji: t.emoji }))])
      }
    })
    async function loadExistingWords() {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('vocab_words')
        .select('word')
        .eq('teacher_id', user.id)
      setExistingWords((data ?? []).map((r: { word: string }) => r.word.toLowerCase()))
    }
    loadExistingWords()
  }, [])

  useEffect(() => {
    async function loadClasses() {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('classes').select('id, name').eq('teacher_id', user.id).order('created_at')
      setClasses(data ?? [])
    }
    loadClasses()
  }, [])

  // Auto-suggest title when reaching step 3
  useEffect(() => {
    if (step === 3 && !setTitle) {
      const t = allTopics.find(t => t.value === topic)
      const done = generatedWords.filter(w => w.status === 'done')
      setSetTitle(`${t?.emoji ?? ''} ${t?.label ?? topic} · Band ${difficulty.toFixed(1)} · ${done.length}단어`)
    }
  }, [step])

  async function handleSuggest() {
    setSuggesting(true); setError('')
    const res = await fetch('/api/ai/vocab-suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, count, difficulty, excludeWords: existingWords }),
    })
    const data = await res.json()
    setSuggesting(false)
    if (!res.ok) return setError('단어 목록 생성 실패: ' + (data.error ?? ''))
    const words: string[] = data.words ?? []
    setSuggestedWords(words)
    // Pre-deselect words that already exist in the DB
    setSelected(new Set(words.filter((w: string) => !existingWords.includes(w.toLowerCase()))))
    setStep(2)
  }

  async function handleGenerateDetails() {
    const toGenerate = [...selected]
    if (toGenerate.length === 0) return setError('단어를 선택하세요')
    setGenerating(true); setGenProgress(0); setError('')

    // Initialize all as pending
    const initial: GeneratedWord[] = toGenerate.map(w => ({
      word: w, part_of_speech: '', definition_ko: '', definition_en: '',
      synonyms: [], antonyms: [], example_sentence: '', example_sentence_ko: '', audio_url: null,
      status: 'pending',
    }))
    setGeneratedWords(initial)

    // Generate in batches of 3 (parallel)
    const BATCH = 3
    const results = [...initial]

    for (let i = 0; i < toGenerate.length; i += BATCH) {
      const batch = toGenerate.slice(i, i + BATCH)
      // Mark batch as loading
      for (const w of batch) {
        const idx = results.findIndex(r => r.word === w)
        if (idx >= 0) results[idx] = { ...results[idx], status: 'loading' }
      }
      setGeneratedWords([...results])

      await Promise.all(batch.map(async (word) => {
        const idx = results.findIndex(r => r.word === word)
        try {
          const res = await fetch('/api/ai/vocab-fill', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ word }),
          })
          const data = await res.json()

          // Auto-generate TTS
          let audioUrl: string | null = null
          try {
            const ttsRes = await fetch('/api/ai/tts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ script: word, gender: 'yw', questionId: `vocab_${word}_${Date.now()}` }),
            })
            if (ttsRes.ok) {
              const ttsData = await ttsRes.json()
              audioUrl = ttsData.audioUrl ?? null
            }
          } catch { /* TTS optional */ }

          if (idx >= 0) {
            results[idx] = {
              word,
              part_of_speech: data.part_of_speech ?? '',
              definition_ko: data.definition_ko ?? '',
              definition_en: data.definition_en ?? '',
              synonyms: data.synonyms ?? [],
              antonyms: data.antonyms ?? [],
              example_sentence: data.example_sentence ?? '',
              example_sentence_ko: data.example_sentence_ko ?? '',
              audio_url: audioUrl,
              status: 'done',
            }
          }
        } catch {
          if (idx >= 0) results[idx] = { ...results[idx], status: 'error' }
        }
      }))

      setGeneratedWords([...results])
      setGenProgress(Math.min(i + BATCH, toGenerate.length))
    }

    setGenerating(false)
    setStep(3)
  }

  async function handleSave() {
    const readyWords = generatedWords.filter(w => w.status === 'done')
    if (readyWords.length === 0) return setError('생성된 단어가 없어요')
    if (!setTitle.trim()) return setError('세트 제목을 입력하세요')

    setSaving(true); setError('')
    const result = await createVocabSet({
      title: setTitle.trim(),
      topic_category: topic,
      difficulty,
      classIds: [...selectedClasses],
      words: readyWords,
    })
    setSaving(false)
    if (result.error) return setError(result.error)
    router.push('/teacher/vocab/sets')
  }

  // ── Step 1 ───────────────────────────────────────────────────────────────

  if (step === 1) return (
    <div className="p-4 md:p-7 max-w-xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition">
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
            <Sparkles size={20} className="text-purple-600" /> AI 단어 세트 생성
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">주제와 수준을 설정하면 AI가 단어 목록을 추천해요</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {['설정', '단어 선택', '배포'].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
              {i + 1}
            </div>
            <span className={`text-xs font-medium ${i === 0 ? 'text-blue-600' : 'text-gray-400'}`}>{s}</span>
            {i < 2 && <ChevronRight size={14} className="text-gray-300" />}
          </div>
        ))}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-4">{error}</div>}

      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <label className="text-xs font-bold text-gray-500 mb-1.5 block">주제 (Topic)</label>
          <select value={topic} onChange={e => setTopic(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400">
            {allTopics.map(t => (
              <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>
            ))}
          </select>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <label className="text-xs font-bold text-gray-500 mb-1.5 block">생성 단어 수</label>
          <div className="flex items-center gap-3">
            <input type="range" min={5} max={50} step={5} value={count} onChange={e => setCount(Number(e.target.value))}
              className="flex-1 accent-blue-600" />
            <span className="text-2xl font-extrabold text-blue-600 w-12 text-right">{count}</span>
            <span className="text-sm text-gray-400">개</span>
          </div>
          <div className="flex justify-between text-[10px] text-gray-300 mt-1 px-0.5">
            <span>5</span><span>25</span><span>50</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <label className="text-xs font-bold text-gray-500 mb-1.5 block">수준 (Band)</label>
          <select value={difficulty} onChange={e => setDifficulty(Number(e.target.value))}
            className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400">
            {DIFFICULTY_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>

        {topicLabel && (
          <div className="bg-purple-50 rounded-xl p-4 text-sm text-purple-700">
            <p className="font-bold">{topicLabel.emoji} {topicLabel.label} · Band {difficulty.toFixed(1)} · {count}단어</p>
            <p className="text-xs text-purple-500 mt-0.5">AI가 TOEFL 지문에 자주 등장하는 단어 {count}개를 추천합니다</p>
          </div>
        )}

        <button onClick={handleSuggest} disabled={suggesting}
          className="w-full flex items-center justify-center gap-2 py-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-2xl transition disabled:opacity-50">
          {suggesting ? <><Loader2 size={18} className="animate-spin" /> 단어 목록 생성 중...</> : <><Wand2 size={18} /> AI 단어 목록 생성</>}
        </button>
      </div>
    </div>
  )

  // ── Step 2 ───────────────────────────────────────────────────────────────

  if (step === 2) return (
    <div className="p-4 md:p-7 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => { setStep(1); setSuggestedWords([]) }}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition">
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">단어 선택</h1>
          <p className="text-sm text-gray-400">{topicLabel?.emoji} {topicLabel?.label} · Band {difficulty.toFixed(1)}</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {['설정', '단어 선택', '배포'].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i === 1 ? 'bg-blue-600 text-white' : i < 1 ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
              {i < 1 ? <Check size={12} /> : i + 1}
            </div>
            <span className={`text-xs font-medium ${i === 1 ? 'text-blue-600' : 'text-gray-400'}`}>{s}</span>
            {i < 2 && <ChevronRight size={14} className="text-gray-300" />}
          </div>
        ))}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-4">{error}</div>}

      {!generating && generatedWords.length === 0 && (
        <>
          {/* Select / deselect all */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-600 font-medium">{selected.size} / {suggestedWords.length}개 선택</span>
            <div className="flex gap-2">
              <button onClick={() => setSelected(new Set(suggestedWords))}
                className="text-xs font-bold text-blue-600 hover:underline">전체 선택</button>
              <span className="text-gray-300">|</span>
              <button onClick={() => setSelected(new Set())}
                className="text-xs font-bold text-gray-400 hover:underline">전체 해제</button>
              <span className="text-gray-300">|</span>
              <button onClick={() => { setStep(1); setSuggestedWords([]) }}
                className="flex items-center gap-1 text-xs font-bold text-gray-400 hover:text-gray-600">
                <RefreshCw size={11} /> 재생성
              </button>
            </div>
          </div>

          {/* Word chips grid */}
          <div className="flex flex-wrap gap-2 mb-6 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            {suggestedWords.map(word => {
              const on = selected.has(word)
              const alreadyExists = existingWords.includes(word.toLowerCase())
              return (
                <button key={word} onClick={() => setSelected(prev => {
                  const next = new Set(prev)
                  on ? next.delete(word) : next.add(word)
                  return next
                })}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold border-2 transition ${
                    on
                      ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                      : alreadyExists
                        ? 'bg-gray-50 border-gray-200 text-gray-300'
                        : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}>
                  {on && <Check size={11} className="flex-shrink-0" />}
                  {word}
                  {alreadyExists && (
                    <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${on ? 'bg-blue-500 text-blue-200' : 'bg-gray-200 text-gray-400'}`}>
                      등록됨
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <button onClick={handleGenerateDetails} disabled={selected.size === 0}
            className="w-full flex items-center justify-center gap-2 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition disabled:opacity-50">
            <Sparkles size={18} /> {selected.size}개 단어 상세 생성 (뜻 + 동의어 + 예문 + TTS)
            <ChevronRight size={16} />
          </button>
        </>
      )}

      {/* Generation progress */}
      {generating && (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-bold text-gray-700">단어 상세 정보 생성 중...</p>
            <p className="text-sm text-gray-500">{genProgress} / {selected.size}</p>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2 mb-4">
            <div className="bg-blue-500 h-2 rounded-full transition-all"
              style={{ width: `${(genProgress / selected.size) * 100}%` }} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {generatedWords.map(w => (
              <div key={w.word} className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm ${
                w.status === 'done'    ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                w.status === 'loading' ? 'bg-blue-50 border-blue-200 text-blue-600' :
                w.status === 'error'   ? 'bg-red-50 border-red-200 text-red-600' :
                'bg-gray-50 border-gray-200 text-gray-400'
              }`}>
                {w.status === 'done'    && <Check size={14} />}
                {w.status === 'loading' && <Loader2 size={14} className="animate-spin" />}
                {w.status === 'error'   && <X size={14} />}
                {w.status === 'pending' && <div className="w-3.5 h-3.5 rounded-full bg-gray-200" />}
                <span className="font-semibold">{w.word}</span>
                {w.status === 'done' && w.definition_ko && (
                  <span className="text-xs opacity-70 truncate">{w.definition_ko}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  // ── Step 3 ───────────────────────────────────────────────────────────────

  const doneWords = generatedWords.filter(w => w.status === 'done')

  return (
    <div className="p-4 md:p-7 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => setStep(2)}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition">
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">세트 배포</h1>
          <p className="text-sm text-gray-400">{doneWords.length}개 단어 생성 완료</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {['설정', '단어 선택', '배포'].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i === 2 ? 'bg-blue-600 text-white' : 'bg-emerald-500 text-white'}`}>
              {i < 2 ? <Check size={12} /> : 3}
            </div>
            <span className={`text-xs font-medium ${i === 2 ? 'text-blue-600' : 'text-emerald-600'}`}>{s}</span>
            {i < 2 && <ChevronRight size={14} className="text-gray-300" />}
          </div>
        ))}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-4">{error}</div>}

      <div className="space-y-4">
        {/* Generated word preview */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">생성된 단어 ({doneWords.length}개)</p>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {doneWords.map(w => (
              <div key={w.word} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-extrabold text-gray-900">{w.word}</span>
                    <span className="text-[10px] text-gray-400 italic">{w.part_of_speech}</span>
                    {w.audio_url && <span className="text-[10px] bg-amber-100 text-amber-600 font-bold px-1.5 py-0.5 rounded-full">🔊 TTS</span>}
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5">{w.definition_ko}</p>
                  {w.synonyms.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {w.synonyms.slice(0, 3).map(s => (
                        <span key={s} className="text-[10px] bg-purple-50 text-purple-600 font-semibold px-1.5 py-0.5 rounded-full">{s}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Set title */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <label className="text-xs font-bold text-gray-500 mb-1.5 block">세트 이름</label>
          <input value={setTitle} onChange={e => setSetTitle(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>

        {/* Class selection */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <label className="text-xs font-bold text-gray-500 mb-1.5 block">배포할 반 선택</label>
          {classes.length === 0 ? (
            <p className="text-sm text-gray-400">등록된 반이 없어요. 반을 먼저 만들어주세요.</p>
          ) : (
            <ClassDropdown
              classes={classes}
              selected={selectedClasses}
              onChange={setSelectedClasses}
            />
          )}
          {selectedClasses.size === 0 && (
            <p className="text-xs text-gray-400 mt-2">반을 선택하지 않으면 임시저장 상태로 저장됩니다</p>
          )}
        </div>

        <button onClick={handleSave} disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition disabled:opacity-50">
          {saving
            ? <><Loader2 size={18} className="animate-spin" /> 저장 중...</>
            : selectedClasses.size > 0
              ? <><Send size={18} /> {selectedClasses.size}개 반에 배포하기</>
              : <><BookA size={18} /> 세트 저장 (임시)</>
          }
        </button>
      </div>
    </div>
  )
}

function ClassDropdown({
  classes,
  selected,
  onChange,
}: {
  classes: { id: string; name: string }[]
  selected: Set<string>
  onChange: (s: Set<string>) => void
}) {
  const [open, setOpen] = useState(false)

  function toggle(id: string) {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    onChange(next)
  }

  const selectedList = classes.filter(c => selected.has(c.id))

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500 hover:border-blue-300 transition bg-white"
      >
        <span>{selected.size > 0 ? `${selected.size}개 반 선택됨` : '배포할 반을 선택하세요'}</span>
        <ChevronDown size={15} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {classes.map(cls => {
            const on = selected.has(cls.id)
            return (
              <button
                key={cls.id}
                type="button"
                onClick={() => toggle(cls.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold transition hover:bg-gray-50 ${on ? 'text-blue-700' : 'text-gray-700'}`}
              >
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition ${on ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`}>
                  {on && <Check size={10} className="text-white" />}
                </div>
                {cls.name}
              </button>
            )
          })}
        </div>
      )}

      {selectedList.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selectedList.map(cls => (
            <span key={cls.id} className="flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-semibold px-2.5 py-1 rounded-full">
              {cls.name}
              <button type="button" onClick={() => toggle(cls.id)} className="hover:text-blue-900">
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
