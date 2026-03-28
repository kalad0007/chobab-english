'use client'

import { useTransition } from 'react'
import { updateFeatureLevel } from './actions'

const LEVELS = [
  { value: 1, label: '기초', desc: '시험만' },
  { value: 2, label: '중급', desc: '+ 오답복습' },
  { value: 3, label: '고급', desc: '+ 섹션연습' },
]

interface Props {
  classId: string
  studentId: string
  current: number
}

export default function FeatureLevelSelect({ classId, studentId, current }: Props) {
  const [isPending, startTransition] = useTransition()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const level = Number(e.target.value)
    startTransition(() => { updateFeatureLevel(classId, studentId, level) })
  }

  return (
    <select
      value={current}
      onChange={handleChange}
      disabled={isPending}
      className={`text-xs font-semibold border rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 transition ${
        current === 1 ? 'border-gray-200 text-gray-500 bg-gray-50' :
        current === 2 ? 'border-blue-200 text-blue-700 bg-blue-50' :
                        'border-purple-200 text-purple-700 bg-purple-50'
      } ${isPending ? 'opacity-50' : ''}`}
    >
      {LEVELS.map(l => (
        <option key={l.value} value={l.value}>
          {l.label} ({l.desc})
        </option>
      ))}
    </select>
  )
}
