'use client'

import { useState } from 'react'
import { X, BookOpen, Headphones, PenLine, Mic } from 'lucide-react'

const SUBTYPE_LABEL: Record<string, string> = {
  complete_the_words:  'Complete the Words',
  sentence_completion: 'Sentence Completion',
  daily_life:          'Daily Life',
  academic_passage:    'Academic Passage',
  choose_response:     'Choose a Response',
  conversation:        'Conversation',
  campus_announcement: 'Campus Announcement',
  academic_talk:       'Academic Talk',
  sentence_reordering: 'Build a Sentence',
  email_writing:       'Write an Email',
  academic_discussion: 'Academic Discussion',
  listen_and_repeat:   'Listen & Repeat',
  take_an_interview:   'Interview',
}

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  reading:   <BookOpen size={13} />,
  listening: <Headphones size={13} />,
  writing:   <PenLine size={13} />,
  speaking:  <Mic size={13} />,
}
const CATEGORY_COLOR: Record<string, string> = {
  reading:   'bg-blue-100 text-blue-700',
  listening: 'bg-emerald-100 text-emerald-700',
  writing:   'bg-purple-100 text-purple-700',
  speaking:  'bg-orange-100 text-orange-700',
}

export interface PreviewQuestion {
  id: string
  content: string
  summary?: string | null
  passage?: string | null
  options?: string[] | null
  answer?: string | null
  explanation?: string | null
  audio_script?: string | null
  audio_url?: string | null
  category: string
  question_subtype?: string | null
  difficulty?: number | null
  diffLabel?: string
  diffColor?: string
}

interface Props {
  idx: number
  q: PreviewQuestion
}

export function ClickableQRow({ idx, q }: Props) {
  const [open, setOpen] = useState(false)
  const label = SUBTYPE_LABEL[q.question_subtype ?? ''] ?? q.question_subtype ?? q.category
  const display = q.summary ?? q.content

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-start gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition text-left"
      >
        <span className="text-[11px] font-bold text-gray-300 flex-shrink-0 w-5 text-right mt-0.5">{idx}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-700 line-clamp-1">{display}</p>
          <span className="text-[11px] text-indigo-400 mt-0.5 block">{label}</span>
        </div>
        {q.diffLabel && (
          <span className={`text-[10px] font-bold flex-shrink-0 px-1.5 py-0.5 rounded-full ${q.diffColor ?? ''}`}>
            {q.diffLabel}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          {/* 배경 */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

          {/* 패널 */}
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${CATEGORY_COLOR[q.category] ?? 'bg-gray-100 text-gray-600'}`}>
                  {CATEGORY_ICON[q.category]}
                  {q.category}
                </span>
                <span className="text-xs font-semibold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">
                  {SUBTYPE_LABEL[q.question_subtype ?? ''] ?? q.question_subtype}
                </span>
                {q.diffLabel && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${q.diffColor ?? ''}`}>
                    Band {q.diffLabel}
                  </span>
                )}
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition flex-shrink-0"
              >
                <X size={14} />
              </button>
            </div>

            {/* 음성 플레이어 (리스닝/스피킹) */}
            {q.audio_url && (q.category === 'listening' || q.category === 'speaking') && (
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
                <audio controls src={q.audio_url} className="w-full h-9" />
              </div>
            )}

            <div className="px-5 py-4 space-y-4">
              {/* 지문 — email_writing은 passage가 한글 번역이므로 숨김 */}
              {q.passage && q.question_subtype !== 'email_writing' && (
                <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {q.passage}
                </div>
              )}

              {/* 문제 본문 — email_writing은 한국어/번역 단락 제거 */}
              <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap font-medium">
                {q.question_subtype === 'email_writing'
                  ? (q.content ?? '')
                      .split(/\n{2,}/)
                      .filter(para => {
                        const first = para.trim()[0] ?? ''
                        // 【 (전각 괄호) 또는 한글 시작 단락 제거
                        return !/^[\uAC00-\uD7A3\u3131-\uD79D【]/.test(first)
                      })
                      .join('\n\n')
                      .trim()
                  : q.content}
              </div>

              {/* 음성 스크립트 (스피킹 / 리스닝) */}
              {q.audio_script && (
                <div className={`rounded-xl px-4 py-3 border ${
                  q.category === 'speaking'
                    ? 'bg-orange-50 border-orange-200'
                    : 'bg-sky-50 border-sky-200'
                }`}>
                  <span className={`text-xs font-bold block mb-1.5 ${
                    q.category === 'speaking' ? 'text-orange-600' : 'text-sky-600'
                  }`}>음성 스크립트</span>
                  <p className={`text-sm leading-relaxed whitespace-pre-wrap ${
                    q.category === 'speaking' ? 'text-orange-900' : 'text-sky-900'
                  }`}>{q.audio_script}</p>
                </div>
              )}

              {/* 보기 */}
              {q.options && q.options.length > 0 && (
                <div className="space-y-2">
                  {q.options.map((opt, i) => {
                    // options may be stored as {num, text} objects or plain strings
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const optText: string = typeof opt === 'string' ? opt : (opt as any)?.text ?? String(opt)
                    const letter = String.fromCharCode(65 + i) // A, B, C, D
                    const isAnswer = q.answer === letter || q.answer === optText || q.answer === String(i + 1)
                    return (
                      <div
                        key={i}
                        className={`flex items-start gap-3 rounded-xl px-4 py-2.5 text-sm ${
                          isAnswer
                            ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                            : 'bg-gray-50 border border-gray-100 text-gray-700'
                        }`}
                      >
                        <span className={`font-bold flex-shrink-0 ${isAnswer ? 'text-emerald-600' : 'text-gray-400'}`}>
                          {letter}
                        </span>
                        <span>{optText}</span>
                        {isAnswer && <span className="ml-auto text-emerald-500 text-xs font-bold flex-shrink-0">정답</span>}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* 정답 (보기 없는 경우, email_writing 제외) */}
              {q.answer && (!q.options || q.options.length === 0) && q.question_subtype !== 'email_writing' && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm">
                  <span className="text-xs font-bold text-emerald-600 block mb-1">정답</span>
                  <span className="text-emerald-800 font-medium">{q.answer}</span>
                </div>
              )}

              {/* 모범 답안 (email_writing) — explanation 우선, fallback to answer */}
              {q.question_subtype === 'email_writing' && (q.explanation || q.answer) && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 text-sm">
                  <span className="text-xs font-bold text-purple-600 block mb-2">모범 답안</span>
                  <p className="text-purple-900 leading-relaxed whitespace-pre-wrap">
                    {((q.explanation || q.answer) ?? '')
                      .split(/\n{2,}/)
                      .filter(para => {
                        const first = para.trim()[0] ?? ''
                        return !/^[\uAC00-\uD7A3\u3131-\uD79D【]/.test(first)
                      })
                      .join('\n\n')
                      .trim()}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
