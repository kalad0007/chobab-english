'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { Pencil, Check, X } from 'lucide-react'
import { renameCollocationQuiz } from '../collocation-quiz-actions'

export default function RenameQuizButton({ quizId, title }: { quizId: string; title: string }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(title)
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  function handleSave() {
    if (!value.trim() || value.trim() === title) { setEditing(false); return }
    startTransition(async () => {
      await renameCollocationQuiz(quizId, value.trim())
      setEditing(false)
    })
  }

  function handleCancel() {
    setValue(title)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <input
          ref={inputRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleCancel() }}
          className="flex-1 min-w-0 text-sm font-bold border-b-2 border-purple-400 outline-none bg-transparent py-0.5"
        />
        <button onClick={handleSave} disabled={isPending}
          className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg transition flex-shrink-0">
          <Check size={14} />
        </button>
        <button onClick={handleCancel} disabled={isPending}
          className="p-1 text-gray-400 hover:bg-gray-100 rounded-lg transition flex-shrink-0">
          <X size={14} />
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <h3 className="font-bold text-gray-900 text-sm truncate">{title}</h3>
      <button onClick={() => setEditing(true)}
        className="p-1 text-gray-300 hover:text-purple-500 hover:bg-purple-50 rounded-lg transition flex-shrink-0">
        <Pencil size={12} />
      </button>
    </div>
  )
}
