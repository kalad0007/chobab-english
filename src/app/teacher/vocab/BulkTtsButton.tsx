'use client'

import { useState } from 'react'
import { Volume2, Loader2 } from 'lucide-react'
import { updateVocabWord } from './actions'
import { useRouter } from 'next/navigation'

interface Props {
  words: { id: string; word: string }[]
}

export default function BulkTtsButton({ words }: Props) {
  const router = useRouter()
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  async function handleGenerate() {
    if (!confirm(`음성이 없는 단어 ${words.length}개의 TTS를 생성하시겠습니까?\n시간이 다소 걸릴 수 있습니다.`)) return
    setRunning(true)
    setProgress({ done: 0, total: words.length })

    for (let i = 0; i < words.length; i++) {
      const w = words[i]
      try {
        const res = await fetch('/api/ai/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ script: w.word, gender: 'yw', questionId: `vocab_${w.word}_${Date.now()}` }),
        })
        const data = res.ok ? await res.json() : null
        if (data?.audioUrl) {
          await updateVocabWord(w.id, { audio_url: data.audioUrl })
        }
      } catch {
        // 개별 실패는 스킵
      }
      setProgress({ done: i + 1, total: words.length })
    }

    setRunning(false)
    setProgress(null)
    router.refresh()
  }

  if (words.length === 0) {
    return (
      <div className="text-center">
        <p className="text-[10px] text-gray-400 font-medium">생성</p>
        <p className="text-base font-extrabold text-gray-300">완료</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-0.5">
      <p className="text-[10px] text-gray-400 font-medium">생성</p>
      <button
        onClick={handleGenerate}
        disabled={running}
        className="flex items-center gap-1 px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-700 text-[10px] font-bold rounded-lg transition disabled:opacity-60 whitespace-nowrap"
      >
        {running
          ? <><Loader2 size={11} className="animate-spin" /> {progress?.done}/{progress?.total}</>
          : <><Volume2 size={11} /> {words.length}개</>
        }
      </button>
    </div>
  )
}
