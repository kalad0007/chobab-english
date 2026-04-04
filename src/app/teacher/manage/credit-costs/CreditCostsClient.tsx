'use client'

import { useState } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { updateCreditCosts } from './actions'

type CostItem = {
  id: string
  label: string
  category: string
  cost: number
}

type Props = {
  items: CostItem[]
}

/** 영문 라벨 매핑 */
const LABEL_EN: Record<string, string> = {
  complete_the_words: 'Complete the Words',
  sentence_completion: 'Sentence Completion',
  academic_passage: 'Academic Passage',
  daily_life_email: 'Email',
  daily_life_text_chain: 'Text Chain',
  daily_life_notice: 'Notice',
  daily_life_guide: 'Guide',
  daily_life_article: 'Article',
  daily_life_campus_notice: 'Campus Notice',
  choose_response: 'Choose a Response',
  conversation: 'Conversation',
  campus_announcement: 'Campus Announcement',
  academic_talk: 'Academic Talk',
  sentence_reordering: 'Build a Sentence',
  email_writing: 'Write an Email',
  academic_discussion: 'Academic Discussion',
  listen_and_repeat: 'Listen and Repeat',
  take_an_interview: 'Take an Interview',
  vocab_per_word: 'Vocab Generation (per word)',
  collocation_quiz: 'Collocation Quiz',
  passage_translation: 'Passage Translation',
  speaking_eval: 'Speaking Evaluation',
  tts: 'Text-to-Speech',
}

/** Reading은 왼쪽 전체, Listening/Writing/Speaking은 오른쪽에 세로 배치 */
const READING = {
  skill: 'Reading',
  bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700',
  ids: [
    'complete_the_words', 'sentence_completion', 'academic_passage',
    'daily_life_email', 'daily_life_text_chain', 'daily_life_notice',
    'daily_life_guide', 'daily_life_article', 'daily_life_campus_notice',
  ],
}

const RIGHT_SECTIONS = [
  {
    skill: 'Listening',
    bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700',
    ids: ['choose_response', 'conversation', 'campus_announcement', 'academic_talk'],
  },
  {
    skill: 'Writing',
    bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-700',
    ids: ['sentence_reordering', 'email_writing', 'academic_discussion'],
  },
  {
    skill: 'Speaking',
    bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-700',
    ids: ['listen_and_repeat', 'take_an_interview'],
  },
]

/** 기타 카테고리 — 2열 그리드 */
const OTHER_SECTIONS = [
  {
    title: '어휘',
    bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700', badge: 'bg-teal-100 text-teal-700',
    ids: ['vocab_per_word', 'collocation_quiz'],
  },
  {
    title: '지문 / 평가',
    bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700', badge: 'bg-slate-100 text-slate-700',
    ids: ['passage_translation', 'speaking_eval', 'tts'],
  },
]

export default function CreditCostsClient({ items }: Props) {
  const itemMap = Object.fromEntries(items.map(item => [item.id, item]))
  const [values, setValues] = useState<Record<string, number>>(
    Object.fromEntries(items.map(item => [item.id, item.cost]))
  )
  const [original] = useState<Record<string, number>>(
    Object.fromEntries(items.map(item => [item.id, item.cost]))
  )
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const changedItems = items.filter(item => values[item.id] !== original[item.id])

  async function handleSave() {
    if (changedItems.length === 0) {
      setMessage({ type: 'error', text: '변경된 항목이 없습니다.' })
      return
    }
    setSaving(true)
    setMessage(null)
    try {
      await updateCreditCosts(
        changedItems.map(item => ({ id: item.id, cost: values[item.id] }))
      )
      setMessage({ type: 'success', text: `${changedItems.length}개 항목이 저장되었습니다.` })
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : '저장 중 오류가 발생했습니다.' })
    } finally {
      setSaving(false)
    }
  }

  function CreditInput({ id }: { id: string }) {
    const changed = values[id] !== original[id]
    return (
      <div className="flex items-center gap-1">
        {changed && (
          <span className="text-[10px] text-amber-600 bg-amber-50 px-1 py-0.5 rounded-full font-medium whitespace-nowrap">
            {original[id]}
          </span>
        )}
        <input
          type="number"
          min={0}
          max={9999}
          value={values[id]}
          onChange={e => setValues(prev => ({ ...prev, [id]: Math.max(0, Number(e.target.value)) }))}
          className="w-12 px-1 py-0.5 border border-gray-300 bg-gray-50 rounded-l text-xs text-center font-mono text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:z-10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <div className="flex flex-col border border-l-0 border-gray-300 rounded-r overflow-hidden -ml-1">
          <button
            type="button"
            onClick={() => setValues(prev => ({ ...prev, [id]: Math.min(9999, (prev[id] ?? 0) + 1) }))}
            className="px-0.5 py-px bg-gray-100 hover:bg-blue-100 hover:text-blue-600 text-gray-500 transition-colors border-b border-gray-300"
          >
            <ChevronUp size={10} />
          </button>
          <button
            type="button"
            onClick={() => setValues(prev => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) - 1) }))}
            className="px-0.5 py-px bg-gray-100 hover:bg-blue-100 hover:text-blue-600 text-gray-500 transition-colors"
          >
            <ChevronDown size={10} />
          </button>
        </div>
      </div>
    )
  }

  function SkillBox({ skill, bg, border, text, badge, ids }: {
    skill: string; bg: string; border: string; text: string; badge: string; ids: string[]
  }) {
    return (
      <div className={`rounded-xl border ${border} ${bg} p-2.5`}>
        <h3 className={`text-xs font-bold ${text} mb-1.5`}>{skill}</h3>
        <div className="space-y-0.5">
          {ids.map(id => {
            const item = itemMap[id]
            if (!item) return null
            return (
              <div key={id} className="flex items-center justify-between gap-1.5 bg-white/70 rounded-md px-2 py-1">
                <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${badge} truncate`}>
                  {LABEL_EN[id] ?? item.label}
                </span>
                <CreditInput id={id} />
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* AI 문제 생성: Reading 왼쪽 | Listening+Writing+Speaking 오른쪽 */}
      <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide px-1">AI 문제 생성</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* 왼쪽: Reading */}
        <SkillBox {...READING} skill="Reading" />
        {/* 오른쪽: Listening / Writing / Speaking 세로 배치 */}
        <div className="space-y-3">
          {RIGHT_SECTIONS.map(section => (
            <SkillBox key={section.skill} {...section} />
          ))}
        </div>
      </div>

      {/* 어휘 / 지문·평가 — 2열 그리드 */}
      <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide px-1">기타 AI 기능</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {OTHER_SECTIONS.map(section => (
          <div key={section.title} className={`rounded-xl border ${section.border} ${section.bg} p-2.5`}>
            <h3 className={`text-xs font-bold ${section.text} mb-1.5`}>{section.title}</h3>
            <div className="space-y-0.5">
              {section.ids.map(id => {
                const item = itemMap[id]
                if (!item) return null
                return (
                  <div key={id} className="flex items-center justify-between gap-1.5 bg-white/70 rounded-md px-2 py-1">
                    <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${section.badge} truncate`}>
                      {LABEL_EN[id] ?? item.label}
                    </span>
                    <CreditInput id={id} />
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 하단 저장 영역 */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-3">
        <div>
          {message && (
            <p className={`text-sm font-medium ${message.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
              {message.text}
            </p>
          )}
          {changedItems.length > 0 && !message && (
            <p className="text-sm text-amber-600">
              {changedItems.length}개 항목이 변경되었습니다.
            </p>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={saving || changedItems.length === 0}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold transition-colors"
        >
          {saving ? '저장 중...' : '저장하기'}
        </button>
      </div>
    </div>
  )
}
