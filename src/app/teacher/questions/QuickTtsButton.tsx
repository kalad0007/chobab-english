'use client'

import { useState } from 'react'
import { Loader2, Volume2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const VOICES = [
  { key: 'yw', label: 'YW' },
  { key: 'ym', label: 'YM' },
  { key: 'ow', label: 'OW' },
  { key: 'om', label: 'OM' },
] as const

type VoiceKey = typeof VOICES[number]['key']

interface Props {
  questionId: string
  audioScript: string
  onDone: (audioUrl: string) => void
  /** 세트인 경우 동일 audio_url을 모든 문제에 업데이트 */
  allQuestionIds?: string[]
  /** A/B 자동 배정 대화형 — 목소리 선택 숨김 */
  hideVoiceSelector?: boolean
  /** TTS API에 전달할 subtype (conversation이면 A/B 자동 분리) */
  subtype?: string
}

export default function QuickTtsButton({ questionId, audioScript, onDone, allQuestionIds, hideVoiceSelector, subtype }: Props) {
  const supabase = createClient()
  const [voice, setVoice] = useState<VoiceKey>('yw')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  async function generate() {
    if (loading || !audioScript) return
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/ai/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: audioScript, questionId, gender: voice, subtype }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.audioUrl) {
          const ids = allQuestionIds && allQuestionIds.length > 0 ? allQuestionIds : [questionId]
          await Promise.all(ids.map(id =>
            supabase.from('questions').update({ audio_url: data.audioUrl }).eq('id', id)
          ))
          onDone(data.audioUrl)
        } else {
          setError(true)
        }
      } else {
        setError(true)
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
      {/* 목소리 선택 (A/B 자동 대화형은 숨김) */}
      {!hideVoiceSelector && (
        <div className="flex gap-0.5">
          {VOICES.map(v => (
            <button
              key={v.key}
              onClick={() => setVoice(v.key)}
              disabled={loading}
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition ${
                voice === v.key
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              } disabled:opacity-50`}
            >
              {v.label}
            </button>
          ))}
        </div>
      )}
      {/* 생성 버튼 */}
      <button
        onClick={generate}
        disabled={loading || !audioScript}
        className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded transition disabled:opacity-50 ${
          error
            ? 'bg-red-100 text-red-600 hover:bg-red-200'
            : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
        }`}
      >
        {loading ? (
          <><Loader2 size={9} className="animate-spin" /> 생성 중...</>
        ) : error ? (
          <>⚠ 재시도</>
        ) : (
          <><Volume2 size={9} /> 음성 생성</>
        )}
      </button>
    </div>
  )
}
