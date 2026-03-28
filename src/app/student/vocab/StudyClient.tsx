'use client'

import { useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { Volume2, RotateCcw, ChevronRight } from 'lucide-react'
import { rateVocabWord } from './actions'

interface Card {
  id: string
  word: string
  part_of_speech: string
  definition_ko: string
  definition_en: string
  synonyms: string[]
  antonyms: string[]
  topic_category: string
  difficulty: number
  audio_url: string | null
  example_sentence: string | null
  example_sentence_ko: string | null
}

const POS_KO: Record<string, string> = {
  noun: '명사', verb: '동사', adjective: '형용사', adverb: '부사',
  preposition: '전치사', conjunction: '접속사', phrase: '구',
}

const TOPIC_EMOJI: Record<string, string> = {
  biology: '🧬', chemistry: '⚗️', physics: '⚛️', astronomy: '🔭',
  geology: '🪨', ecology: '🌿', history_us: '🗽', history_world: '🌍',
  anthropology: '🏺', psychology: '🧠', sociology: '👥', economics: '📊',
  art_music: '🎨', literature: '📚', architecture: '🏛️', environmental: '🌊',
  linguistics: '🗣️', philosophy: '🧭', political_science: '🏛️',
  medicine: '🏥', technology: '⚙️', general: '📝',
}

const TOPIC_LABEL: Record<string, string> = {
  biology: '생물학', chemistry: '화학', physics: '물리학', astronomy: '천문학',
  geology: '지질학', ecology: '생태학', history_us: '미국사', history_world: '세계사',
  anthropology: '인류학', psychology: '심리학', sociology: '사회학', economics: '경제학',
  art_music: '예술/음악', literature: '문학', architecture: '건축학', environmental: '환경과학',
  linguistics: '언어학', philosophy: '철학', political_science: '정치학',
  medicine: '의학', technology: '기술/공학', general: '일반',
}

/** Parse "*word*" → highlight span, " / " → faint slash */
function ExampleText({ raw }: { raw: string }) {
  const parts = raw.split(/(\*[^*]+\*| \/ )/)
  return (
    <p className="text-base leading-relaxed text-gray-700">
      {parts.filter(Boolean).map((p, i) => {
        if (p.startsWith('*') && p.endsWith('*'))
          return <strong key={i} className="text-blue-600 font-bold underline decoration-dotted decoration-blue-300">{p.slice(1, -1)}</strong>
        if (p === ' / ')
          return <span key={i} className="text-gray-300 mx-0.5 font-light select-none">/</span>
        return <span key={i}>{p}</span>
      })}
    </p>
  )
}

interface Props {
  cards: Card[]
  reviewCount: number
  newCount: number
  totalLearned: number
  totalWords: number
  setTitle?: string
  backHref?: string
}

export default function StudyClient({ cards, reviewCount, newCount, totalLearned, totalWords, setTitle, backHref = '/student/vocab' }: Props) {
  const [deck, setDeck] = useState(cards)
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [done, setDone] = useState(false)
  const [stats, setStats] = useState({ again: 0, hard: 0, easy: 0, total: 0 })
  const [rating, setRating] = useState(false)
  const [swipe, setSwipe] = useState<'left' | 'right' | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const current = deck[index]

  function playAudio() {
    if (!current?.audio_url) return
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    const a = new Audio(current.audio_url)
    audioRef.current = a
    a.play().catch(() => {})
  }

  const handleRate = useCallback(async (r: 1 | 2 | 3) => {
    if (rating || !current) return
    setRating(true)

    // Animate swipe
    if (r === 1) setSwipe('left')
    else if (r === 3) setSwipe('right')
    else setSwipe(null)

    await rateVocabWord(current.id, r)

    // If "again" (r=1), push to end of deck
    const newDeck = [...deck]
    if (r === 1) newDeck.push(newDeck[index])

    setStats(s => ({
      again: s.again + (r === 1 ? 1 : 0),
      hard:  s.hard  + (r === 2 ? 1 : 0),
      easy:  s.easy  + (r === 3 ? 1 : 0),
      total: s.total + 1,
    }))

    setTimeout(() => {
      setSwipe(null)
      setFlipped(false)
      const nextIndex = index + 1
      if (nextIndex >= newDeck.length || (r !== 1 && nextIndex >= deck.length)) {
        setDone(true)
      } else {
        setDeck(newDeck)
        setIndex(nextIndex)
      }
      setRating(false)
    }, 320)
  }, [rating, current, deck, index])

  const progress = Math.round(((stats.total - stats.again) / cards.length) * 100)

  if (done) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="text-6xl mb-4">🎊</div>
        <h2 className="text-2xl font-extrabold text-gray-900 mb-1">세션 완료!</h2>
        {setTitle && <p className="text-sm text-gray-400 mb-1">{setTitle}</p>}
        <p className="text-gray-500 mb-6">오늘의 단어 학습을 마쳤어요</p>

        <div className="grid grid-cols-3 gap-4 mb-8 w-full max-w-xs">
          <div className="bg-red-50 rounded-2xl p-4">
            <p className="text-2xl font-extrabold text-red-500">{stats.again}</p>
            <p className="text-xs text-red-400 mt-0.5">몰라요</p>
          </div>
          <div className="bg-yellow-50 rounded-2xl p-4">
            <p className="text-2xl font-extrabold text-yellow-500">{stats.hard}</p>
            <p className="text-xs text-yellow-500 mt-0.5">헷갈려요</p>
          </div>
          <div className="bg-emerald-50 rounded-2xl p-4">
            <p className="text-2xl font-extrabold text-emerald-500">{stats.easy}</p>
            <p className="text-xs text-emerald-500 mt-0.5">완벽해요</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={() => {
              setDeck(cards)
              setIndex(0)
              setFlipped(false)
              setDone(false)
              setStats({ again: 0, hard: 0, easy: 0, total: 0 })
            }}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition">
            <RotateCcw size={16} /> 다시 학습하기
          </button>
          <Link href={backHref}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-2xl transition">
            {backHref === '/student/vocab' ? '단어 목록으로' : '대시보드로'} <ChevronRight size={16} />
          </Link>
        </div>
      </div>
    )
  }

  if (!current) return null

  return (
    <div className="min-h-screen flex flex-col max-w-lg mx-auto px-4 py-4">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            {reviewCount > 0 && <span className="bg-orange-100 text-orange-600 font-bold px-2 py-0.5 rounded-full">복습 {reviewCount}</span>}
            {newCount > 0   && <span className="bg-blue-100 text-blue-600 font-bold px-2 py-0.5 rounded-full">신규 {newCount}</span>}
          </div>
          <span className="text-xs text-gray-400">{Math.min(index + 1, deck.length)} / {deck.length}</span>
        </div>
        {/* Progress bar */}
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Topic tag */}
      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-sm">{TOPIC_EMOJI[current.topic_category] ?? '📝'}</span>
        <span className="text-xs font-bold text-gray-500">{TOPIC_LABEL[current.topic_category] ?? current.topic_category}</span>
        <span className="text-[10px] text-gray-300 ml-1">Band {current.difficulty.toFixed(1)}</span>
      </div>

      {/* Flip card */}
      <div
        className="flex-1 relative cursor-pointer select-none"
        style={{ perspective: '1000px', minHeight: '380px' }}
        onClick={() => !flipped && setFlipped(true)}
      >
        <div
          className="absolute inset-0 transition-all duration-500"
          style={{
            transformStyle: 'preserve-3d',
            transform: `rotateY(${flipped ? 180 : 0}deg) ${
              swipe === 'left'  ? 'translateX(-80px) rotate(-5deg)' :
              swipe === 'right' ? 'translateX(80px) rotate(5deg)'  : ''
            }`,
            opacity: swipe ? 0 : 1,
          }}
        >
          {/* FRONT */}
          <div className="absolute inset-0 bg-white rounded-3xl shadow-xl border border-gray-100 flex flex-col items-center justify-center p-8"
            style={{ backfaceVisibility: 'hidden' }}>
            <p className="text-5xl font-extrabold text-gray-900 text-center tracking-tight mb-4">
              {current.word}
            </p>
            <p className="text-sm text-gray-400 mb-6">
              <span className="italic">{current.part_of_speech}</span>
              {POS_KO[current.part_of_speech] && (
                <span className="ml-1.5 text-gray-300">· {POS_KO[current.part_of_speech]}</span>
              )}
            </p>
            {current.audio_url && (
              <button
                onClick={e => { e.stopPropagation(); playAudio() }}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-full font-semibold text-sm transition"
              >
                <Volume2 size={16} /> 발음 듣기
              </button>
            )}
            <p className="absolute bottom-5 text-xs text-gray-300">탭하여 뜻 보기</p>
          </div>

          {/* BACK */}
          <div
            className="absolute inset-0 bg-white rounded-3xl shadow-xl border border-gray-100 flex flex-col p-6 overflow-y-auto"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            {/* Topic tag + Word + audio */}
            <div className="flex items-center gap-1.5 mb-3">
              <span className="text-sm">{TOPIC_EMOJI[current.topic_category] ?? '📝'}</span>
              <span className="text-[11px] font-bold text-gray-400">{TOPIC_LABEL[current.topic_category] ?? current.topic_category}</span>
            </div>

            <div className="flex items-center gap-3 mb-4">
              <div>
                <p className="text-2xl font-extrabold text-gray-900">{current.word}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  <span className="italic">{current.part_of_speech}</span>
                  {POS_KO[current.part_of_speech] && (
                    <span className="ml-1 text-gray-300">· {POS_KO[current.part_of_speech]}</span>
                  )}
                </p>
              </div>
              {current.audio_url && (
                <button
                  onClick={e => { e.stopPropagation(); playAudio() }}
                  className="ml-auto p-2 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-full transition"
                >
                  <Volume2 size={15} />
                </button>
              )}
            </div>

            {/* Definition */}
            <div className="mb-4">
              <p className="text-xl font-bold text-gray-800">{current.definition_ko}</p>
              {current.definition_en && (
                <p className="text-sm text-gray-400 mt-0.5 italic">{current.definition_en}</p>
              )}
            </div>

            {/* Synonyms */}
            {current.synonyms.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 mb-3">
                <p className="text-[10px] font-extrabold text-amber-600 uppercase tracking-widest mb-2">
                  🔥 Synonyms · TOEFL 패러프레이징
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {current.synonyms.map(s => (
                    <span key={s} className="text-xs font-bold bg-white border border-amber-200 text-amber-700 px-2.5 py-1 rounded-full shadow-sm">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Antonyms — separate box, no strikethrough */}
            {current.antonyms.length > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 mb-3">
                <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-2">
                  ↔ Antonyms · 반의어
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {current.antonyms.map(s => (
                    <span key={s} className="text-xs font-semibold bg-white border border-slate-300 text-slate-600 px-2.5 py-1 rounded-full">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Example sentence with chunking + Korean translation */}
            {current.example_sentence && (
              <div className="bg-blue-50 rounded-2xl p-4 mb-2">
                <p className="text-[10px] font-extrabold text-blue-500 uppercase tracking-widest mb-2">실전 예문</p>
                <ExampleText raw={current.example_sentence} />
                {current.example_sentence_ko && (
                  <p className="text-xs text-blue-500 mt-2 leading-relaxed border-t-2 border-blue-300 pt-2">
                    {current.example_sentence_ko}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rating buttons – only shown after flip */}
      <div className="mt-4 pb-4">
        {!flipped ? (
          <button onClick={() => setFlipped(true)}
            className="w-full py-3.5 bg-gray-900 hover:bg-gray-700 text-white font-bold rounded-2xl text-sm transition">
            뒤집기 →
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-center text-xs text-gray-400 mb-2">얼마나 잘 알고 있나요?</p>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => handleRate(1)} disabled={rating}
                className="flex flex-col items-center gap-1 py-3.5 bg-red-50 hover:bg-red-100 border-2 border-red-200 hover:border-red-400 text-red-600 rounded-2xl transition disabled:opacity-50 active:scale-95">
                <span className="text-xl">😓</span>
                <span className="text-xs font-extrabold">몰라요</span>
                <span className="text-[10px] text-red-400">다시 학습</span>
              </button>
              <button onClick={() => handleRate(2)} disabled={rating}
                className="flex flex-col items-center gap-1 py-3.5 bg-yellow-50 hover:bg-yellow-100 border-2 border-yellow-200 hover:border-yellow-400 text-yellow-600 rounded-2xl transition disabled:opacity-50 active:scale-95">
                <span className="text-xl">🤔</span>
                <span className="text-xs font-extrabold">헷갈려요</span>
                <span className="text-[10px] text-yellow-500">2일 후 복습</span>
              </button>
              <button onClick={() => handleRate(3)} disabled={rating}
                className="flex flex-col items-center gap-1 py-3.5 bg-emerald-50 hover:bg-emerald-100 border-2 border-emerald-200 hover:border-emerald-400 text-emerald-600 rounded-2xl transition disabled:opacity-50 active:scale-95">
                <span className="text-xl">😎</span>
                <span className="text-xs font-extrabold">완벽해요</span>
                <span className="text-[10px] text-emerald-500">1주 후 복습</span>
              </button>
            </div>
            <button onClick={() => setFlipped(false)}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-gray-400 hover:text-gray-600 transition">
              <RotateCcw size={12} /> 앞면으로
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
