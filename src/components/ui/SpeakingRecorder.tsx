'use client'

import { useRef, useState } from 'react'
import { Mic, MicOff, Square, Loader2, CheckCircle, AlertCircle } from 'lucide-react'

interface SpeakingEvalResult {
  totalScore: number
  pronunciation: number
  grammar: number
  content: number
  confidence: number
  feedback: string
  strengths: string
  improvements: string
}

interface SpeakingRecorderProps {
  prompt: string
  questionId: string
  onRecorded?: (audioUrl: string, evaluation: SpeakingEvalResult) => void
  submissionId?: string
}

export default function SpeakingRecorder({
  prompt,
  questionId,
  onRecorded,
}: SpeakingRecorderProps) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const [recording, setRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [evaluating, setEvaluating] = useState(false)
  const [evalResult, setEvalResult] = useState<SpeakingEvalResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function startRecording() {
    setError(null)
    setEvalResult(null)
    setAudioBlob(null)
    setAudioUrl(null)
    chunksRef.current = []

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        setAudioUrl(URL.createObjectURL(blob))
      }

      mediaRecorder.start(100)
      setRecording(true)
      setRecordingTime(0)

      timerRef.current = setInterval(() => {
        setRecordingTime(t => {
          if (t >= 59) {
            stopRecording()
            return 60
          }
          return t + 1
        })
      }, 1000)
    } catch {
      setError('마이크 접근 권한이 필요합니다. 브라우저 설정에서 마이크를 허용해주세요.')
    }
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current)
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }

  async function evaluate() {
    if (!audioBlob) return
    setEvaluating(true)
    setError(null)

    try {
      // blob → base64
      const arrayBuffer = await audioBlob.arrayBuffer()
      const uint8 = new Uint8Array(arrayBuffer)
      let binary = ''
      for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i])
      const base64 = btoa(binary)

      const res = await fetch('/api/ai/speaking-eval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: base64,
          mimeType: 'audio/webm',
          prompt,
        }),
      })

      if (!res.ok) throw new Error('평가 실패')
      const result: SpeakingEvalResult = await res.json()
      setEvalResult(result)
      onRecorded?.(audioUrl ?? '', result)
    } catch (e) {
      setError('평가 중 오류가 발생했습니다. 다시 시도해주세요.')
      console.error(e)
    } finally {
      setEvaluating(false)
    }
  }

  const scoreColor = (score: number, max: number) => {
    const pct = (score / max) * 100
    if (pct >= 80) return 'text-emerald-600'
    if (pct >= 60) return 'text-blue-600'
    if (pct >= 40) return 'text-amber-600'
    return 'text-red-500'
  }

  return (
    <div className="space-y-4">
      {/* 문제/프롬프트 */}
      <div className="bg-amber-50 border-l-4 border-amber-400 rounded-r-xl p-4">
        <p className="text-xs font-bold text-amber-700 mb-1">스피킹 과제</p>
        <p className="text-sm text-gray-800">{prompt}</p>
      </div>

      {/* 녹음 컨트롤 */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 text-center">
        {!audioBlob ? (
          <>
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 transition ${
              recording ? 'bg-red-100 animate-pulse' : 'bg-gray-100'
            }`}>
              {recording ? (
                <Mic size={32} className="text-red-500" />
              ) : (
                <MicOff size={32} className="text-gray-400" />
              )}
            </div>

            {recording && (
              <p className="text-2xl font-black text-red-500 tabular-nums mb-2">
                {String(Math.floor(recordingTime / 60)).padStart(2, '0')}:
                {String(recordingTime % 60).padStart(2, '0')}
                <span className="text-sm font-normal text-gray-400 ml-2">/ 01:00</span>
              </p>
            )}

            <p className="text-sm text-gray-500 mb-4">
              {recording ? '녹음 중... 말하기를 마치면 중지 버튼을 누르세요' : '녹음 버튼을 눌러 말하기를 시작하세요 (최대 60초)'}
            </p>

            {!recording ? (
              <button
                onClick={startRecording}
                className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold text-sm transition inline-flex items-center gap-2"
              >
                <Mic size={16} /> 녹음 시작
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="px-6 py-3 bg-gray-800 hover:bg-gray-900 text-white rounded-xl font-bold text-sm transition inline-flex items-center gap-2"
              >
                <Square size={16} /> 녹음 중지
              </button>
            )}
          </>
        ) : (
          <>
            {/* 녹음 완료 - 재생 및 평가 */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <CheckCircle size={20} className="text-emerald-500" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-gray-900">녹음 완료!</p>
                <p className="text-xs text-gray-500">{recordingTime}초</p>
              </div>
            </div>

            {audioUrl && (
              <audio controls src={audioUrl} className="w-full mb-4 rounded-lg" />
            )}

            <div className="flex gap-2">
              <button
                onClick={() => { setAudioBlob(null); setAudioUrl(null); setEvalResult(null) }}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
              >
                다시 녹음
              </button>
              <button
                onClick={evaluate}
                disabled={evaluating}
                className="flex-1 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl text-sm font-bold transition disabled:opacity-60 inline-flex items-center justify-center gap-2"
              >
                {evaluating ? (
                  <><Loader2 size={14} className="animate-spin" /> AI 평가 중...</>
                ) : (
                  '🤖 AI 평가 받기'
                )}
              </button>
            </div>
          </>
        )}
      </div>

      {/* 오류 */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
          <AlertCircle size={16} className="flex-shrink-0" />
          {error}
        </div>
      )}

      {/* 평가 결과 */}
      {evalResult && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-5 py-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold opacity-80">AI 스피킹 평가 결과</p>
                <p className="text-3xl font-black mt-1">{evalResult.totalScore}<span className="text-lg font-bold opacity-70">점</span></p>
              </div>
              <div className={`w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl font-black`}>
                {evalResult.totalScore >= 80 ? '🏆' : evalResult.totalScore >= 60 ? '👍' : evalResult.totalScore >= 40 ? '💪' : '📖'}
              </div>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* 세부 점수 */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: '발음/유창성', score: evalResult.pronunciation, max: 25 },
                { label: '문법/어휘', score: evalResult.grammar, max: 25 },
                { label: '내용/관련성', score: evalResult.content, max: 25 },
                { label: '자신감/표현', score: evalResult.confidence, max: 25 },
              ].map(({ label, score, max }) => (
                <div key={label} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-1">{label}</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full bg-blue-500"
                        style={{ width: `${(score / max) * 100}%` }}
                      />
                    </div>
                    <span className={`text-sm font-black ${scoreColor(score, max)}`}>{score}</span>
                    <span className="text-xs text-gray-400">/{max}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* 피드백 */}
            <div className="space-y-3">
              <div className="bg-blue-50 rounded-xl p-3">
                <p className="text-xs font-bold text-blue-700 mb-1">💬 종합 피드백</p>
                <p className="text-sm text-gray-700">{evalResult.feedback}</p>
              </div>
              <div className="bg-emerald-50 rounded-xl p-3">
                <p className="text-xs font-bold text-emerald-700 mb-1">✅ 잘한 점</p>
                <p className="text-sm text-gray-700">{evalResult.strengths}</p>
              </div>
              <div className="bg-amber-50 rounded-xl p-3">
                <p className="text-xs font-bold text-amber-700 mb-1">📈 개선할 점</p>
                <p className="text-sm text-gray-700">{evalResult.improvements}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
