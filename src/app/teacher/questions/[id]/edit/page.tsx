'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CATEGORY_LABELS, DIFFICULTY_LEVELS, QUESTION_SUBTYPE_LABELS, getDiffInfo, usesAlphaOptions, optionLabel } from '@/lib/utils'
import { Loader2, Volume2 } from 'lucide-react'

const CATEGORY_COLORS: Record<string, string> = {
  reading:   'bg-blue-100 text-blue-700',
  listening: 'bg-emerald-100 text-emerald-700',
  speaking:  'bg-orange-100 text-orange-700',
  writing:   'bg-purple-100 text-purple-700',
}
import UnderlineTextarea from '@/components/ui/UnderlineTextarea'

const FILL_BLANK_SUBTYPES = ['complete_the_words', 'sentence_completion']

export default function EditQuestionPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()

  const [questionSubtype, setQuestionSubtype] = useState('')
  const [type, setType] = useState<'multiple_choice' | 'short_answer' | 'essay'>('multiple_choice')
  const [category, setCategory] = useState('grammar')
  const [subcategory, setSubcategory] = useState('')  // topic
  const [summary, setSummary] = useState('')
  const [difficulty, setDifficulty] = useState(3.0)
  const [content, setContent] = useState('')
  const [passage, setPassage] = useState('')
  const [options, setOptions] = useState([
    { num: 1, text: '' }, { num: 2, text: '' }, { num: 3, text: '' },
    { num: 4, text: '' }, { num: 5, text: '' },
  ])
  const [answer, setAnswer] = useState('')
  const [explanation, setExplanation] = useState('')

  // fill-blank specific fields (parsed from explanation JSON)
  const [fbTitle, setFbTitle] = useState('')
  const [fbTimeLimit, setFbTimeLimit] = useState(10)

  // listening / speaking audio fields
  const [audioScript, setAudioScript] = useState('')
  const [audioUrl, setAudioUrl] = useState('')
  const [speakingPrompt, setSpeakingPrompt] = useState('')
  const [generatingAudio, setGeneratingAudio] = useState(false)
  const [voiceGender, setVoiceGender] = useState<'yw' | 'ym' | 'ow' | 'om'>('yw')

  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')

  const isFillBlank = FILL_BLANK_SUBTYPES.includes(questionSubtype)
  const isListening = category === 'listening'
  const isSpeaking = category === 'speaking'
  const isConversation = questionSubtype === 'conversation'
  const isSingleSpeaker = ['choose_response', 'academic_talk', 'listen_and_repeat', 'take_an_interview'].includes(questionSubtype)

  useEffect(() => {
    async function fetchQuestion() {
      const { data, error: fetchError } = await supabase
        .from('questions')
        .select('*')
        .eq('id', id)
        .single()

      if (fetchError || !data) {
        setError('문제를 불러올 수 없습니다.')
        setFetching(false)
        return
      }

      setQuestionSubtype(data.question_subtype ?? '')
      setType(data.type)
      setCategory(data.category)
      setSubcategory(data.subcategory ?? '')
      setSummary((data as typeof data & { summary?: string | null }).summary ?? '')
      setDifficulty(data.difficulty)
      setContent(data.content)
      setPassage(data.passage ?? '')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = data as any
      setAudioScript(d.audio_script ?? '')
      setAudioUrl(d.audio_url ?? '')
      setSpeakingPrompt(d.speaking_prompt ?? '')

      const subtype = data.question_subtype ?? ''
      if (FILL_BLANK_SUBTYPES.includes(subtype)) {
        const rawExp = data.explanation ?? ''
        let isWizardMeta = false
        if (rawExp.startsWith('{')) {
          try {
            const meta = JSON.parse(rawExp)
            if (meta.format !== undefined) {
              // 위저드 저장 포맷 — JSON 메타데이터
              setFbTitle(meta.title ?? '')
              setFbTimeLimit(meta.timeLimit ?? 10)
              setExplanation(meta.explanation ?? '')
              isWizardMeta = true
            }
          } catch { /* not JSON */ }
        }
        if (!isWizardMeta) {
          // AI 생성 등 일반 텍스트 해설
          setFbTitle('')
          setFbTimeLimit(10)
          setExplanation(rawExp)
        }
        // answer may be old JSON format {"answers":[...],...} or new comma-separated
        const rawAnswer = data.answer ?? ''
        if (rawAnswer.startsWith('{')) {
          try {
            const parsed = JSON.parse(rawAnswer)
            setAnswer(Array.isArray(parsed.answers) ? parsed.answers.join(',') : rawAnswer)
          } catch {
            setAnswer(rawAnswer)
          }
        } else {
          setAnswer(rawAnswer)
        }
      } else {
        let loadedAnswer = data.answer ?? ''
        if (data.type === 'multiple_choice' && usesAlphaOptions(data.category, data.question_subtype)) {
          const numToLetter: Record<string, string> = { '1': 'A', '2': 'B', '3': 'C', '4': 'D', '5': 'E' }
          loadedAnswer = numToLetter[loadedAnswer] ?? loadedAnswer
        }
        setAnswer(loadedAnswer)
        setExplanation(data.explanation ?? '')
      }

      if (data.type === 'multiple_choice' && Array.isArray(data.options)) {
        const loaded = data.options as { num: number; text: string }[]
        setOptions([1, 2, 3, 4, 5].map(n => ({
          num: n,
          text: loaded.find(o => o.num === n)?.text ?? '',
        })))
      }

      setFetching(false)
    }

    fetchQuestion()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function generateAudio() {
    if (!audioScript.trim()) { setError('스크립트를 먼저 입력하세요.'); return }
    setGeneratingAudio(true)
    setError('')
    try {
      const res = await fetch('/api/ai/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: audioScript,
          questionId: id,
          gender: voiceGender,
          subtype: questionSubtype,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'TTS 생성 실패'); return }
      setAudioUrl(data.audioUrl)
    } finally {
      setGeneratingAudio(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    // alpha-option 문제(리스닝·특정 리딩): A→1, B→2, C→3, D→4 정규화
    let finalAnswer = answer
    if (type === 'multiple_choice' && usesAlphaOptions(category, questionSubtype)) {
      const letterMap: Record<string, string> = { A: '1', B: '2', C: '3', D: '4', E: '5' }
      finalAnswer = letterMap[answer.trim().toUpperCase()] ?? answer.trim()
    }

    let savedExplanation: string | null
    if (isFillBlank) {
      savedExplanation = JSON.stringify({
        title: fbTitle,
        difficulty,
        timeLimit: fbTimeLimit,
        format: questionSubtype === 'complete_the_words' ? 'paragraph' : 'sentences',
        explanation,
      })
    } else {
      savedExplanation = explanation || null
    }

    const { error: dbError } = await supabase
      .from('questions')
      .update({
        type,
        category,
        subcategory: subcategory || null,
        summary: summary || null,
        difficulty,
        content,
        passage: passage || null,
        options: type === 'multiple_choice' ? options.filter(o => o.text.trim()) : null,
        answer: finalAnswer,
        explanation: savedExplanation,
        ...(isListening || isSpeaking ? {
          audio_script: audioScript || null,
          audio_url: audioUrl || null,
        } : {}),
        ...(isSpeaking ? { speaking_prompt: speakingPrompt || null } : {}),
      } as Record<string, unknown>)
      .eq('id', id)

    if (dbError) {
      setError('저장에 실패했습니다.')
      setLoading(false)
      return
    }

    router.push('/teacher/questions')
    router.refresh()
  }

  if (fetching) {
    return (
      <div className="p-7 flex items-center justify-center min-h-64">
        <p className="text-gray-400">불러오는 중...</p>
      </div>
    )
  }

  return (
    <div className="p-7 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">✏️ 문제 수정</h1>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${CATEGORY_COLORS[category] ?? 'bg-gray-100 text-gray-600'}`}>
            {CATEGORY_LABELS[category] ?? category}
          </span>
          {questionSubtype && (
            <span className="text-xs font-bold px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full">
              {QUESTION_SUBTYPE_LABELS[category]?.[questionSubtype] ?? questionSubtype}
            </span>
          )}
          {(() => { const d = getDiffInfo(difficulty); return (
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${d.color}`}>{d.cefr} {d.label}</span>
          )})()}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">{error}</div>}

        {/* 기본 설정 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="font-bold text-gray-900">기본 설정</h2>

          {isFillBlank ? (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">제목</label>
                <input value={fbTitle} onChange={e => setFbTitle(e.target.value)}
                  placeholder="문제 세트 제목"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">제한 시간 (분)</label>
                <input type="number" min={1} max={60} value={fbTimeLimit} onChange={e => setFbTimeLimit(Number(e.target.value))}
                  className="w-full max-w-xs px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">주제 키워드</label>
                <input value={subcategory} onChange={e => setSubcategory(e.target.value)}
                  placeholder="예: 환경, IT, 경제, 캠퍼스생활..."
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">요약 내용</label>
                <textarea value={summary} onChange={e => setSummary(e.target.value)}
                  placeholder="예: 환경오염이 기후변화에 미치는 영향을 다룬 학술 지문"
                  rows={2}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
            </div>
          )}

          {/* 난이도 — 11-level grid */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">난이도</label>
            <div className="flex flex-wrap gap-1.5">
              {DIFFICULTY_LEVELS.map(d => (
                <button key={d.value} type="button" onClick={() => setDifficulty(d.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                    difficulty === d.value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300'
                  }`}>
                  {d.label} <span className="font-normal opacity-70">{d.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 리스닝/스피킹 음성 스크립트 — 문제보다 위 */}
        {(isListening || isSpeaking) && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Volume2 size={16} className="text-emerald-600" />
              <h2 className="font-bold text-gray-900">
                {isListening ? '음성 스크립트' : '음성 스크립트 (선택)'}
              </h2>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                {isListening ? '리스닝 스크립트 (영어)' : '음성 스크립트 (영어)'}
              </label>
              <textarea
                value={audioScript}
                onChange={e => setAudioScript(e.target.value)}
                placeholder="학생이 들을 영어 스크립트를 입력하세요..."
                rows={5}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {/* 목소리 선택 */}
            {isSingleSpeaker && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">목소리</label>
                <div className="flex flex-wrap gap-2">
                  {([
                    { key: 'yw', label: 'Y W', desc: 'Neural2-F', color: 'pink' },
                    { key: 'ym', label: 'Y M', desc: 'Neural2-D', color: 'blue' },
                    { key: 'ow', label: 'O W', desc: 'Neural2-E', color: 'purple' },
                    { key: 'om', label: 'O M', desc: 'Neural2-J', color: 'green' },
                  ] as const).map(v => (
                    <button key={v.key} type="button" onClick={() => setVoiceGender(v.key)}
                      className={`flex flex-col items-center px-4 py-2 rounded-xl text-sm font-bold border transition ${
                        voiceGender === v.key
                          ? `bg-${v.color}-100 text-${v.color}-700 border-${v.color}-300`
                          : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                      }`}>
                      <span>{v.label}</span>
                      <span className="text-[10px] font-normal opacity-60">{v.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {isConversation && (
              <p className="text-xs text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg">
                💬 대화형: <strong>A:</strong> 여성 목소리 · <strong>B:</strong> 남성 목소리로 자동 생성됩니다.<br/>
                스크립트를 <code className="bg-white px-1 rounded">A: 문장</code> / <code className="bg-white px-1 rounded">B: 문장</code> 형식으로 입력하세요.
              </p>
            )}

            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={generateAudio}
                disabled={generatingAudio || !audioScript.trim()}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition"
              >
                {generatingAudio
                  ? <><Loader2 size={14} className="animate-spin" /> 생성 중...</>
                  : <><Volume2 size={14} /> AI 음성 생성</>
                }
              </button>
              {audioUrl && (
                <div className="flex items-center gap-2">
                  <audio controls src={audioUrl} className="h-9 max-w-xs rounded-lg" />
                  <span className="text-xs text-emerald-700 font-bold">✓ 생성됨</span>
                </div>
              )}
            </div>

            {isSpeaking && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">스피킹 과제 (학생에게 보여줄 지시문)</label>
                <textarea
                  value={speakingPrompt}
                  onChange={e => setSpeakingPrompt(e.target.value)}
                  placeholder="예: Listen and summarize the main point of the conversation."
                  rows={3}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            )}
          </div>
        )}

        {/* 지문 — 리스닝은 스크립트가 있으므로 숨김, fill-blank는 별도 처리 */}
        {!isListening && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="font-bold text-gray-900">
            {isFillBlank
              ? questionSubtype === 'complete_the_words' ? '단락 (빈칸 포함)' : '문장 목록 (빈칸 포함)'
              : '지문 (선택)'}
          </h2>
          {isFillBlank ? (
            <textarea value={content} onChange={e => setContent(e.target.value)}
              placeholder={questionSubtype === 'complete_the_words'
                ? '빈칸이 포함된 학술 단락을 입력하세요. 예: te__, bel____'
                : '빈칸이 있는 문장을 한 줄씩 입력하세요. 예: The scientist ___ to work late.'}
              rows={8} required
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono" />
          ) : (
            <UnderlineTextarea
              value={passage}
              onChange={setPassage}
              placeholder="독해 지문이 있으면 여기에 입력하세요..."
              rows={5}
            />
          )}
        </div>
        )}

        {/* 문제 본문 (non-fill-blank only) / 정답 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="font-bold text-gray-900">
            {isFillBlank ? '정답 목록' : '문제'}
          </h2>

          {!isFillBlank && (
            <>
              <textarea value={content} onChange={e => setContent(e.target.value)}
                placeholder="문제를 입력하세요..."
                rows={4} required
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />

              {type === 'multiple_choice' && (
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">보기</label>
                  {options.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded-full text-xs font-bold text-gray-600 flex-shrink-0">
                        {optionLabel(opt.num, usesAlphaOptions(category, questionSubtype))}
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
            </>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              {isFillBlank
                ? '정답 (쉼표로 구분, 빈칸 순서대로)'
                : type === 'multiple_choice' ? '정답 번호' : '정답'}
            </label>
            <input
              value={answer} onChange={e => setAnswer(e.target.value)}
              placeholder={isFillBlank ? '예: tend,believe,surface,recognize,...' : type === 'multiple_choice' ? (usesAlphaOptions(category, questionSubtype) ? '예: B 또는 2' : '예: 2') : '정답을 입력하세요'}
              required
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {isFillBlank && (
              <p className="text-xs text-gray-400 mt-1">빈칸에 들어갈 완성된 단어를 순서대로 쉼표로 구분하여 입력하세요</p>
            )}
          </div>
        </div>

        {/* 해설 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-gray-900 mb-3">해설 (선택)</h2>
          <textarea value={explanation} onChange={e => setExplanation(e.target.value)}
            placeholder={isFillBlank ? '각 빈칸의 정답 근거나 문법 포인트를 설명해주세요...' : '정답 해설을 입력하면 학생들에게 도움이 돼요...'}
            rows={3}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()}
            className="px-6 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
            취소
          </button>
          <button type="submit" disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold py-3 rounded-xl transition text-sm">
            {loading ? '저장 중...' : '수정 완료'}
          </button>
        </div>
      </form>
    </div>
  )
}
