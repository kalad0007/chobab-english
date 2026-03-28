'use client'

import { useState, useTransition } from 'react'
import { Users, UserMinus } from 'lucide-react'
import { updateFeatureLevel } from '../classes/actions'
import { removeStudentFromClass } from './actions'

interface Props {
  members: any[] // eslint-disable-line @typescript-eslint/no-explicit-any
  classes: { id: string; name: string }[]
  submissionMap: Record<string, { count: number; avgScore: number | null }>
}

const CLASS_COLORS = [
  { bg: 'bg-blue-500',    light: 'bg-blue-50',    text: 'text-blue-700',    badge: 'bg-blue-100 text-blue-700' },
  { bg: 'bg-purple-500',  light: 'bg-purple-50',  text: 'text-purple-700',  badge: 'bg-purple-100 text-purple-700' },
  { bg: 'bg-emerald-500', light: 'bg-emerald-50', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' },
  { bg: 'bg-amber-500',   light: 'bg-amber-50',   text: 'text-amber-700',   badge: 'bg-amber-100 text-amber-700' },
  { bg: 'bg-rose-500',    light: 'bg-rose-50',    text: 'text-rose-700',    badge: 'bg-rose-100 text-rose-700' },
  { bg: 'bg-cyan-500',    light: 'bg-cyan-50',    text: 'text-cyan-700',    badge: 'bg-cyan-100 text-cyan-700' },
]

const LEVEL_STYLES: Record<number, string> = {
  1: 'border-gray-200 text-gray-500 bg-gray-50',
  2: 'border-blue-200 text-blue-700 bg-blue-50',
  3: 'border-purple-200 text-purple-700 bg-purple-50',
}

const LEVEL_OPTIONS = [
  { value: 1, label: '기초' },
  { value: 2, label: '중급' },
  { value: 3, label: '고급' },
]

function scoreColor(avg: number | null): string {
  if (avg === null) return 'bg-gray-100 text-gray-500'
  if (avg >= 80) return 'bg-emerald-100 text-emerald-700'
  if (avg >= 60) return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-700'
}

function StudentRow({ m, color, stats, classColorMap }: {
  m: any // eslint-disable-line @typescript-eslint/no-explicit-any
  color: (typeof CLASS_COLORS)[number]
  stats: { count: number; avgScore: number | null } | undefined
  classColorMap: Record<string, (typeof CLASS_COLORS)[number]>
}) {
  const [isPending, startTransition] = useTransition()

  const profile = m.profiles as any // eslint-disable-line @typescript-eslint/no-explicit-any
  const classInfo = m.classes as any // eslint-disable-line @typescript-eslint/no-explicit-any
  const name: string = profile?.name ?? '알 수 없음'
  const email: string = profile?.email ?? ''
  const className: string = classInfo?.name ?? ''
  const featureLevel: number = m.feature_level ?? 1

  function handleLevelChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const level = Number(e.target.value)
    startTransition(() => { updateFeatureLevel(m.class_id, m.student_id, level) })
  }

  function handleRemove() {
    if (!confirm(`"${name}" 학생을 "${className}" 반에서 제외하시겠습니까?`)) return
    startTransition(() => { removeStudentFromClass(m.class_id, m.student_id) })
  }

  return (
    <div
      className={`grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition ${isPending ? 'opacity-50' : ''}`}
    >
      {/* Avatar */}
      <div className={`w-9 h-9 rounded-full ${color.bg} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
        {name.charAt(0)}
      </div>

      {/* Name + email */}
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
        {email && <p className="text-xs text-gray-400 truncate mt-0.5">{email}</p>}
      </div>

      {/* Class badge */}
      <div className="w-24 flex justify-center">
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${color.badge}`}>
          {className}
        </span>
      </div>

      {/* Feature level select */}
      <div className="w-24 flex justify-center">
        <select
          value={featureLevel}
          onChange={handleLevelChange}
          disabled={isPending}
          className={`text-xs font-semibold border rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 transition ${LEVEL_STYLES[featureLevel] ?? LEVEL_STYLES[1]}`}
        >
          {LEVEL_OPTIONS.map(l => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>
      </div>

      {/* Attempt count */}
      <div className="w-16 text-center">
        <span className="text-sm font-bold text-gray-800">{stats?.count ?? 0}</span>
        <span className="text-xs text-gray-400 ml-1">회</span>
      </div>

      {/* Average score */}
      <div className="w-16 flex justify-center">
        {stats && stats.count > 0 && stats.avgScore !== null ? (
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${scoreColor(stats.avgScore)}`}>
            {stats.avgScore}%
          </span>
        ) : (
          <span className="text-xs text-gray-300 font-medium">—</span>
        )}
      </div>

      {/* Remove button */}
      <div className="w-8 flex justify-center">
        <button
          type="button"
          onClick={handleRemove}
          disabled={isPending}
          title="반에서 제외"
          className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition disabled:opacity-50"
        >
          <UserMinus size={15} />
        </button>
      </div>
    </div>
  )
}

export default function StudentsClient({ members, classes, submissionMap }: Props) {
  const [selectedClass, setSelectedClass] = useState<string>('all')

  const classColorMap: Record<string, (typeof CLASS_COLORS)[number]> = {}
  classes.forEach((cls, i) => {
    classColorMap[cls.id] = CLASS_COLORS[i % CLASS_COLORS.length]
  })

  const filtered = selectedClass === 'all'
    ? members
    : members.filter(m => m.class_id === selectedClass)

  return (
    <div>
      {/* Class filter tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setSelectedClass('all')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
            selectedClass === 'all'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600'
          }`}
        >
          전체 ({members.length}명)
        </button>
        {classes.map(cls => {
          const count = members.filter(m => m.class_id === cls.id).length
          const color = classColorMap[cls.id]
          const isActive = selectedClass === cls.id
          return (
            <button
              key={cls.id}
              onClick={() => setSelectedClass(cls.id)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                isActive
                  ? `${color.bg} text-white shadow-sm`
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {cls.name} ({count}명)
            </button>
          )
        })}
      </div>

      {/* Student list */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center shadow-sm">
          <Users size={48} className="mx-auto text-gray-200 mb-4" />
          <p className="font-semibold text-gray-500">등록된 학생이 없어요.</p>
          <p className="text-sm text-gray-400 mt-1">반을 만들고 초대코드를 공유하세요.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] items-center gap-3 px-5 py-3 bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-wide">
            <span className="w-9" />
            <span>학생 정보</span>
            <span className="w-24 text-center">반</span>
            <span className="w-24 text-center">등급</span>
            <span className="w-16 text-center">응시</span>
            <span className="w-16 text-center">평균</span>
            <span className="w-8" />
          </div>

          <div className="divide-y divide-gray-50">
            {filtered.map(m => (
              <StudentRow
                key={`${m.student_id}-${m.class_id}`}
                m={m}
                color={classColorMap[m.class_id] ?? CLASS_COLORS[0]}
                stats={submissionMap[m.student_id]}
                classColorMap={classColorMap}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
