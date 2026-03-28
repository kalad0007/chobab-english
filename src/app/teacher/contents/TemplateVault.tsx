'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Plus, BookOpen, Headphones, Mic, PenTool, ChevronDown, Loader2, Trash2, Pencil, FileQuestion } from 'lucide-react'
import { fetchQuestionsBySubtype, deleteQuestion } from './actions'

interface TemplateVaultProps {
  questionCounts: Record<string, number>
}

const TEMPLATES = [
  // Reading
  { category: 'reading', subtype: 'complete_the_words',    label: 'Complete the Words',     ko: '단락형 빈칸채우기',   desc: '지문 속 단어 뒷부분 마스킹',         badge: 'bg-teal-100 text-teal-700' },
  { category: 'reading', subtype: 'sentence_completion',   label: 'Sentence Completion',    ko: '독립 문장 빈칸',      desc: '짧은 문장 1개 빈칸 채우기',          badge: 'bg-blue-100 text-blue-700' },
  { category: 'reading', subtype: 'daily_life_email',      label: 'Daily Life — Email',     ko: '이메일 독해',         desc: '이메일 형식 실용문 + 독해 문제',     badge: 'bg-cyan-100 text-cyan-700' },
  { category: 'reading', subtype: 'daily_life_text_chain', label: 'Daily Life — Text Chain',ko: '문자 체인 독해',      desc: '그룹 채팅 형식(3-4명) + 독해',       badge: 'bg-sky-100 text-sky-700' },
  { category: 'reading', subtype: 'academic_passage',      label: 'Academic Passage',       ko: '학술 독해',           desc: '200-300단어 학술 지문 + 문제 세트',  badge: 'bg-indigo-100 text-indigo-700' },
  // Listening
  { category: 'listening', subtype: 'choose_response',     label: 'Choose a Response',      ko: '응답 선택',           desc: '짧은 한마디 듣고 적절한 대답 선택', badge: 'bg-emerald-100 text-emerald-700' },
  { category: 'listening', subtype: 'conversation',        label: 'Conversation',           ko: '캠퍼스 대화',         desc: '두 사람 일상 대화 + 문제 세트',     badge: 'bg-green-100 text-green-700' },
  { category: 'listening', subtype: 'academic_talk',       label: 'Academic Talk',          ko: '학술 강의',           desc: '교수/강연자 학술 강의 + 문제 세트', badge: 'bg-lime-100 text-lime-700' },
  { category: 'listening', subtype: 'campus_announcement', label: 'Campus Announcement',    ko: '캠퍼스 공지',         desc: '캠퍼스 공지 리스닝 + 문제 세트',    badge: 'bg-teal-100 text-teal-700' },
  // Writing
  { category: 'writing', subtype: 'sentence_reordering',   label: 'Build a Sentence',       ko: '문장 배열',           desc: '단어 칩 배열로 올바른 문장 완성',   badge: 'bg-purple-100 text-purple-700' },
  { category: 'writing', subtype: 'email_writing',         label: 'Write an Email',         ko: '이메일 쓰기',         desc: '상황 + 조건 3가지 → 이메일 작성',  badge: 'bg-violet-100 text-violet-700' },
  { category: 'writing', subtype: 'academic_discussion',   label: 'Academic Discussion',    ko: '학술 토론 쓰기',      desc: '교수 질문 + 학생 의견 → 토론 참여', badge: 'bg-rose-100 text-rose-700' },
  // Speaking
  { category: 'speaking', subtype: 'listen_and_repeat',    label: 'Listen and Repeat',      ko: '따라 말하기',         desc: '원어민 문장 듣고 그대로 따라 말하기', badge: 'bg-orange-100 text-orange-700' },
  { category: 'speaking', subtype: 'take_an_interview',    label: 'Take an Interview',      ko: '인터뷰',              desc: '면접관 질문에 논리적으로 답변하기',  badge: 'bg-amber-100 text-amber-700' },
]

const CAT_META: Record<string, { icon: typeof BookOpen; color: string; label: string }> = {
  reading:   { icon: BookOpen,   color: 'text-blue-600 bg-blue-50',    label: 'Reading' },
  listening: { icon: Headphones, color: 'text-amber-600 bg-amber-50',  label: 'Listening' },
  writing:   { icon: PenTool,    color: 'text-purple-600 bg-purple-50', label: 'Writing' },
  speaking:  { icon: Mic,        color: 'text-rose-600 bg-rose-50',    label: 'Speaking' },
}

const SOURCE_BADGE: Record<string, string> = {
  teacher:        'bg-blue-100 text-blue-600',
  ai_generated:   'bg-purple-100 text-purple-600',
  toefl_official: 'bg-yellow-100 text-yellow-700',
}
const SOURCE_LABEL: Record<string, string> = {
  teacher:        '직접 작성',
  ai_generated:   'AI 생성',
  toefl_official: 'TOEFL 기출',
}

type QRow = { id: string; content: string; difficulty: number; source: string; created_at: string; type: string }

function SubtypeAccordion({
  tmpl,
  initialCount,
}: {
  tmpl: typeof TEMPLATES[number]
  initialCount: number
}) {
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [questions, setQuestions] = useState<QRow[]>([])
  const [count, setCount] = useState(initialCount)
  const [isPending, startTransition] = useTransition()

  function toggle() {
    if (!open && !loaded) {
      startTransition(async () => {
        const res = await fetchQuestionsBySubtype(tmpl.subtype)
        if (res.questions) {
          setQuestions(res.questions)
          setCount(res.questions.length)
          setLoaded(true)
        }
        setOpen(true)
      })
    } else {
      setOpen(o => !o)
    }
  }

  function handleDelete(id: string) {
    if (!confirm('이 문제를 삭제하시겠습니까?')) return
    startTransition(async () => {
      const res = await deleteQuestion(id)
      if (res.error) { alert('삭제 실패: ' + res.error); return }
      setQuestions(prev => prev.filter(q => q.id !== id))
      setCount(c => c - 1)
    })
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header row */}
      <button
        onClick={toggle}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tmpl.badge}`}>{tmpl.ko}</span>
            <span className="text-sm font-bold text-gray-900">{tmpl.label}</span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5 truncate">{tmpl.desc}</p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${count > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>
            {count}개
          </span>
          <Link
            href={`/teacher/questions/new?subtype=${tmpl.subtype}`}
            onClick={e => e.stopPropagation()}
            className="flex items-center gap-1 text-[11px] font-bold bg-blue-100 hover:bg-blue-200 text-blue-700 px-2.5 py-1.5 rounded-lg transition"
          >
            <Plus size={11} /> 직접 작성
          </Link>
          {isPending
            ? <Loader2 size={16} className="animate-spin text-gray-400 flex-shrink-0" />
            : <ChevronDown size={16} className={`text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
          }
        </div>
      </button>

      {/* Expanded question list */}
      {open && loaded && (
        <div className="border-t border-gray-100">
          {questions.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <FileQuestion size={28} className="mx-auto text-gray-200 mb-2" />
              <p className="text-sm text-gray-400 font-medium">아직 문제가 없어요</p>
              <p className="text-xs text-gray-300 mt-0.5">직접 작성하거나 AI로 생성해보세요</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {questions.map((q) => (
                <li key={q.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition group">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 line-clamp-2 leading-snug">{q.content}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${SOURCE_BADGE[q.source] ?? 'bg-gray-100 text-gray-500'}`}>
                        {SOURCE_LABEL[q.source] ?? q.source}
                      </span>
                      <span className="text-[10px] text-gray-400">Band {q.difficulty.toFixed(1)}</span>
                      <span className="text-[10px] text-gray-300">
                        {new Date(q.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition">
                    <Link
                      href={`/teacher/questions/${q.id}/edit`}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition"
                      title="편집"
                    >
                      <Pencil size={13} />
                    </Link>
                    <button
                      onClick={() => handleDelete(q.id)}
                      disabled={isPending}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition disabled:opacity-40"
                      title="삭제"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export default function TemplateVault({ questionCounts }: TemplateVaultProps) {
  const categories = ['reading', 'listening', 'writing', 'speaking'] as const

  return (
    <div className="space-y-7">
      {categories.map(cat => {
        const meta = CAT_META[cat]
        const Icon = meta.icon
        const items = TEMPLATES.filter(t => t.category === cat)
        const catTotal = items.reduce((sum, t) => sum + (questionCounts[t.subtype] ?? 0), 0)

        return (
          <div key={cat}>
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${meta.color}`}>
                <Icon size={15} />
              </div>
              <h3 className="font-bold text-gray-900">{meta.label}</h3>
              <span className="text-xs text-gray-400">{items.length}개 유형</span>
              {catTotal > 0 && (
                <span className="text-xs text-gray-400 ml-1">· 총 {catTotal}개 문제</span>
              )}
            </div>

            <div className="space-y-2">
              {items.map(tmpl => (
                <SubtypeAccordion
                  key={tmpl.subtype}
                  tmpl={tmpl}
                  initialCount={questionCounts[tmpl.subtype] ?? 0}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
