'use client'

import { useRef, useState } from 'react'
import { Mic, MicOff, Square, Loader2, CheckCircle, AlertCircle, RotateCcw } from 'lucide-react'

interface SpeakingRecorderProps {
  prompt: string
  questionId: string
  submissionId: string | null
  onRecorded?: (audioUrl: string) => void
}

export default function SpeakingRecorder({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  prompt: _prompt,
  questionId,
  submissionId,
  onRecorded,
}: SpeakingRecorderProps) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const [recording, setRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [localAudioUrl, setLocalAudioUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function startRecording() {
    setError(null)
    setAudioBlob(null)
    setLocalAudioUrl(null)
    setUploaded(false)
    chunksRef.current = []

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: mimeType })
        setAudioBlob(blob)
        setLocalAudioUrl(URL.createObjectURL(blob))
      }

      mediaRecorder.start(100)
      setRecording(true)
      setRecordingTime(0)

      timerRef.current = setInterval(() => {
        setRecordingTime(t => {
          if (t >= 59) { stopRecording(); return 60 }
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

  async function confirmRecording() {
    if (!audioBlob) return
    setUploading(true)
    setError(null)

    try {
      // blob → base64
      const arrayBuffer = await audioBlob.arrayBuffer()
      const uint8 = new Uint8Array(arrayBuffer)
      let binary = ''
      for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i])
      const base64 = btoa(binary)

      const mimeType = audioBlob.type || 'audio/webm'

      const res = await fetch('/api/upload-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: base64,
          mimeType,
          submissionId,
          questionId,
        }),
      })

      if (!res.ok) throw new Error('업로드 실패')
      const data = await res.json()
      setUploaded(true)
      onRecorded?.(data.audioUrl)
    } catch (e) {
      setError('녹음 저장 중 오류가 발생했습니다. 다시 시도해주세요.')
      console.error(e)
    } finally {
      setUploading(false)
    }
  }

  function reset() {
    setAudioBlob(null)
    setLocalAudioUrl(null)
    setUploaded(false)
    setError(null)
    setRecordingTime(0)
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        {/* 녹음 전 / 녹음 중 */}
        {!audioBlob && (
          <div className="text-center">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 transition ${
              recording ? 'bg-red-100 animate-pulse' : 'bg-gray-100'
            }`}>
              {recording ? <Mic size={32} className="text-red-500" /> : <MicOff size={32} className="text-gray-400" />}
            </div>

            {recording && (
              <p className="text-2xl font-black text-red-500 tabular-nums mb-2">
                {String(Math.floor(recordingTime / 60)).padStart(2, '0')}:
                {String(recordingTime % 60).padStart(2, '0')}
                <span className="text-sm font-normal text-gray-400 ml-2">/ 01:00</span>
              </p>
            )}

            <p className="text-sm text-gray-500 mb-5">
              {recording ? '녹음 중... 말하기를 마치면 중지를 누르세요' : '준비되면 녹음 버튼을 누르세요 (최대 60초)'}
            </p>

            {!recording ? (
              <button onClick={startRecording}
                className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold text-sm inline-flex items-center gap-2 transition">
                <Mic size={16} /> 녹음 시작
              </button>
            ) : (
              <button onClick={stopRecording}
                className="px-6 py-3 bg-gray-800 hover:bg-gray-900 text-white rounded-xl font-bold text-sm inline-flex items-center gap-2 transition">
                <Square size={16} /> 녹음 중지
              </button>
            )}
          </div>
        )}

        {/* 녹음 완료 → 확인 */}
        {audioBlob && !uploaded && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Mic size={20} className="text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">녹음 완료 ({recordingTime}초)</p>
                <p className="text-xs text-gray-500">내용을 확인하고 제출하세요</p>
              </div>
            </div>

            {localAudioUrl && (
              <audio controls src={localAudioUrl} className="w-full mb-4 rounded-lg" />
            )}

            <div className="flex gap-2">
              <button onClick={reset}
                className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
                <RotateCcw size={14} /> 다시 녹음
              </button>
              <button onClick={confirmRecording} disabled={uploading}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl text-sm font-bold inline-flex items-center justify-center gap-2 transition">
                {uploading
                  ? <><Loader2 size={14} className="animate-spin" /> 저장 중...</>
                  : '✅ 녹음 제출'
                }
              </button>
            </div>
          </div>
        )}

        {/* 제출 완료 */}
        {uploaded && (
          <div className="text-center py-4">
            <CheckCircle size={40} className="text-emerald-500 mx-auto mb-3" />
            <p className="font-bold text-gray-900 mb-1">녹음이 저장되었습니다!</p>
            <p className="text-sm text-gray-500">선생님이 확인 후 채점합니다.</p>
            <button onClick={reset}
              className="mt-3 text-xs text-blue-600 hover:underline inline-flex items-center gap-1">
              <RotateCcw size={12} /> 다시 녹음하기
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
          <AlertCircle size={16} className="flex-shrink-0" />
          {error}
        </div>
      )}
    </div>
  )
}
