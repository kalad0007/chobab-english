'use client'

import { useState, useTransition } from 'react'
import { Eye, EyeOff, Trash2, Users, Check, X } from 'lucide-react'
import { deleteVocabSet, toggleSetPublish } from '../set-actions'

interface SetRow {
  id: string
  title: string
  topic_category: string
  topicEmoji: string
  difficulty: number
  word_count: number
  is_published: boolean
  published_at: string | null
  created_at: string
  classes: { classId: string; className: string }[]
}

export default function SetsClient({
  sets: initialSets,
  allClasses,
}: {
  sets: SetRow[]
  allClasses: { id: string; name: string }[]
}) {
  const [sets, setSets] = useState(initialSets)
  const [isPending, startTransition] = useTransition()
  const [expandedClassPicker, setExpandedClassPicker] = useState<string | null>(null)
  const [pendingClassIds, setPendingClassIds] = useState<Record<string, Set<string>>>({})

  function getSelectedClasses(setId: string, current: { classId: string }[]) {
    return pendingClassIds[setId] ?? new Set(current.map(c => c.classId))
  }

  function toggleClass(setId: string, classId: string, current: { classId: string }[]) {
    const current_ = getSelectedClasses(setId, current)
    const next = new Set(current_)
    next.has(classId) ? next.delete(classId) : next.add(classId)
    setPendingClassIds(p => ({ ...p, [setId]: next }))
  }

  function handleTogglePublish(set: SetRow) {
    const classIds = [...getSelectedClasses(set.id, set.classes)]
    startTransition(async () => {
      await toggleSetPublish(set.id, classIds)
      setSets(prev => prev.map(s => s.id === set.id
        ? { ...s, is_published: !s.is_published, classes: allClasses.filter(c => classIds.includes(c.id)).map(c => ({ classId: c.id, className: c.name })) }
        : s
      ))
      setExpandedClassPicker(null)
    })
  }

  function handleDelete(id: string) {
    if (!confirm('이 세트를 삭제하시겠습니까? 단어 데이터는 유지됩니다.')) return
    startTransition(async () => {
      await deleteVocabSet(id)
      setSets(prev => prev.filter(s => s.id !== id))
    })
  }

  return (
    <div className="space-y-3">
      {sets.map(set => {
        const selectedCls = getSelectedClasses(set.id, set.classes)
        const isExpanded = expandedClassPicker === set.id

        return (
          <div key={set.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-start gap-4">
              {/* Left: info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-lg">{set.topicEmoji}</span>
                  <h3 className="font-bold text-gray-900 text-sm truncate">{set.title}</h3>
                  {set.is_published
                    ? <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">배포됨</span>
                    : <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">임시저장</span>
                  }
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                  <span>📚 {set.word_count}단어</span>
                  <span>Band {set.difficulty.toFixed(1)}</span>
                  <span>{new Date(set.created_at).toLocaleDateString('ko-KR')}</span>
                </div>

                {/* Deployed classes */}
                {set.classes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {set.classes.map(c => (
                      <span key={c.classId} className="flex items-center gap-1 text-[11px] bg-blue-50 text-blue-600 font-semibold px-2 py-0.5 rounded-full">
                        <Users size={9} /> {c.className}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Right: actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => setExpandedClassPicker(isExpanded ? null : set.id)}
                  className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition"
                >
                  <Users size={13} /> 반 선택
                </button>
                <button
                  onClick={() => handleTogglePublish(set)}
                  disabled={isPending}
                  className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition disabled:opacity-40 ${
                    set.is_published
                      ? 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                      : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700'
                  }`}
                >
                  {set.is_published ? <><EyeOff size={13} /> 배포 취소</> : <><Eye size={13} /> 배포</>}
                </button>
                <button onClick={() => handleDelete(set.id)} disabled={isPending}
                  className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition disabled:opacity-40">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Class picker dropdown */}
            {isExpanded && allClasses.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-bold text-gray-400 mb-2">배포할 반을 선택하세요</p>
                <div className="flex flex-wrap gap-2">
                  {allClasses.map(cls => {
                    const on = selectedCls.has(cls.id)
                    return (
                      <button key={cls.id} onClick={() => toggleClass(set.id, cls.id, set.classes)}
                        className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border-2 transition ${
                          on ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}>
                        {on && <Check size={11} />} {cls.name}
                      </button>
                    )
                  })}
                </div>
                <p className="text-[11px] text-gray-400 mt-2">
                  {selectedCls.size === 0 ? '선택된 반 없음 → 배포 버튼으로 임시저장 상태로 전환' : `${selectedCls.size}개 반에 배포됩니다`}
                </p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
