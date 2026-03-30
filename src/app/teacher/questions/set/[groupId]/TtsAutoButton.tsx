'use client'

import { useState } from 'react'
import { Loader2, Volume2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  questionId: string
  audioScript: string
  initialAudioUrl: string | null
  subtype?: string
}

export default function TtsAutoButton({ questionId, audioScript, initialAudioUrl, subtype }: Props) {
  const supabase = createClient()
  const [audioUrl, setAudioUrl] = useState(initialAudioUrl)
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
        body: JSON.stringify({ script: audioScript, questionId, gender: 'yw', subtype }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.audioUrl) {
          await supabase.from('questions').update({ audio_url: data.audioUrl }).eq('id', questionId)
          setAudioUrl(data.audioUrl)
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

  if (audioUrl) {
    return (
      <div className="flex items-center gap-2">
        <span className="flex-shrink-0 text-xs px-2.5 py-1 rounded-full font-semibold bg-green-100 text-green-700 flex items-center gap-1">
          <Volume2 size={10} /> 음성 있음
        </span>
        <audio controls src={audioUrl} className="flex-1 min-w-0 rounded-xl" style={{ height: '32px' }} />
      </div>
    )
  }

  return (
    <button
      onClick={generate}
      disabled={loading}
      className={`text-xs px-2.5 py-1 rounded-full font-semibold transition flex items-center gap-1 ${
        error
          ? 'bg-red-100 text-red-600 hover:bg-red-200'
          : 'bg-red-50 text-red-500 hover:bg-orange-50 hover:text-orange-600'
      } disabled:opacity-60`}
      title="클릭하여 YW 음성 자동 생성"
    >
      {loading ? (
        <><Loader2 size={10} className="animate-spin" /> 생성 중...</>
      ) : error ? (
        <>⚠ 재시도</>
      ) : (
        <>음성 없음 (클릭 생성)</>
      )}
    </button>
  )
}
