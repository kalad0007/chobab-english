'use client'

import { useRef, useState, useEffect } from 'react'
import { Play, Square, Volume2 } from 'lucide-react'

interface AudioPlayerProps {
  audioUrl?: string | null     // 실제 오디오 파일 URL (옵션)
  script?: string | null       // Web Speech API용 스크립트 (옵션)
  playLimit?: number           // 최대 재생 횟수 (기본 3회)
  initialPlayCount?: number    // 이전에 재생한 횟수 (문제 복귀 시 복원)
  onPlayed?: (count: number) => void
  onEnded?: () => void         // 재생 완료 시 콜백 (타이머 시작용)
}

const AUDIO_CACHE = 'chobabsaem-audio-v1'

// 캐시에서 오디오 가져오기 (없으면 백그라운드 캐싱 후 원본 URL 반환)
async function resolveAudioSrc(url: string): Promise<string> {
  try {
    const cache = await caches.open(AUDIO_CACHE)
    const cached = await cache.match(url)
    if (cached) {
      const blob = await cached.blob()
      return URL.createObjectURL(blob)
    }
    // 백그라운드에서 캐시 저장 (현재 재생은 원본 URL로)
    fetch(url).then(res => {
      if (res.ok) cache.put(url, res)
    }).catch(() => {})
  } catch {
    // Cache API 미지원 환경 (HTTP 등)
  }
  return url
}

export default function AudioPlayer({ audioUrl, script, playLimit = 1, initialPlayCount = 0, onPlayed, onEnded }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [playCount, setPlayCount] = useState(initialPlayCount)
  const [progress, setProgress] = useState(0)
  const [supported, setSupported] = useState(true)
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null)

  useEffect(() => {
    if (!audioUrl && typeof window !== 'undefined' && !window.speechSynthesis) {
      setSupported(false)
    }
  }, [audioUrl])

  // 캐시 확인 후 src 설정
  useEffect(() => {
    if (!audioUrl) return
    const prev = objectUrlRef.current
    resolveAudioSrc(audioUrl).then(src => {
      if (src !== audioUrl) objectUrlRef.current = src
      setResolvedSrc(src)
    })
    return () => {
      if (prev) URL.revokeObjectURL(prev)
      objectUrlRef.current = null
    }
  }, [audioUrl])

  // 실제 오디오 파일 이벤트 핸들러
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !audioUrl) return

    const onTimeUpdate = () => {
      if (audio.duration) setProgress((audio.currentTime / audio.duration) * 100)
    }
    const onAudioEnded = () => { setPlaying(false); setProgress(0); onEnded?.() }

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('ended', onAudioEnded)
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('ended', onAudioEnded)
    }
  }, [audioUrl])

  function playScript() {
    if (!script || !window.speechSynthesis) return

    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(script)
    utterance.lang = 'en-US'
    utterance.rate = 0.85
    utterance.onend = () => { setPlaying(false); setProgress(0); onEnded?.() }
    utterance.onerror = () => { setPlaying(false); setProgress(0) }
    utterance.onboundary = (e) => {
      if (utterance.text.length > 0) {
        setProgress(Math.round((e.charIndex / utterance.text.length) * 100))
      }
    }

    utteranceRef.current = utterance

    const speak = () => {
      const voices = window.speechSynthesis.getVoices()
      const englishVoice = voices.find(v => v.lang === 'en-US')
        ?? voices.find(v => v.lang.startsWith('en'))
      if (englishVoice) utterance.voice = englishVoice
      setPlaying(true)
      window.speechSynthesis.speak(utterance)
    }

    if (window.speechSynthesis.getVoices().length > 0) {
      speak()
    } else {
      window.speechSynthesis.addEventListener('voiceschanged', speak, { once: true })
      setTimeout(() => {
        if (!window.speechSynthesis.speaking) speak()
      }, 500)
    }
  }

  function playAudioFile() {
    const audio = audioRef.current
    if (!audio) return

    if (playing) {
      audio.pause()
      setPlaying(false)
      return
    }

    audio.currentTime = 0
    audio.play()
    setPlaying(true)
  }

  function handlePlay() {
    if (playing) {
      if (audioUrl) playAudioFile()
      else { window.speechSynthesis.cancel(); setPlaying(false); setProgress(0) }
      return
    }

    if (playCount >= playLimit) return

    const newCount = playCount + 1
    setPlayCount(newCount)
    onPlayed?.(newCount)

    if (audioUrl) playAudioFile()
    else playScript()
  }

  const remaining = playLimit - playCount
  const canPlay = remaining > 0 || playing

  if (!supported) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">
        ⚠️ 이 브라우저는 음성 재생을 지원하지 않습니다. Chrome 또는 Edge를 사용해주세요.
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4">
      {audioUrl && <audio ref={audioRef} src={resolvedSrc ?? audioUrl} preload="auto" />}

      <div className="flex items-center gap-4">
        <button
          onClick={handlePlay}
          disabled={!canPlay}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition flex-shrink-0 shadow-md ${
            playing
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : canPlay
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {playing
            ? <Square size={18} />
            : <Play size={20} className="ml-0.5" />
          }
        </button>

        <div className="flex-1">
          {/* 진행 바 */}
          <div className="bg-blue-200 rounded-full h-2 mb-2 overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all ${playing ? 'bg-blue-600' : 'bg-blue-400'}`}
              style={{ width: `${playing ? Math.max(progress, 5) : progress}%` }}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Volume2 size={13} className="text-blue-500" />
              <span className="text-xs font-semibold text-blue-700">
                {playing ? '재생 중...' : '리스닝'}
              </span>
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
              <span className={`ml-1 text-xs font-bold ${remaining === 0 && !playing ? 'text-red-500' : 'text-blue-600'}`}>
                {playing ? '■ 중지' : remaining > 0 ? `${remaining}회 남음` : '재생 완료'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
