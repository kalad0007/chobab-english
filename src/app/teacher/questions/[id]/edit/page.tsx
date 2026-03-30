'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CATEGORY_LABELS, DIFFICULTY_LEVELS, QUESTION_SUBTYPE_LABELS, getDiffInfo, usesAlphaOptions, optionLabel, DEFAULT_TIME_LIMITS, formatSeconds } from '@/lib/utils'
import { Loader2, Volume2 } from 'lucide-react'
import AutoResizeTextarea from '@/components/ui/AutoResizeTextarea'
import InlineFillBlankEditor from '@/components/ui/InlineFillBlankEditor'

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

  const [timeLimit, setTimeLimit] = useState<number>(30)

  // 핵심단어
  const [vocabWords, setVocabWords] = useState<{ word: string; pos: string; def: string; example: string }[]>([])

  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')

  const isFillBlank = FILL_BLANK_SUBTYPES.includes(questionSubtype)
  const isListening = category === 'listening'
  const isSpeaking = category === 'speaking'
  const isConversation = questionSubtype === 'conversation'
  const isSingleSpeaker = ['choose_response', 'academic_talk', 'listen_and_repeat', 'take_an_interview'].includes(questionSubtype)
  const isListenAndRepeat = questionSubtype === 'listen_and_repeat'
  const isWritingLong = questionSubtype === 'email_writing' || questionSubtype === 'academic_discussion' || questionSubtype === 'take_an_interview'

  // academic_discussion: explanation 필드를 채점기준 + 번역으로 분리
  const KR_DELIMITER = '\n\n===번역==='
  const isAcadDisc = questionSubtype === 'academic_discussion'
  const explanationScore = isAcadDisc ? (explanation.split(KR_DELIMITER)[0] ?? explanation) : explanation
  const explanationTranslation = isAcadDisc ? (explanation.split(KR_DELIMITER)[1]?.replace(/^\n\n/, '') ?? '') : ''
  function setExplanationScore(val: string) {
    if (isAcadDisc) setExplanation(val + (explanationTranslation ? KR_DELIMITER + '\n\n' + explanationTranslation : ''))
    else setExplanation(val)
  }
  function setExplanationTranslation(val: string) {
    setExplanation((explanationScore || '') + KR_DELIMITER + '\n\n' + val)
  }

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
      // 핵심단어 로드
      if (Array.isArray(d.vocab_words)) {
        setVocabWords(d.vocab_words.map((v: { word: string; pos?: string; def: string; example?: string }) => ({
          word: v.word ?? '', pos: v.pos ?? '', def: v.def ?? '', example: v.example ?? '',
        })))
      }
      // 제한시간: 저장된 값 → 없으면 subtype 기본값 → fallback 30
      const subtype2 = data.question_subtype ?? ''
      setTimeLimit(d.time_limit ?? DEFAULT_TIME_LIMITS[subtype2] ?? 30)

      const subtype = data.question_subtype ?? ''
      if (FILL_BLANK_SUBTYPES.includes(subtype)) {
        const rawExp = data.explanation ?? ''
        let isWizardMeta = false
        if (rawExp.startsWith('{')) {
          try {
            const meta = JSON.parse(rawExp)
            if (meta.format !== undefined) {
              setFbTitle(meta.title ?? '')
              setFbTimeLimit(meta.timeLimit ?? 10)
              setTimeLimit((meta.timeLimit ?? 10) * 60)  // stepper를 분→초로 동기화
              setExplanation(meta.explanation ?? '')
              isWizardMeta = true
            }
          } catch { /* not JSON */ }
        }
        if (!isWizardMeta) {
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

  // Listen and Repeat: audio_script가 있지만 audio_url이 없으면 자동으로 TTS 생성
  useEffect(() => {
    if (isListenAndRepeat && audioScript.trim() && !audioUrl && !fetching && !generatingAudio) {
      generateAudio()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListenAndRepeat, audioScript, audioUrl, fetching])

  // 스피킹(L&R 제외): speaking_prompt가 바뀌면 audio_script 동기화
  useEffect(() => {
    if (isSpeaking && !isListenAndRepeat) {
      setAudioScript(speakingPrompt)
    }
  }, [isSpeaking, isListenAndRepeat, speakingPrompt])

  async function generateAudio() {
    // 스피킹(L&R 제외): speaking_prompt를 스크립트로 사용
    const script = (isSpeaking && !isListenAndRepeat) ? speakingPrompt : audioScript
    if (!script.trim()) { setError('스크립트를 먼저 입력하세요.'); return }
    setGeneratingAudio(true)
    setError('')
    try {
      const res = await fetch('/api/ai/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script,
          questionId: id,
          gender: voiceGender,
          subtype: questionSubtype,
        }),
      })
      let data: { error?: string; audioUrl?: string } = {}
      try { data = await res.json() } catch { /* empty body */ }
      if (!res.ok) { setError(data.error ?? 'TTS 생성 실패'); return }
      setAudioUrl(data.audioUrl ?? '')
      // 스피킹: audio_script도 동기화
      if (isSpeaking && !isListenAndRepeat) setAudioScript(script)
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
        timeLimit: Math.round(timeLimit / 60),
        format: questionSubtype === 'complete_the_words' ? 'paragraph' : 'sentences',
        explanation,
      })
    } else {
      savedExplanation = explanation || null
    }

    // 스피킹(L&R 제외): speaking_prompt가 audio_script 역할을 겸함
    const finalAudioScript = (isSpeaking && !isListenAndRepeat)
      ? (speakingPrompt || null)
      : (audioScript || null)

    const finalVocabWords = vocabWords.filter(v => v.word.trim()).map(v => ({
      word: v.word.trim(),
      ...(v.pos.trim() ? { pos: v.pos.trim() } : {}),
      def: v.def.trim(),
      ...(v.example.trim() ? { example: v.example.trim() } : {}),
    }))

    const { error: dbError } = await supabase
      .from('questions')
      .update({
        type,
        category,
        subcategory: subcategory || null,
        summary: summary || null,
        difficulty,
        content,
        passage: (isSpeaking && !isListenAndRepeat) ? null : (passage || null),
        options: type === 'multiple_choice' ? options.filter(o => o.text.trim()) : null,
        answer: finalAnswer,
        explanation: savedExplanation,
        ...(isListening || isSpeaking ? {
          audio_script: finalAudioScript,
          audio_url: audioUrl || null,
        } : {}),
        ...(isSpeaking ? { speaking_prompt: speakingPrompt || null } : {}),
        vocab_words: finalVocabWords.length > 0 ? finalVocabWords : null,
        time_limit: timeLimit,
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
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">주제 키워드</label>
                <input value={subcategory} onChange={e => setSubcategory(e.target.value)}
                  placeholder="예: 환경, IT, 경제, 캠퍼스생활..."
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">요약 내용</label>
                <AutoResizeTextarea value={summary} onChange={e => setSummary(e.target.value)}
                  placeholder="예: 환경오염이 기후변화에 미치는 영향을 다룬 학술 지문"
                  minRows={3}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">주제 키워드</label>
                <input value={subcategory} onChange={e => setSubcategory(e.target.value)}
                  placeholder="예: 환경, IT, 경제, 캠퍼스생활..."
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">요약 내용</label>
                <AutoResizeTextarea value={summary} onChange={e => setSummary(e.target.value)}
                  placeholder="예: 환경오염이 기후변화에 미치는 영향을 다룬 학술 지문"
                  minRows={3}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          )}

          {/* 난이도 — 슬라이더 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">난이도</label>
            {(() => {
              const idx = Math.max(0, Math.min(DIFFICULTY_LEVELS.length - 1, Math.round((difficulty - 1.0) / 0.5)))
              const d = DIFFICULTY_LEVELS[idx]
              return (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-bold px-3 py-1 rounded-full ${d.color}`}>
                      {d.cefr} &nbsp; {d.value} &nbsp; {d.name}
                    </span>
                    <span className="text-xs text-gray-400">{d.level}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={DIFFICULTY_LEVELS.length - 1}
                    step={1}
                    value={idx}
                    onChange={e => setDifficulty(DIFFICULTY_LEVELS[Number(e.target.value)].value)}
                    className="w-full cursor-pointer accent-blue-600"
                  />
                  <div className="flex justify-between text-[10px] text-gray-400 px-0.5">
                    <span>A1 기초</span>
                    <span>C2+ Mastery</span>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>

        {/* 제한 시간 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <label className="block text-sm font-semibold text-gray-700 mb-3">제한 시간</label>
          <div className="flex items-center gap-3">
            <button type="button"
              onClick={() => setTimeLimit(t => Math.max(5, t - 5))}
              className="w-9 h-9 rounded-xl border border-gray-200 bg-white text-gray-600 text-lg font-bold hover:bg-gray-50 transition flex items-center justify-center">
              −
            </button>
            <div className="text-center min-w-[80px]">
              <span className="text-xl font-extrabold text-gray-900">{formatSeconds(timeLimit)}</span>
            </div>
            <button type="button"
              onClick={() => setTimeLimit(t => t + 5)}
              className="w-9 h-9 rounded-xl border border-gray-200 bg-white text-gray-600 text-lg font-bold hover:bg-gray-50 transition flex items-center justify-center">
              +
            </button>
            {questionSubtype && DEFAULT_TIME_LIMITS[questionSubtype] && (
              <button type="button"
                onClick={() => setTimeLimit(DEFAULT_TIME_LIMITS[questionSubtype])}
                className="ml-2 text-xs text-blue-600 hover:underline">
                기본값 ({formatSeconds(DEFAULT_TIME_LIMITS[questionSubtype])})
              </button>
            )}
          </div>
        </div>

        {/* 리스닝/스피킹 음성 섹션 */}
        {(isListening || isSpeaking) && (
          <div className={`rounded-2xl border shadow-sm p-5 space-y-4 ${isSpeaking ? 'bg-orange-50 border-orange-100' : 'bg-white border-gray-100'}`}>
            <div className="flex items-center gap-2">
              <Volume2 size={16} className={isSpeaking ? 'text-orange-600' : 'text-emerald-600'} />
              <h2 className="font-bold text-gray-900">
                {isListening ? '음성 스크립트' : isListenAndRepeat ? 'Listen & Repeat 문장' : '스피킹 과제 질문 (음성으로 재생됨)'}
              </h2>
            </div>

            {/* 리스닝 or L&R: 직접 스크립트 입력 */}
            {(isListening || isListenAndRepeat) && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  {isListening ? '리스닝 스크립트 (영어)' : '반복할 문장 (영어)'}
                </label>
                <AutoResizeTextarea
                  value={audioScript}
                  onChange={e => setAudioScript(e.target.value)}
                  placeholder={isListenAndRepeat ? '학생이 따라 말할 문장을 입력하세요...' : '학생이 들을 영어 스크립트를 입력하세요...'}
                  minRows={3}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white"
                />
              </div>
            )}

            {/* 스피킹(L&R 제외): speaking_prompt가 곧 음성 스크립트 */}
            {isSpeaking && !isListenAndRepeat && (
              <div>
                <AutoResizeTextarea
                  value={speakingPrompt}
                  onChange={e => setSpeakingPrompt(e.target.value)}
                  placeholder="학생에게 음성으로 재생할 질문을 입력하세요..."
                  minRows={3}
                  className="w-full px-3 py-2.5 border border-orange-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none bg-white"
                />
                <p className="text-xs text-orange-600 mt-1.5">🔊 이 텍스트가 TTS로 변환되어 학생에게 음성으로만 제공됩니다.</p>
              </div>
            )}

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
                disabled={generatingAudio || (isListenAndRepeat ? !audioScript.trim() : isSpeaking ? !speakingPrompt.trim() : !audioScript.trim())}
                className={`flex items-center gap-2 px-4 py-2.5 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition ${isSpeaking ? 'bg-orange-500 hover:bg-orange-600' : 'bg-emerald-600 hover:bg-emerald-700'}`}
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
          </div>
        )}

        {/* ── Fill-blank 인터랙티브 편집기 ── */}
        {isFillBlank && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-bold text-gray-900 mb-4">
              {questionSubtype === 'sentence_completion' ? '문장 목록 (빈칸 채우기)' : '단락 (빈칸 채우기)'}
            </h2>
            <InlineFillBlankEditor
              key={`${questionSubtype}-${content.slice(0, 30)}`}
              subtype={questionSubtype as 'complete_the_words' | 'sentence_completion'}
              content={content}
              answer={answer}
              onChange={(c, a) => { setContent(c); setAnswer(a) }}
            />
          </div>
        )}

        {/* 지문 — 리스닝/스피킹/fill-blank/sentence_reordering/email_writing은 숨김 */}
        {!isListening && !isSpeaking && !isFillBlank && questionSubtype !== 'sentence_reordering' && questionSubtype !== 'email_writing' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="font-bold text-gray-900">지문 (선택)</h2>
          <UnderlineTextarea
            value={passage}
            onChange={setPassage}
            placeholder="독해 지문이 있으면 여기에 입력하세요..."
            rows={5}
          />
        </div>
        )}


        {/* 문제 본문 / 정답 (fill-blank 유형 제외) */}
        {!isFillBlank && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="font-bold text-gray-900">문제</h2>
          <AutoResizeTextarea value={content} onChange={e => setContent(e.target.value)}
            placeholder="문제를 입력하세요..."
            minRows={3} required
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />

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
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              {questionSubtype === 'email_writing' || questionSubtype === 'take_an_interview' ? '모범 답안' : type === 'multiple_choice' ? '정답 번호' : '정답'}
            </label>
            {isWritingLong ? (
              <AutoResizeTextarea value={answer} onChange={e => setAnswer(e.target.value)}
                placeholder={questionSubtype === 'email_writing' ? '모범 이메일 답안을 입력하세요...' : '모범 답안을 입력하세요...'}
                minRows={4} required
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            ) : (
              <input
                value={answer} onChange={e => setAnswer(e.target.value)}
                placeholder={type === 'multiple_choice' ? (usesAlphaOptions(category, questionSubtype) ? '예: B 또는 2' : '예: 2') : '정답을 입력하세요'}
                required
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>
        </div>
        )}

        {/* academic_discussion 한글 번역 (explanation 분리) */}
        {isAcadDisc && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="font-bold text-gray-900">한글 번역 (선택)</h2>
          <AutoResizeTextarea value={explanationTranslation} onChange={e => setExplanationTranslation(e.target.value)}
            placeholder="지문 및 모범 답안의 한글 번역을 입력하세요..."
            minRows={3}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>
        )}

        {/* email_writing 한글 번역 (passage 필드, 답안 다음에 위치) */}
        {questionSubtype === 'email_writing' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="font-bold text-gray-900">한글 번역 (선택)</h2>
          <AutoResizeTextarea value={passage} onChange={e => setPassage(e.target.value)}
            placeholder="문제 및 모범 답안의 한글 번역을 입력하세요..."
            minRows={3}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>
        )}

        {/* 해설 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-gray-900 mb-3">해설 (선택)</h2>
          <AutoResizeTextarea
            value={isAcadDisc ? explanationScore : explanation}
            onChange={e => isAcadDisc ? setExplanationScore(e.target.value) : setExplanation(e.target.value)}
            placeholder={isFillBlank ? '각 빈칸의 정답 근거나 문법 포인트를 설명해주세요...' : isAcadDisc ? '채점 기준을 입력하세요...' : '정답 해설을 입력하면 학생들에게 도움이 돼요...'}
            minRows={2}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>

        {/* 핵심단어 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-900">핵심 단어 (선택)</h2>
            <button type="button"
              onClick={() => setVocabWords(w => [...w, { word: '', pos: '', def: '', example: '' }])}
              className="text-xs font-bold px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition">
              + 단어 추가
            </button>
          </div>
          {vocabWords.length === 0 && (
            <p className="text-xs text-gray-400">단어 추가 버튼으로 핵심 어휘를 등록하세요. 해설 아래에 학생에게 표시됩니다.</p>
          )}
          {vocabWords.map((v, i) => (
            <div key={i} className="flex gap-2 items-start bg-indigo-50 rounded-xl p-3">
              <div className="flex-1 space-y-1.5">
                <div className="flex gap-1.5">
                  <input
                    value={v.word}
                    onChange={e => setVocabWords(w => w.map((x, j) => j === i ? { ...x, word: e.target.value } : x))}
                    placeholder="단어 (영어)"
                    className="flex-1 px-2.5 py-1.5 border border-indigo-200 rounded-lg text-sm font-bold text-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                  />
                  <input
                    value={v.pos}
                    onChange={e => setVocabWords(w => w.map((x, j) => j === i ? { ...x, pos: e.target.value } : x))}
                    placeholder="품사"
                    className="w-20 px-2.5 py-1.5 border border-indigo-200 rounded-lg text-xs font-semibold text-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white text-center"
                  />
                </div>
                <input
                  value={v.def}
                  onChange={e => setVocabWords(w => w.map((x, j) => j === i ? { ...x, def: e.target.value } : x))}
                  placeholder="정의/뜻 (한국어 or 영어)"
                  className="w-full px-2.5 py-1.5 border border-indigo-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                />
                <input
                  value={v.example}
                  onChange={e => setVocabWords(w => w.map((x, j) => j === i ? { ...x, example: e.target.value } : x))}
                  placeholder="문제/정답 속 예문 (선택)"
                  className="w-full px-2.5 py-1.5 border border-indigo-200 rounded-lg text-xs text-gray-500 italic focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                />
              </div>
              <button type="button"
                onClick={() => setVocabWords(w => w.filter((_, j) => j !== i))}
                className="text-gray-300 hover:text-red-400 transition mt-1 flex-shrink-0">
                ✕
              </button>
            </div>
          ))}
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
