'use client'

import { useState, useTransition } from 'react'
import { joinClass, leaveClass } from '../actions'
import { Plus, LogOut, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react'

interface ClassInfo {
  id: string
  name: string
  teacherName: string
  inviteCode: string
}

export default function ClassesWidget({ classes }: { classes: ClassInfo[] }) {
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)
  const [isPending, startTransition] = useTransition()
  const [copiedId, setCopiedId] = useState<string | null>(null)

  async function copyCode(classId: string, inviteCode: string) {
    try {
      await navigator.clipboard.writeText(inviteCode)
    } catch {
      const el = document.createElement('textarea')
      el.value = inviteCode
      el.style.position = 'fixed'
      el.style.opacity = '0'
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopiedId(classId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim()) return
    setMessage(null)
    startTransition(async () => {
      const result = await joinClass(code)
      if (result.error) {
        setMessage({ text: result.error, ok: false })
      } else {
        setCode('')
        setOpen(false)
        setMessage({ text: '반에 입장했습니다!', ok: true })
      }
    })
  }

  function handleLeave(classId: string, className: string) {
    if (!confirm(`"${className}" 반에서 나가시겠습니까?`)) return
    startTransition(async () => {
      const result = await leaveClass(classId)
      if (result.error) setMessage({ text: result.error, ok: false })
    })
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 rounded-2xl transition"
      >
        <h2 className="font-bold text-gray-900">🏫 내 반 ({classes.length}개)</h2>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>

      {open && (
        <div className="border-t border-gray-50">
          {message && (
            <div className={`mx-5 mt-3 text-sm px-3 py-2 rounded-lg ${
              message.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {message.text}
            </div>
          )}

          {classes.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">소속된 반이 없어요</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {classes.map(cls => (
                <div key={cls.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{cls.name}</p>
                    <p className="text-xs text-gray-400">{cls.teacherName} 선생님</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {cls.inviteCode && (
                      <button
                        type="button"
                        onClick={() => copyCode(cls.id, cls.inviteCode)}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-500 transition"
                        title="초대코드 복사"
                      >
                        {copiedId === cls.id
                          ? <><Check size={13} className="text-emerald-500" /><span className="text-emerald-500">복사됨</span></>
                          : <><Copy size={13} /><span className="font-mono">{cls.inviteCode}</span></>
                        }
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleLeave(cls.id, cls.name)}
                      disabled={isPending}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition disabled:opacity-50"
                    >
                      <LogOut size={13} />
                      나가기
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="px-5 py-4 border-t border-gray-50">
            <form onSubmit={handleJoin} className="flex gap-2">
              <input
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="초대 코드 입력"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-900 font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button
                type="submit"
                disabled={isPending || !code.trim()}
                className="flex items-center gap-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white text-sm font-bold rounded-xl transition"
              >
                <Plus size={14} />
                입장
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
