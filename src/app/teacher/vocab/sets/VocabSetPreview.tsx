'use client'

import { useEffect, useState } from 'react'
import { X, Volume2, BookOpen } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { WORD_LEVEL_CONFIG } from '../constants'
import type { WordLevel } from '../constants'

interface VocabWord {
  id: string
  word: string
  part_of_speech: string
  definition_ko: string
  synonyms: string[]
  audio_url: string | null
}

interface PreviewSet {
  id: string
  title: string
  topic_category: string
  topicEmoji: string
  word_count: number
  word_level?: WordLevel | null
}

interface Props {
  set: PreviewSet | null
  onClose: () => void
}

function stripLeadingEmoji(str: string) {
  return str.replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\s]+/u, '').trim()
}

const POS_LABEL: Record<string, string> = {
  noun: '명사', verb: '동사', adjective: '형용사', adverb: '부사',
  preposition: '전치사', conjunction: '접속사', pronoun: '대명사',
  interjection: '감탄사', article: '관사', n: '명사', v: '동사',
  adj: '형용사', adv: '부사',
}

export default function VocabSetPreview({ set, onClose }: Props) {
  const [words, setWords] = useState<VocabWord[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!set) return
    setWords([])
    setLoading(true)

    const supabase = createClient()
    supabase
      .from('vocab_set_words')
      .select('order_num, vocab_words(id, word, part_of_speech, definition_ko, synonyms, audio_url)')
      .eq('set_id', set.id)
      .order('order_num')
      .then(({ data }) => {
        const list = (data ?? [])
          .map((row: any) => row.vocab_words)
          .filter(Boolean) as VocabWord[]
        setWords(list)
        setLoading(false)
      })
  }, [set?.id])

  // ESC 키로 닫기
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!set) return null

  const levelKey = set.word_level as WordLevel | undefined
  const levelCfg = levelKey ? WORD_LEVEL_CONFIG[levelKey] : null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white z-50 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-lg">{set.topicEmoji}</span>
              <h2 className="font-extrabold text-gray-900 text-base leading-tight truncate">
                {stripLeadingEmoji(set.title)}
              </h2>
              {levelCfg && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${levelCfg.color} ${levelCfg.textColor}`}>
                  {levelCfg.label}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <BookOpen size={11} /> {set.word_count}단어
              </span>
              <span className="capitalize">{set.topic_category.replace(/_/g, ' ')}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition"
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </div>

        {/* Word list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5">
          {loading && (
            <div className="flex items-center justify-center py-16 text-gray-300 text-sm">
              불러오는 중...
            </div>
          )}

          {!loading && words.length === 0 && (
            <div className="flex items-center justify-center py-16 text-gray-300 text-sm">
              단어가 없습니다
            </div>
          )}

          {!loading && words.map((w, i) => (
            <div
              key={w.id}
              className="bg-gray-50 rounded-xl px-3.5 py-2.5 flex items-start gap-3 border border-gray-100"
            >
              <span className="text-[11px] font-bold text-gray-300 mt-0.5 w-5 text-right flex-shrink-0">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-gray-900 text-sm">{w.word}</span>
                  {w.part_of_speech && (
                    <span className="text-[10px] font-semibold bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">
                      {POS_LABEL[w.part_of_speech.toLowerCase()] ?? w.part_of_speech}
                    </span>
                  )}
                  {w.audio_url && (
                    <button
                      type="button"
                      className="text-gray-400 hover:text-blue-500 transition"
                      title="발음 듣기"
                      onClick={e => { e.stopPropagation(); new Audio(w.audio_url!).play() }}
                    >
                      <Volume2 size={13} />
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-600 mt-0.5">{w.definition_ko}</p>
                {w.synonyms && w.synonyms.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {w.synonyms.map(syn => (
                      <span key={syn} className="text-[10px] bg-purple-50 text-purple-600 font-semibold px-1.5 py-0.5 rounded-full">
                        {syn}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
