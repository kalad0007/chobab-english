'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Search, UserMinus, MoveRight, CheckSquare, Square, X, ChevronDown } from 'lucide-react'
import FeatureLevelSelect from '../FeatureLevelSelect'
import { bulkRemoveStudents, moveStudentsToClass } from './actions'

interface Student {
  id: string
  name: string
  email: string
  joinedAt: string
  featureLevel: number
  submissionCount: number
  latestScore: number | null
  latestDate: string | null
}

interface Props {
  cls: { id: string; name: string; invite_code: string }
  students: Student[]
  otherClasses: { id: string; name: string }[]
}

type SortKey = 'name' | 'joinedAt' | 'submissionCount' | 'latestScore'

function scoreColor(s: number | null) {
  if (s === null) return 'text-gray-300'
  if (s >= 80) return 'text-emerald-600'
  if (s >= 60) return 'text-amber-500'
  return 'text-red-500'
}

export default function ClassDetailClient({ cls, students: initialStudents, otherClasses }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('name')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showMoveMenu, setShowMoveMenu] = useState(false)
  const [students] = useState(initialStudents)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = q ? students.filter(s => s.name.toLowerCase().includes(q)) : [...students]
    list.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name, 'ko')
      if (sort === 'joinedAt') return new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime()
      if (sort === 'submissionCount') return b.submissionCount - a.submissionCount
      if (sort === 'latestScore') return (b.latestScore ?? -1) - (a.latestScore ?? -1)
      return 0
    })
    return list
  }, [students, search, sort])

  function toggleAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map(s => s.id)))
    }
  }

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleBulkRemove() {
    if (!confirm(`선택한 ${selected.size}명을 "${cls.name}"에서 제외하시겠습니까?`)) return
    startTransition(async () => {
      await bulkRemoveStudents(cls.id, Array.from(selected))
      setSelected(new Set())
      router.refresh()
    })
  }

  function handleMove(targetClassId: string, targetClassName: string) {
    if (!confirm(`선택한 ${selected.size}명을 "${targetClassName}"으로 이동하시겠습니까?`)) return
    setShowMoveMenu(false)
    startTransition(async () => {
      await moveStudentsToClass(cls.id, targetClassId, Array.from(selected))
      setSelected(new Set())
      router.refresh()
    })
  }

  const allSelected = filtered.length > 0 && selected.size === filtered.length

  return (
    <div className="p-3 md:p-7">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-500">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg md:text-2xl font-extrabold text-gray-900 truncate">{cls.name}</h1>
          <p className="text-xs text-gray-400">{students.length}명 등록</p>
        </div>
        <div className="flex items-center gap-1 bg-gray-50 rounded-lg px-2 py-1 flex-shrink-0">
          <span className="text-[10px] text-gray-400">초대코드</span>
          <span className="font-mono font-bold text-blue-600 tracking-widest text-xs">{cls.invite_code}</span>
        </div>
      </div>

      {/* Search + Sort */}
      <div className="flex gap-2 mb-3">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="학생 이름 검색"
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:border-blue-400 transition bg-white"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
              <X size={12} />
            </button>
          )}
        </div>
        <div className="flex gap-1">
          {([
            { key: 'name', label: '이름' },
            { key: 'submissionCount', label: '응시순' },
            { key: 'latestScore', label: '성적순' },
            { key: 'joinedAt', label: '가입일' },
          ] as { key: SortKey; label: string }[]).map(opt => (
            <button
              key={opt.key}
              onClick={() => setSort(opt.key)}
              className={`px-2.5 py-2 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
                sort === opt.key ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:border-blue-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {students.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <p className="text-sm text-gray-400">아직 학생이 없어요 · 초대코드를 공유하세요</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-2 px-3 md:px-5 py-2.5 bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-wide">
            <button onClick={toggleAll} className="flex items-center">
              {allSelected
                ? <CheckSquare size={15} className="text-blue-600" />
                : <Square size={15} className="text-gray-300" />
              }
            </button>
            <span>학생 정보</span>
            <span className="text-center w-16">응시</span>
            <span className="text-center w-16">최근성적</span>
            <span className="w-7" />
          </div>

          <div className="divide-y divide-gray-50">
            {filtered.map(s => (
              <StudentRow
                key={s.id}
                s={s}
                classId={cls.id}
                isSelected={selected.has(s.id)}
                onToggle={() => toggleOne(s.id)}
                isPending={isPending}
              />
            ))}
          </div>
        </div>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-gray-900 text-white px-4 py-3 rounded-2xl shadow-2xl">
          <span className="text-sm font-bold mr-1 whitespace-nowrap">{selected.size}명 선택</span>
          <button
            onClick={handleBulkRemove}
            disabled={isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 rounded-xl text-xs font-bold transition disabled:opacity-50 whitespace-nowrap"
          >
            <UserMinus size={13} /> 퇴원
          </button>
          {otherClasses.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowMoveMenu(v => !v)}
                disabled={isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 rounded-xl text-xs font-bold transition disabled:opacity-50 whitespace-nowrap"
              >
                <MoveRight size={13} /> 반 이동 <ChevronDown size={11} />
              </button>
              {showMoveMenu && (
                <div className="absolute bottom-full mb-2 left-0 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden min-w-[140px]">
                  {otherClasses.map(c => (
                    <button
                      key={c.id}
                      onClick={() => handleMove(c.id, c.name)}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 font-semibold transition"
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button onClick={() => setSelected(new Set())} className="ml-1 p-1 rounded-lg hover:bg-white/20 transition">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

function StudentRow({ s, classId, isSelected, onToggle, isPending }: {
  s: Student
  classId: string
  isSelected: boolean
  onToggle: () => void
  isPending: boolean
}) {
  const [rowPending, startRowTransition] = useTransition()
  const router = useRouter()

  function handleRemove() {
    if (!confirm(`"${s.name}" 학생을 이 반에서 제외하시겠습니까?`)) return
    startRowTransition(async () => {
      await bulkRemoveStudents(classId, [s.id])
      router.refresh()
    })
  }

  const pending = isPending || rowPending

  return (
    <div className={`grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-2 px-3 md:px-5 py-2.5 hover:bg-gray-50 transition ${pending ? 'opacity-50' : ''} ${isSelected ? 'bg-blue-50' : ''}`}>
      <button onClick={onToggle} className="flex items-center">
        {isSelected
          ? <CheckSquare size={15} className="text-blue-600" />
          : <Square size={15} className="text-gray-300" />
        }
      </button>

      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold text-gray-900 truncate">{s.name}</p>
          <FeatureLevelSelect classId={classId} studentId={s.id} current={s.featureLevel} />
        </div>
        <p className="text-[10px] text-gray-400 mt-0.5">
          {s.latestDate
            ? `최근 응시 ${new Date(s.latestDate).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}`
            : `가입 ${new Date(s.joinedAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}`
          }
        </p>
      </div>

      <div className="w-16 text-center">
        <span className="text-sm font-bold text-gray-800">{s.submissionCount}</span>
        <span className="text-xs text-gray-400 ml-0.5">회</span>
      </div>

      <div className="w-16 flex justify-center">
        {s.latestScore !== null ? (
          <span className={`text-sm font-bold ${scoreColor(s.latestScore)}`}>
            {Math.round(s.latestScore)}%
          </span>
        ) : (
          <span className="text-xs text-gray-300">—</span>
        )}
      </div>

      <button
        onClick={handleRemove}
        disabled={pending}
        className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition disabled:opacity-50"
      >
        <UserMinus size={14} />
      </button>
    </div>
  )
}
