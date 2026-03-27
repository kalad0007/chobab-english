'use client'

import { useState } from 'react'
import { BookOpen, X, ChevronRight } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Content {
  id: string
  title: string
  category: string | null
  class_id: string | null
  content: string
  created_at: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  classes: any
}

interface Props {
  contents: Content[]
}

const CATEGORY_COLORS: Record<string, string> = {
  '문법':  'bg-blue-100 text-blue-700',
  '독해':  'bg-purple-100 text-purple-700',
  '어휘':  'bg-emerald-100 text-emerald-700',
  '듣기':  'bg-amber-100 text-amber-700',
  '쓰기':  'bg-rose-100 text-rose-700',
  '회화':  'bg-cyan-100 text-cyan-700',
  '기타':  'bg-gray-100 text-gray-600',
}

export default function LearnClient({ contents }: Props) {
  const [selected, setSelected] = useState<string>('전체')
  const [opened, setOpened] = useState<Content | null>(null)

  // 카테고리 목록
  const categories = ['전체', ...Array.from(new Set(contents.map(c => c.category ?? '기타')))]

  const filtered = selected === '전체'
    ? contents
    : contents.filter(c => (c.category ?? '기타') === selected)

  return (
    <div className="p-7">
      <div className="mb-7">
        <h1 className="text-2xl font-extrabold text-gray-900">📖 학습 자료</h1>
        <p className="text-gray-500 text-sm mt-1">선생님이 공유한 자료를 확인하세요</p>
      </div>

      {/* 카테고리 탭 */}
      <div className="flex flex-wrap gap-2 mb-6">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelected(cat)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
              selected === cat
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 자료 목록 */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center shadow-sm">
          <BookOpen size={48} className="mx-auto text-gray-200 mb-4" />
          <p className="font-semibold text-gray-500">아직 공개된 자료가 없어요</p>
          <p className="text-sm text-gray-400 mt-1">선생님이 자료를 공유하면 여기에 표시됩니다</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filtered.map(c => {
            const catColor = CATEGORY_COLORS[c.category ?? '기타'] ?? 'bg-gray-100 text-gray-600'
            const className = c.classes?.name as string | undefined
            const preview = c.content.replace(/[#*`_>]/g, '').trim().slice(0, 100)

            return (
              <button
                key={c.id}
                onClick={() => setOpened(c)}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-left hover:shadow-md hover:border-blue-200 transition group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <BookOpen size={20} className="text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-bold text-gray-900 text-sm group-hover:text-blue-600 transition">{c.title}</h3>
                      {c.category && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${catColor}`}>
                          {c.category}
                        </span>
                      )}
                      {className && (
                        <span className="text-xs bg-gray-100 text-gray-500 font-semibold px-2 py-0.5 rounded-full">
                          {className}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 line-clamp-2">{preview}...</p>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 group-hover:text-blue-400 flex-shrink-0 mt-1 transition" />
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* 자료 열람 모달 */}
      {opened && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-start justify-between p-5 border-b border-gray-100">
              <div>
                <h2 className="font-extrabold text-gray-900 text-lg">{opened.title}</h2>
                <div className="flex gap-2 mt-1.5">
                  {opened.category && (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[opened.category] ?? 'bg-gray-100 text-gray-600'}`}>
                      {opened.category}
                    </span>
                  )}
                  {opened.classes?.name && (
                    <span className="text-xs bg-gray-100 text-gray-500 font-semibold px-2 py-0.5 rounded-full">
                      {opened.classes.name}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setOpened(null)}
                className="text-gray-400 hover:text-gray-600 p-1 flex-shrink-0"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto prose prose-sm max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{opened.content}</ReactMarkdown>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
