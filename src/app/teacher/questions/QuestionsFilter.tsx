'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ACTIVE_SUBTYPES } from '@/lib/utils'

const CATEGORIES = [
  { value: 'reading',   label: 'Reading',   short: 'R', icon: '📖', active: 'bg-blue-600 text-white border-blue-600',     inactive: 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50',     subActive: 'bg-blue-600 text-white' },
  { value: 'listening', label: 'Listening', short: 'L', icon: '🎧', active: 'bg-emerald-600 text-white border-emerald-600', inactive: 'bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50', subActive: 'bg-emerald-600 text-white' },
  { value: 'writing',   label: 'Writing',   short: 'W', icon: '✍️', active: 'bg-purple-600 text-white border-purple-600',  inactive: 'bg-white text-purple-600 border-purple-200 hover:bg-purple-50',  subActive: 'bg-purple-600 text-white' },
  { value: 'speaking',  label: 'Speaking',  short: 'S', icon: '🎤', active: 'bg-orange-600 text-white border-orange-600',  inactive: 'bg-white text-orange-600 border-orange-200 hover:bg-orange-50',  subActive: 'bg-orange-600 text-white' },
]

const SUBTYPES = ACTIVE_SUBTYPES

interface Props {
  currentCategory?: string
  currentSubtype?: string
  currentSource?: string
  currentQ?: string
}

export default function QuestionsFilter({ currentCategory, currentSubtype, currentSource, currentQ }: Props) {
  const router = useRouter()
  // 열려있는 카테고리: URL의 currentCategory로 초기화, 클릭 시 변경 (페이지 이동 없음)
  const [openCategory, setOpenCategory] = useState<string | null>(currentCategory ?? null)

  function buildUrl(cat?: string, sub?: string) {
    const params = new URLSearchParams()
    if (cat)           params.set('category', cat)
    if (sub)           params.set('subtype', sub)
    if (currentSource) params.set('source', currentSource)
    if (currentQ)      params.set('q', currentQ)
    const qs = params.toString()
    return `/teacher/questions${qs ? `?${qs}` : ''}`
  }

  const subtypes = openCategory ? (SUBTYPES[openCategory] ?? []) : []
  const activeCat = CATEGORIES.find(c => c.value === openCategory)

  return (
    <div className="space-y-2">
      {/* 카테고리 블록 row */}
      <div className="flex gap-1.5 items-center">
        <button
          type="button"
          onClick={() => { setOpenCategory(null); router.push(buildUrl()) }}
          className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border-2 transition ${!openCategory ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
        >
          전체
        </button>
        {CATEGORIES.map(cat => (
          <button
            key={cat.value}
            type="button"
            onClick={() => setOpenCategory(prev => prev === cat.value ? null : cat.value)}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border-2 transition ${openCategory === cat.value ? cat.active : cat.inactive}`}
          >
            <span className="md:hidden">{cat.short}</span>
            <span className="hidden md:inline">{cat.icon} {cat.label}</span>
          </button>
        ))}
      </div>

      {/* 서브타입 — CSS max-height 트랜지션으로 스르륵 */}
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: subtypes.length > 0 ? '100px' : '0px', opacity: subtypes.length > 0 ? 1 : 0 }}
      >
        <div className="flex flex-wrap gap-1 pt-1">
          <Link
            href={buildUrl(openCategory ?? undefined)}
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition ${!currentSubtype && currentCategory === openCategory ? `${activeCat?.subActive ?? 'bg-blue-600 text-white'}` : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            전체
          </Link>
          {subtypes.map(opt => (
            <Link
              key={opt.value}
              href={buildUrl(openCategory ?? undefined, opt.value)}
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition ${currentSubtype === opt.value && currentCategory === openCategory ? `${activeCat?.subActive ?? 'bg-blue-600 text-white'}` : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {opt.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
