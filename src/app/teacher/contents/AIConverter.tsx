'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Wand2, Loader2, Check, ChevronDown, ChevronRight, Music, BookmarkPlus } from 'lucide-react'
import { saveGeneratedQuestions } from './actions'

const LISTENING_TYPES = [
  { value: 'conversation',        label: 'Conversation',          desc: '두 사람 캠퍼스 대화' },
  { value: 'academic_talk',       label: 'Academic Talk',         desc: '교수 학술 강의' },
  { value: 'campus_announcement', label: 'Campus Announcement',   desc: '캠퍼스 공지' },
  { value: 'choose_response',     label: 'Choose a Response',     desc: '짧은 한마디 대화' },
]

const DIFFICULTY_OPTIONS = [
  { value: 2.0, label: 'Band 2.0 (초급)' },
  { value: 3.0, label: 'Band 3.0 (중급)' },
  { value: 4.0, label: 'Band 4.0 (고급)' },
  { value: 5.0, label: 'Band 5.0 (심화)' },
]

interface GeneratedResult {
  assetId?: string
  title: string
  script: string
  audioUrl: string | null
  questions: {
    content: string
    options: { num: number; text: string }[] | null
    answer: string
    explanation: string
    category: string
    question_subtype: string
    difficulty: number
    audio_script: string | null
    audio_url: string | null
  }[]
}

// ── Feature 1: Text Converter ───────────────────────────────────────────────

function TextConverter() {
  const router = useRouter()
  const [text, setText] = useState('')
  const [subtype, setSubtype] = useState('academic_passage')

  function handleConvert() {
    if (!text.trim()) return alert('텍스트를 입력하세요')
    // Store in sessionStorage and redirect to generate page
    sessionStorage.setItem('converter_text', text.trim())
    sessionStorage.setItem('converter_subtype', subtype)
    router.push(`/teacher/questions/generate?from=converter`)
  }

  const subtypes = [
    { value: 'academic_passage',      label: 'Academic Passage',       cat: 'reading' },
    { value: 'daily_life_email',      label: 'Daily Life — Email',     cat: 'reading' },
    { value: 'daily_life_text_chain', label: 'Daily Life — Text Chain',cat: 'reading' },
    { value: 'choose_response',       label: 'Choose a Response',      cat: 'listening' },
    { value: 'conversation',          label: 'Conversation',           cat: 'listening' },
    { value: 'academic_talk',         label: 'Academic Talk',          cat: 'listening' },
    { value: 'email_writing',         label: 'Write an Email',         cat: 'writing' },
    { value: 'academic_discussion',   label: 'Academic Discussion',    cat: 'writing' },
  ]

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
          <Wand2 size={18} className="text-blue-600" />
        </div>
        <div>
          <h3 className="font-bold text-gray-900">텍스트 → 문제 변환</h3>
          <p className="text-xs text-gray-500 mt-0.5">뉴스 기사, 위키피디아 등 외부 텍스트를 TOEFL 문제로 즉시 변환</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <label className="text-xs font-bold text-gray-500 mb-1.5 block">원문 텍스트 붙여넣기</label>
          <textarea value={text} onChange={e => setText(e.target.value)}
            rows={9} placeholder="여기에 영어 텍스트를 붙여넣으세요...&#10;&#10;예) A recent study published in Nature found that..."
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-bold text-gray-500 mb-1.5 block">변환할 문제 유형</label>
            <select value={subtype} onChange={e => setSubtype(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400">
              <optgroup label="Reading">
                {subtypes.filter(s => s.cat === 'reading').map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </optgroup>
              <optgroup label="Listening">
                {subtypes.filter(s => s.cat === 'listening').map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </optgroup>
              <optgroup label="Writing">
                {subtypes.filter(s => s.cat === 'writing').map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </optgroup>
            </select>
          </div>

          <div className="mt-auto bg-blue-50 rounded-xl p-3">
            <p className="text-[11px] text-blue-700 font-medium leading-relaxed">
              📌 텍스트 길이나 레벨 설정은 다음 단계(AI 생성 페이지)에서 조정할 수 있어요.
            </p>
          </div>

          <button onClick={handleConvert}
            className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition">
            <Wand2 size={15} /> 문제 변환하기
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Feature 2: Audio + Questions Generator ──────────────────────────────────

function AudioGenerator() {
  const [keywords, setKeywords] = useState('')
  const [subtype, setSubtype] = useState('conversation')
  const [difficulty, setDifficulty] = useState(3.0)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<GeneratedResult | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showScript, setShowScript] = useState(false)

  async function handleGenerate() {
    if (!keywords.trim()) return alert('키워드를 입력하세요')
    setLoading(true); setResult(null); setSaved(false)

    const res = await fetch('/api/ai/generate-asset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords: keywords.trim(), subtype, difficulty }),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) return alert('생성 실패: ' + (data.error ?? '알 수 없는 오류'))
    setResult(data)
  }

  async function handleSaveQuestions() {
    if (!result) return
    setSaving(true)
    const err = await saveGeneratedQuestions(result.questions)
    setSaving(false)
    if (err.error) return alert('저장 실패: ' + err.error)
    setSaved(true)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
          <Sparkles size={18} className="text-purple-600" />
        </div>
        <div>
          <h3 className="font-bold text-gray-900">키워드 → 오디오 + 문제 자동 생성</h3>
          <p className="text-xs text-gray-500 mt-0.5">키워드만 입력하면 스크립트 + MP3 + 문제 2개를 한 번에 생성</p>
        </div>
      </div>

      {/* Input row */}
      <div className="grid grid-cols-12 gap-3 mb-4">
        <div className="col-span-5">
          <label className="text-xs font-bold text-gray-500 mb-1.5 block">키워드 / 주제</label>
          <input value={keywords} onChange={e => setKeywords(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleGenerate()}
            placeholder="예: 기숙사 층간소음 문제, 생물학 세포 분열..."
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-400" />
        </div>
        <div className="col-span-3">
          <label className="text-xs font-bold text-gray-500 mb-1.5 block">문제 유형</label>
          <select value={subtype} onChange={e => setSubtype(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-400">
            {LISTENING_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className="text-xs font-bold text-gray-500 mb-1.5 block">난이도</label>
          <select value={difficulty} onChange={e => setDifficulty(Number(e.target.value))}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-400">
            {DIFFICULTY_OPTIONS.map(d => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2 flex items-end">
          <button onClick={handleGenerate} disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-xl transition disabled:opacity-50">
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {loading ? '생성 중...' : '생성'}
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="bg-purple-50 rounded-xl p-4 text-center">
          <Loader2 size={24} className="animate-spin mx-auto text-purple-500 mb-2" />
          <p className="text-sm font-semibold text-purple-700">스크립트 생성 → TTS 변환 → 문제 생성 중...</p>
          <p className="text-xs text-purple-500 mt-1">약 20~40초 소요됩니다</p>
        </div>
      )}

      {/* Result */}
      {result && !loading && (
        <div className="space-y-4 mt-2">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-gray-900">✅ 생성 완료: {result.title}</h4>
            <div className="flex gap-2">
              {result.audioUrl && (
                <a href={result.audioUrl} className="flex items-center gap-1.5 text-xs bg-amber-100 hover:bg-amber-200 text-amber-700 font-bold px-3 py-1.5 rounded-lg transition" download>
                  <Music size={12} /> 오디오 다운로드
                </a>
              )}
              <button onClick={handleSaveQuestions} disabled={saving || saved}
                className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition ${saved ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-600 hover:bg-blue-700 text-white'} disabled:opacity-50`}>
                {saved ? <><Check size={12} /> 문제은행 저장 완료</> : saving ? <><Loader2 size={12} className="animate-spin" /> 저장 중...</> : <><BookmarkPlus size={12} /> 문제은행에 저장</>}
              </button>
            </div>
          </div>

          {/* Audio player */}
          {result.audioUrl && (
            <div className="bg-amber-50 rounded-xl p-3 flex items-center gap-3">
              <Music size={18} className="text-amber-500 flex-shrink-0" />
              <audio src={result.audioUrl} controls className="flex-1 h-8" />
            </div>
          )}
          {!result.audioUrl && (
            <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-400 text-center">
              Google TTS API 키가 없어 오디오는 생성되지 않았습니다. 스크립트는 저장됐어요.
            </div>
          )}

          {/* Script toggle */}
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <button onClick={() => setShowScript(!showScript)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition">
              <span>📄 스크립트 보기</span>
              <ChevronDown size={14} className={`transition-transform ${showScript ? 'rotate-180' : ''}`} />
            </button>
            {showScript && (
              <div className="px-4 pb-4">
                <pre className="text-xs text-gray-600 font-mono whitespace-pre-wrap bg-gray-50 rounded-lg p-3">{result.script}</pre>
              </div>
            )}
          </div>

          {/* Questions preview */}
          {result.questions.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">생성된 문제 ({result.questions.length}개)</p>
              {result.questions.map((q, i) => (
                <div key={i} className="border border-gray-100 rounded-xl p-4">
                  <p className="text-sm font-semibold text-gray-800 mb-2">Q{i + 1}. {q.content}</p>
                  {q.options && (
                    <div className="grid grid-cols-2 gap-1.5 mb-2">
                      {q.options.map(opt => (
                        <div key={opt.num} className={`text-xs px-2.5 py-1.5 rounded-lg border ${String(opt.num) === q.answer ? 'border-emerald-300 bg-emerald-50 text-emerald-700 font-bold' : 'border-gray-100 text-gray-600'}`}>
                          {opt.num}. {opt.text}
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-1.5">💡 {q.explanation}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AIConverter() {
  return (
    <div className="space-y-5">
      <TextConverter />
      <AudioGenerator />
    </div>
  )
}
