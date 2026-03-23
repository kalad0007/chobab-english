'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CATEGORY_LABELS } from '@/lib/utils'
import { Loader2, Volume2, Mic } from 'lucide-react'
import UnderlineTextarea from '@/components/ui/UnderlineTextarea'

export default function NewQuestionPage() {
  const router = useRouter()
  const supabase = createClient()

  const [type, setType] = useState<'multiple_choice' | 'short_answer' | 'essay'>('multiple_choice')
  const [category, setCategory] = useState('grammar')
  const [subcategory, setSubcategory] = useState('')
  const [difficulty, setDifficulty] = useState(3)
  const [content, setContent] = useState('')
  const [passage, setPassage] = useState('')
  const [options, setOptions] = useState([
    { num: 1, text: '' }, { num: 2, text: '' }, { num: 3, text: '' },
    { num: 4, text: '' }, { num: 5, text: '' },
  ])
  const [answer, setAnswer] = useState('')
  const [explanation, setExplanation] = useState('')

  // 리스닝 필드
  const [audioScript, setAudioScript] = useState('')
  const [audioUrl, setAudioUrl] = useState('')
  const [audioPlayLimit, setAudioPlayLimit] = useState(3)
  const [generatingAudio, setGeneratingAudio] = useState(false)

  // 스피킹 필드
  const [speakingPrompt, setSpeakingPrompt] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isListening = category === 'listening'
  const isSpeaking = category === 'speaking'

  async function generateAudio() {
    if (!audioScript.trim()) {
      setError('음성으로 변환할 스크립트를 먼저 입력하세요.')
      return
    }
    setGeneratingAudio(true)
    setError('')

    const res = await fetch('/api/ai/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script: audioScript, questionId: `temp_${Date.now()}` }),
    })

    if (res.ok) {
      const data = await res.json()
      setAudioUrl(data.audioUrl)
    } else {
      const err = await res.json()
      setError(`음성 생성 실패: ${err.detail ?? err.error ?? '알 수 없는 오류'}`)
    }
    setGeneratingAudio(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error: dbError } = await supabase.from('questions').insert({
      teacher_id: user.id,
      type,
      category,
      subcategory: subcategory || null,
      difficulty,
      content,
      passage: passage || null,
      options: type === 'multiple_choice' ? options.filter(o => o.text.trim()) : null,
      answer: isSpeaking ? '' : answer,
      explanation: explanation || null,
      source: 'teacher',
      // 리스닝/스피킹 필드
      audio_url: audioUrl || null,
      audio_script: audioScript || null,
      audio_play_limit: isListening ? audioPlayLimit : null,
      speaking_prompt: speakingPrompt || null,
    })

    if (dbError) {
      setError('저장에 실패했습니다: ' + dbError.message)
      setLoading(false)
      return
    }

    router.push('/teacher/questions')
    router.refresh()
  }

  return (
    <div className="p-7 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">✏️ 문제 직접 출제</h1>
        <p className="text-gray-500 text-sm mt-1">새 문제를 문제은행에 추가합니다</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">{error}</div>}

        {/* 기본 설정 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="font-bold text-gray-900">기본 설정</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">문제 유형</label>
              <select value={type} onChange={e => setType(e.target.value as typeof type)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="multiple_choice">객관식</option>
                <option value="short_answer">단답형</option>
                <option value="essay">서술형</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">영역</label>
              <select value={category} onChange={e => setCategory(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">난이도</label>
              <div className="flex gap-1 mt-1">
                {[1,2,3,4,5].map(d => (
                  <button key={d} type="button" onClick={() => setDifficulty(d)}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${d <= difficulty ? 'bg-amber-400 text-white' : 'bg-gray-100 text-gray-400'}`}>
                    ★
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">세부 유형 (선택)</label>
            <input value={subcategory} onChange={e => setSubcategory(e.target.value)}
              placeholder={isListening ? '예: purpose, topic, detail, order...' : isSpeaking ? '예: describe, opinion, presentation...' : '예: tense, synonym, main_idea...'}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {/* 리스닝 설정 */}
        {isListening && (
          <div className="bg-blue-50 rounded-2xl border border-blue-200 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Volume2 size={18} className="text-blue-600" />
              <h2 className="font-bold text-blue-900">리스닝 음성 설정</h2>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                음성 스크립트 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={audioScript}
                onChange={e => setAudioScript(e.target.value)}
                placeholder="학생이 듣게 될 영어 지문을 입력하세요. Gemini AI가 자연스러운 영어 음성으로 변환합니다."
                rows={5}
                className="w-full px-3 py-2.5 border border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={generateAudio}
                disabled={generatingAudio || !audioScript.trim()}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl text-sm font-bold transition"
              >
                {generatingAudio ? (
                  <><Loader2 size={15} className="animate-spin" /> 음성 생성 중...</>
                ) : (
                  <><Volume2 size={15} /> AI 음성 생성</>
                )}
              </button>
              {audioUrl && (
                <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                  <span className="text-sm font-semibold">✓ 음성 생성 완료</span>
                  <audio controls src={audioUrl} className="h-8" />
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">최대 재생 횟수</label>
              <div className="flex gap-2">
                {[1, 2, 3].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setAudioPlayLimit(n)}
                    className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition ${audioPlayLimit === n ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-200 text-gray-600 hover:border-blue-300'}`}
                  >
                    {n}회
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">수능 리스닝은 보통 1회, 연습은 2-3회를 권장합니다.</p>
            </div>
          </div>
        )}

        {/* 스피킹 설정 */}
        {isSpeaking && (
          <div className="bg-amber-50 rounded-2xl border border-amber-200 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Mic size={18} className="text-amber-600" />
              <h2 className="font-bold text-amber-900">스피킹 과제 설정</h2>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                스피킹 과제 지시문 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={speakingPrompt}
                onChange={e => setSpeakingPrompt(e.target.value)}
                placeholder="예: Describe your favorite hobby in 3-4 sentences. 또는 What do you think about school uniforms? Give your opinion with two reasons."
                rows={3}
                className="w-full px-3 py-2.5 border border-amber-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none bg-white"
              />
              <p className="text-xs text-gray-500 mt-1">학생에게 보여질 말하기 과제입니다. AI가 자동으로 발음, 문법, 내용을 평가합니다.</p>
            </div>
          </div>
        )}

        {/* 지문 (독해/리스닝 문제) */}
        {!isSpeaking && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <h2 className="font-bold text-gray-900">
              {isListening ? '보조 지문 (선택)' : '지문 (선택)'}
            </h2>
            <UnderlineTextarea
              value={passage}
              onChange={setPassage}
              placeholder={isListening ? '그림/표 설명 등 추가 지문이 있으면 입력하세요...' : '독해 지문이 있으면 여기에 입력하세요...'}
              rows={5}
            />
          </div>
        )}

        {/* 문제 본문 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="font-bold text-gray-900">문제</h2>
          <textarea value={content} onChange={e => setContent(e.target.value)}
            placeholder={
              isListening ? '예: 대화를 듣고, 남자의 마지막 말에 대한 응답으로 가장 적절한 것을 고르시오.' :
              isSpeaking ? '예: 다음 주제에 대해 영어로 말해보세요. (AI가 평가합니다)' :
              '문제를 입력하세요...'
            }
            rows={3} required
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />

          {/* 객관식 보기 (스피킹 아닐 때) */}
          {type === 'multiple_choice' && !isSpeaking && (
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">보기</label>
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded-full text-xs font-bold text-gray-600 flex-shrink-0">
                    {opt.num}
                  </span>
                  <input
                    value={opt.text}
                    onChange={e => {
                      const next = [...options]
                      next[i] = { ...next[i], text: e.target.value }
                      setOptions(next)
                    }}
                    placeholder={`보기 ${opt.num}`}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
            </div>
          )}

          {/* 정답 (스피킹 제외) */}
          {!isSpeaking && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                {type === 'multiple_choice' ? '정답 번호' : '정답'}
              </label>
              <input
                value={answer} onChange={e => setAnswer(e.target.value)}
                placeholder={type === 'multiple_choice' ? '예: 2' : '정답을 입력하세요'}
                required={!isSpeaking}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
        </div>

        {/* 해설 */}
        {!isSpeaking && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-bold text-gray-900 mb-3">해설 (선택)</h2>
            <textarea value={explanation} onChange={e => setExplanation(e.target.value)}
              placeholder="정답 해설을 입력하면 학생들에게 도움이 돼요..."
              rows={3}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()}
            className="px-6 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
            취소
          </button>
          <button type="submit" disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold py-3 rounded-xl transition text-sm">
            {loading ? '저장 중...' : '문제 저장'}
          </button>
        </div>
      </form>
    </div>
  )
}
