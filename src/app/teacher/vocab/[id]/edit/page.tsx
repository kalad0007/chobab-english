'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Wand2, Loader2, Volume2, Save, X, ChevronLeft, Check, Trash2, ChevronDown } from 'lucide-react'
import { updateVocabWord } from '../../actions'
import { WordLevel, WORD_LEVEL_CONFIG, TOEFL_TOPICS } from '../../constants'
import { getCustomTopics } from '../../topic-actions'

const PARTS_OF_SPEECH = ['adjective','noun','verb','adverb','preposition','conjunction','phrase']
const DIFFICULTY_OPTIONS = [
  { value: 1.5, label: 'Band 1.5 (A1)' },
  { value: 2.0, label: 'Band 2.0 (A2)' },
  { value: 2.5, label: 'Band 2.5 (B1-)' },
  { value: 3.0, label: 'Band 3.0 (B1)' },
  { value: 3.5, label: 'Band 3.5 (B1+)' },
  { value: 4.0, label: 'Band 4.0 (B2)' },
  { value: 4.5, label: 'Band 4.5 (B2+)' },
  { value: 5.0, label: 'Band 5.0 (C1)' },
  { value: 5.5, label: 'Band 5.5 (C2)' },
]

function parseExample(text: string) {
  if (!text) return []
  const parts = text.split(/(\*[^*]+\*| \/ )/)
  return parts.filter(Boolean).map(part => {
    if (part.startsWith('*') && part.endsWith('*'))
      return { text: part.slice(1, -1), type: 'highlight' as const }
    if (part === ' / ') return { text: '/', type: 'slash' as const }
    return { text: part, type: 'normal' as const }
  })
}

function ExamplePreview({ raw }: { raw: string }) {
  const chunks = parseExample(raw)
  if (chunks.length === 0) return null
  return (
    <div className="bg-blue-50 rounded-xl px-4 py-3 flex flex-wrap items-baseline gap-0.5">
      {chunks.map((c, i) =>
        c.type === 'highlight' ? <span key={i} className="text-blue-700 font-bold underline decoration-dotted">{c.text}</span>
        : c.type === 'slash' ? <span key={i} className="text-blue-300 font-bold mx-1 text-sm select-none">/</span>
        : <span key={i} className="text-blue-900 text-sm">{c.text}</span>
      )}
    </div>
  )
}

function ChipInput({ chips, onAdd, onRemove, placeholder, color = 'purple' }: {
  chips: string[]; onAdd: (v: string) => void; onRemove: (v: string) => void
  placeholder?: string; color?: 'purple' | 'rose'
}) {
  const [input, setInput] = useState('')
  const bg = color === 'purple' ? 'bg-purple-100 text-purple-700' : 'bg-rose-100 text-rose-700'
  function commit() {
    const v = input.trim()
    if (v && !chips.includes(v)) onAdd(v)
    setInput('')
  }
  return (
    <div className="flex flex-wrap gap-1.5 p-2 border border-gray-200 rounded-xl min-h-[42px]">
      {chips.map(c => (
        <span key={c} className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${bg}`}>
          {c}<button type="button" onClick={() => onRemove(c)}><X size={10} /></button>
        </span>
      ))}
      <input value={input} onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit() } }}
        onBlur={commit} placeholder={chips.length === 0 ? placeholder : ''}
        className="text-xs text-gray-900 flex-1 min-w-20 focus:outline-none bg-transparent" />
    </div>
  )
}

export default function EditVocabPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [wordLevel, setWordLevel] = useState<WordLevel>('toefl')
  const [wordName, setWordName] = useState('')
  const [pos, setPos] = useState('noun')
  const [defKo, setDefKo] = useState('')
  const [defEn, setDefEn] = useState('')
  const [synonyms, setSynonyms] = useState<string[]>([])
  const [antonyms, setAntonyms] = useState<string[]>([])
  const [idioms, setIdioms] = useState<string[]>([])
  const [morphemes, setMorphemes] = useState<{ prefix?: string; prefix_meaning?: string; root?: string; root_meaning?: string; suffix?: string; suffix_meaning?: string } | null>(null)
  const [collocations, setCollocations] = useState<string[]>([])
  const [topic, setTopic] = useState('general')
  const [difficulty, setDifficulty] = useState(3.0)
  const [example, setExample] = useState('')
  const [exampleKo, setExampleKo] = useState('')
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [allTopics, setAllTopics] = useState(TOEFL_TOPICS)
  const [showExtra, setShowExtra] = useState(false)

  const [filling, setFilling] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('vocab_words')
        .select('word, part_of_speech, definition_ko, definition_en, synonyms, antonyms, idioms, topic_category, difficulty, audio_url, example_sentence, example_sentence_ko, morphemes, collocations, word_level')
        .eq('id', id)
        .single()

      if (data) {
        setWordLevel(
          data.word_level === 'elementary' ? 'elem_3_4' : ((data.word_level as WordLevel) ?? 'toefl')
        )
        setWordName(data.word)
        setPos(data.part_of_speech)
        setDefKo(data.definition_ko)
        setDefEn(data.definition_en ?? '')
        setSynonyms(data.synonyms ?? [])
        setAntonyms(data.antonyms ?? [])
        setIdioms(data.idioms ?? [])
        setTopic(data.topic_category)
        setDifficulty(data.difficulty)
        setExample(data.example_sentence ?? '')
        setExampleKo(data.example_sentence_ko ?? '')
        setAudioUrl(data.audio_url)
        setMorphemes(data.morphemes ?? null)
        setCollocations(data.collocations ?? [])

        const hasSynonyms = (data.synonyms ?? []).length > 0
        const hasAntonyms = (data.antonyms ?? []).length > 0
        const hasIdioms = (data.idioms ?? []).length > 0
        const hasCollocations = (data.collocations ?? []).length > 0
        const hasMorphemes = !!data.morphemes
        if (hasSynonyms || hasAntonyms || hasIdioms || hasCollocations || hasMorphemes) {
          setShowExtra(true)
        }
      }

      const custom = await getCustomTopics()
      if (custom.length > 0)
        setAllTopics([...TOEFL_TOPICS, ...custom.map(t => ({ value: t.value, label: t.label, emoji: t.emoji }))])

      setLoading(false)
    }
    load()
  }, [id])

  async function handleAiFill() {
    setFilling(true); setError('')
    const res = await fetch('/api/ai/vocab-fill', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word: wordName, word_level: wordLevel }),
    })
    const data = await res.json()
    setFilling(false)
    if (!res.ok) return setError('AI 자동완성 실패: ' + (data.error ?? ''))
    if (data.part_of_speech)     setPos(data.part_of_speech)
    if (data.definition_ko)      setDefKo(data.definition_ko)
    if (data.definition_en)      setDefEn(data.definition_en)
    if (data.synonyms?.length)   setSynonyms(data.synonyms)
    if (data.antonyms?.length)   setAntonyms(data.antonyms)
    if (data.idioms?.length)     setIdioms(data.idioms)
    if (data.topic_category)     setTopic(data.topic_category)
    if (data.example_sentence)   setExample(data.example_sentence)
    if (data.example_sentence_ko) setExampleKo(data.example_sentence_ko)
    if (data.morphemes) setMorphemes(data.morphemes)
    if (data.collocations) setCollocations(data.collocations)
  }

  async function handleTts() {
    setGenerating(true); setError('')
    try {
      const res = await fetch('/api/ai/tts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: wordName, gender: 'yw', questionId: `vocab_${wordName}_${Date.now()}` }),
      })
      const text = await res.text()
      const data = text ? JSON.parse(text) : {}
      setGenerating(false)
      if (!res.ok) return setError('TTS 생성 실패: ' + (data.error ?? res.status))
      setAudioUrl(data.audioUrl)
    } catch (e) {
      setGenerating(false)
      setError('TTS 생성 중 오류가 발생했습니다')
    }
  }

  async function handleSave() {
    if (!defKo.trim()) return setError('한국어 뜻을 입력하세요')
    setSaving(true); setError('')
    const result = await updateVocabWord(id, {
      part_of_speech: pos, definition_ko: defKo.trim(), definition_en: defEn.trim(),
      synonyms, antonyms, idioms, topic_category: topic,
      difficulty: wordLevel === 'toefl' ? difficulty : WORD_LEVEL_CONFIG[wordLevel].difficulty,
      audio_url: audioUrl,
      example_sentence: example.trim() || null,
      example_sentence_ko: exampleKo.trim() || null,
      morphemes: morphemes ?? undefined,
      collocations: collocations.length > 0 ? collocations : undefined,
      word_level: wordLevel,
    })
    setSaving(false)
    if (result.error) return setError(result.error)
    setSaved(true)
    setTimeout(() => router.push('/teacher/vocab'), 800)
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 size={32} className="animate-spin text-blue-400" />
    </div>
  )

  return (
    <div className="p-3 md:p-7 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => router.back()} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition">
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className="text-base font-extrabold text-gray-900 leading-tight">단어 수정</h1>
          <p className="text-xs font-bold text-blue-600">{wordName}</p>
        </div>
        <button onClick={handleAiFill} disabled={filling}
          className="ml-auto flex items-center gap-1.5 px-3 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 text-xs font-bold rounded-xl transition disabled:opacity-50">
          {filling ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
          {filling ? '분석 중...' : 'AI 재생성'}
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-3">{error}</div>}

      <div className="space-y-3">
        {/* Word Level Toggle */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-full p-0.5">
          {(Object.entries(WORD_LEVEL_CONFIG) as [WordLevel, typeof WORD_LEVEL_CONFIG[WordLevel]][]).map(([key, cfg]) => (
            <button key={key} type="button" onClick={() => setWordLevel(key)}
              className={`px-3 py-1.5 text-xs font-bold rounded-full transition ${wordLevel === key ? `${cfg.color} ${cfg.textColor} shadow-sm` : 'text-gray-500 hover:text-gray-700'}`}>
              {cfg.label}
            </button>
          ))}
        </div>

        {/* 핵심 필드 카드 (인라인 패턴) */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 md:p-5 divide-y divide-gray-50">
          {/* 품사 */}
          <div className="flex items-center gap-2 py-1.5">
            <span className="w-20 flex-shrink-0 text-xs font-bold text-gray-500">품사</span>
            <select value={pos} onChange={e => setPos(e.target.value)}
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400">
              {PARTS_OF_SPEECH.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {/* 한국어 뜻 */}
          <div className="flex items-center gap-2 py-1.5">
            <span className="w-20 flex-shrink-0 text-xs font-bold text-gray-500">한국어 뜻 *</span>
            <input value={defKo} onChange={e => setDefKo(e.target.value)}
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>

          {/* 영어 뜻 */}
          <div className="flex items-center gap-2 py-1.5">
            <span className="w-20 flex-shrink-0 text-xs font-bold text-gray-500">영어 뜻</span>
            <input value={defEn} onChange={e => setDefEn(e.target.value)}
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>

          {/* 난이도 (toefl만) */}
          {wordLevel === 'toefl' && (
            <div className="flex items-center gap-2 py-1.5">
              <span className="w-20 flex-shrink-0 text-xs font-bold text-gray-500">레벨</span>
              <select value={difficulty} onChange={e => setDifficulty(Number(e.target.value))}
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400">
                {DIFFICULTY_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
          )}

          {/* 주제 */}
          <div className="flex items-center gap-2 py-1.5">
            <span className="w-20 flex-shrink-0 text-xs font-bold text-gray-500">주제</span>
            <select value={topic} onChange={e => setTopic(e.target.value)}
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400">
              {allTopics.map(t => <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>)}
            </select>
          </div>

          {/* 부가 정보 토글 */}
          <div>
            <button type="button" onClick={() => setShowExtra(v => !v)}
              className="flex items-center gap-1.5 text-xs font-bold text-indigo-500 py-2 w-full">
              <ChevronDown size={14} className={showExtra ? 'rotate-180 transition-transform' : 'transition-transform'} />
              {showExtra ? '부가 정보 접기' : '부가 정보 펼치기 (동의어, 반의어, 숙어, 연결어, 어근)'}
            </button>
            {showExtra && (
              <div className="space-y-3 pt-1">
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1 block">동의어 <span className="font-normal text-gray-400">(Enter로 추가)</span></label>
                  <ChipInput chips={synonyms} onAdd={v => setSynonyms(p => [...p, v])}
                    onRemove={v => setSynonyms(p => p.filter(s => s !== v))}
                    placeholder="essential, crucial..." color="purple" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1 block">반의어 <span className="font-normal text-gray-400">(Enter로 추가)</span></label>
                  <ChipInput chips={antonyms} onAdd={v => setAntonyms(p => [...p, v])}
                    onRemove={v => setAntonyms(p => p.filter(s => s !== v))}
                    placeholder="dispensable, optional..." color="rose" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1 block">숙어 <span className="font-normal text-gray-400">(Enter로 추가)</span></label>
                  <ChipInput chips={idioms} onAdd={v => setIdioms(p => [...p, v])}
                    onRemove={v => setIdioms(p => p.filter(s => s !== v))}
                    placeholder="take off, run out of..." color="purple" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1 block">연결어 <span className="font-normal text-gray-400">(Enter로 추가)</span></label>
                  <ChipInput chips={collocations} onAdd={v => setCollocations(p => [...p, v])}
                    onRemove={v => setCollocations(p => p.filter(c => c !== v))}
                    placeholder="make a decision, take action..." color="purple" />
                </div>
                {morphemes && (
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1 block">어근 분석 <span className="font-normal text-gray-400">(AI 생성)</span></label>
                    <div className="flex flex-wrap gap-1.5 px-2 py-1.5 bg-amber-50 rounded-xl border border-amber-100">
                      {morphemes.prefix && (
                        <span className="text-xs text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full font-semibold">
                          {morphemes.prefix}{morphemes.prefix_meaning ? ` (${morphemes.prefix_meaning})` : ''}
                        </span>
                      )}
                      {morphemes.root && (
                        <span className="text-xs text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full font-semibold">
                          {morphemes.root}{morphemes.root_meaning ? ` (${morphemes.root_meaning})` : ''}
                        </span>
                      )}
                      {morphemes.suffix && (
                        <span className="text-xs text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full font-semibold">
                          {morphemes.suffix}{morphemes.suffix_meaning ? ` (${morphemes.suffix_meaning})` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* TTS 인라인 통합 */}
          <div className="flex items-center gap-2 py-1.5">
            <span className="w-20 flex-shrink-0 text-xs font-bold text-gray-500">발음 TTS</span>
            <div className="flex-1 flex items-center gap-2">
              {audioUrl && <audio src={audioUrl} controls className="flex-1 h-8 min-w-0" />}
              {!audioUrl && <span className="flex-1 text-xs text-gray-300">TTS 없음</span>}
              <div className="flex items-center gap-1">
                {audioUrl && (
                  <button type="button" onClick={() => setAudioUrl(null)} title="음성 삭제"
                    className="flex items-center gap-1 px-2 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-lg transition">
                    <Trash2 size={11} />
                  </button>
                )}
                <button type="button" onClick={handleTts} disabled={generating}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-lg whitespace-nowrap disabled:opacity-50">
                  {generating ? <Loader2 size={12} className="animate-spin" /> : <Volume2 size={12} />}
                  {audioUrl ? '재생성' : '생성'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 예문 카드 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 md:p-5 space-y-3">
          <div>
            <label className="text-xs font-bold text-gray-500 mb-0.5 block">실전 예문 (청킹 마크업)</label>
            <p className="text-[11px] text-gray-400 mb-1.5">
              <code className="bg-gray-100 px-1 rounded">*단어*</code> = 하이라이트 &nbsp;
              <code className="bg-gray-100 px-1 rounded"> / </code> = 끊어읽기 사선
            </p>
            <textarea value={example} onChange={e => setExample(e.target.value)} rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          {example && <div><p className="text-[11px] text-gray-400 mb-1">미리보기</p><ExamplePreview raw={example} /></div>}
          <div>
            <label className="text-xs font-bold text-gray-500 mb-0.5 block">한글 직독직해</label>
            <p className="text-[11px] text-gray-400 mb-1.5">영어 예문과 동일한 위치에 <code className="bg-gray-100 px-1 rounded"> / </code> 넣어 청크 일치</p>
            <textarea value={exampleKo} onChange={e => setExampleKo(e.target.value)} rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
        </div>

        <button onClick={handleSave} disabled={saving || saved}
          className={`w-full flex items-center justify-center gap-2 py-3.5 text-base font-bold rounded-2xl transition ${
            saved ? 'bg-emerald-500 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
          } disabled:opacity-50`}>
          {saved ? <><Check size={18} /> 저장 완료!</> :
           saving ? <><Loader2 size={18} className="animate-spin" /> 저장 중...</> :
           <><Save size={18} /> 수정 저장</>}
        </button>
      </div>
    </div>
  )
}
