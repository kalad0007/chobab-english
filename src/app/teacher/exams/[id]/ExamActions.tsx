'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Megaphone, Trash2, Loader2, X } from 'lucide-react'
import { deployExam } from '../actions'

interface ClassOption { id: string; name: string }

interface Props {
  examId: string
  examTitle: string
  examTimeLimitMins: number | null
  currentStatus: string
  classes: ClassOption[]
}

export default function ExamActions({ examId, examTitle, examTimeLimitMins, currentStatus, classes }: Props) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)

  async function handleDelete() {
    if (!confirm('정말로 이 시험을 삭제하시겠어요?')) return
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    await supabase.from('exam_questions').delete().eq('exam_id', examId)
    await supabase.from('exams').delete().eq('id', examId)
    router.push('/teacher/exams')
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {currentStatus === 'draft' && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition"
          >
            <Megaphone size={14} /> 출제하기
          </button>
        )}
        <button
          onClick={handleDelete}
          className="flex items-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-sm font-semibold transition"
        >
          <Trash2 size={14} /> 삭제
        </button>
      </div>

      {showModal && (
        <DeployModal
          examId={examId}
          examTitle={examTitle}
          examTimeLimitMins={examTimeLimitMins}
          classes={classes}
          onClose={() => setShowModal(false)}
          onDeployed={() => router.push('/teacher/exams')}
        />
      )}
    </>
  )
}

function DeployModal({ examId, examTitle, examTimeLimitMins, classes, onClose, onDeployed }: {
  examId: string
  examTitle: string
  examTimeLimitMins: number | null
  classes: ClassOption[]
  onClose: () => void
  onDeployed: () => void
}) {
  const [classId, setClassId] = useState(classes[0]?.id ?? '')
  const [startAt, setStartAt] = useState(() => {
    const d = new Date(); d.setMinutes(0, 0, 0)
    return d.toISOString().slice(0, 16)
  })
  const [endAt, setEndAt] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 7); d.setHours(23, 59, 0, 0)
    return d.toISOString().slice(0, 16)
  })
  const [timeLimitMins, setTimeLimitMins] = useState<string>(
    examTimeLimitMins ? String(examTimeLimitMins) : ''
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!classId) { setError('반을 선택해주세요'); return }
    if (!startAt || !endAt) { setError('기간을 설정해주세요'); return }
    if (new Date(endAt) <= new Date(startAt)) { setError('종료일은 시작일보다 이후여야 해요'); return }

    setLoading(true); setError('')
    try {
      await deployExam({
        examId,
        classId,
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        timeLimitMins: timeLimitMins ? parseInt(timeLimitMins) : null,
      })
      onDeployed()
    } catch (err) {
      setError((err as Error).message)
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900">시험 출제하기</h3>
            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{examTitle}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition">
            <X size={14} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1.5">대상 반</label>
            {classes.length === 0 ? (
              <p className="text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">반이 없어요. 먼저 반을 만들어주세요.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {classes.map(cls => (
                  <button key={cls.id} type="button"
                    onClick={() => setClassId(cls.id)}
                    className={`text-sm font-semibold px-3 py-2.5 rounded-xl border transition ${
                      classId === cls.id
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'
                    }`}>
                    {cls.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1.5">시작일시</label>
              <input type="datetime-local" value={startAt} onChange={e => setStartAt(e.target.value)}
                step="60"
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-blue-400 transition" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1.5">종료일시</label>
              <input type="datetime-local" value={endAt} onChange={e => setEndAt(e.target.value)}
                step="60"
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-blue-400 transition" />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1.5">
              응시 제한시간 (분)
            </label>
            <input type="number" min="1" max="300" value={timeLimitMins}
              onChange={e => setTimeLimitMins(e.target.value)}
              placeholder="예: 120"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-blue-400 transition" />
          </div>

          {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <button type="submit" disabled={loading || classes.length === 0}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold transition">
            {loading ? <><Loader2 size={14} className="animate-spin" />배포 중...</> : '📢 출제하기'}
          </button>
        </form>
      </div>
    </div>
  )
}
