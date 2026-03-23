'use client'

import { useRef, useState, useEffect } from 'react'
import { Play, Pause, Volume2 } from 'lucide-react'

interface AudioPlayerProps {
  audioUrl: string
  playLimit?: number          // 최대 재생 횟수 (기본 3회)
  onPlayed?: (count: number) => void
}

export default function AudioPlayer({ audioUrl, playLimit = 3, onPlayed }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [playCount, setPlayCount] = useState(0)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTimeUpdate = () => {
      setProgress(audio.currentTime)
    }
    const onLoaded = () => {
      setDuration(audio.duration)
    }
    const onEnded = () => {
      setPlaying(false)
      setProgress(0)
    }

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('loadedmetadata', onLoaded)
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('loadedmetadata', onLoaded)
      audio.removeEventListener('ended', onEnded)
    }
  }, [])

  function togglePlay() {
    const audio = audioRef.current
    if (!audio) return

    if (playing) {
      audio.pause()
      setPlaying(false)
    } else {
      if (playCount >= playLimit) return
      audio.currentTime = 0
      audio.play()
      setPlaying(true)
      const newCount = playCount + 1
      setPlayCount(newCount)
      onPlayed?.(newCount)
    }
  }

  const remaining = playLimit - playCount
  const canPlay = remaining > 0
  const pct = duration > 0 ? (progress / duration) * 100 : 0

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      <div className="flex items-center gap-4">
        <button
          onClick={togglePlay}
          disabled={!canPlay && !playing}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition flex-shrink-0 ${
            canPlay || playing
              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {playing ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
        </button>

        <div className="flex-1">
          {/* 진행 바 */}
          <div className="bg-blue-200 rounded-full h-2 mb-2 overflow-hidden">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          {/* 재생 횟수 표시 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Volume2 size={13} className="text-blue-500" />
              <span className="text-xs font-semibold text-blue-700">리스닝</span>
            </div>
            <div className="flex items-center gap-1">
              {Array.from({ length: playLimit }).map((_, i) => (
                <span
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full transition ${
                    i < playCount ? 'bg-blue-500' : 'bg-blue-200'
                  }`}
                />
              ))}
              <span className={`ml-1 text-xs font-bold ${remaining === 0 ? 'text-red-500' : 'text-blue-600'}`}>
                {remaining > 0 ? `${remaining}회 남음` : '재생 완료'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
