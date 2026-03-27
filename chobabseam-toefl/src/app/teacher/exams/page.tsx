import { createClient, getUserFromCookie } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Clock, Users, FileText, CheckCircle, BookOpen } from 'lucide-react'

const STATUS_CONFIG = {
  draft: { label: '초안', color: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' },
  published: { label: '진행중', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  closed: { label: '종료', color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
}

export default async function ExamsPage() {
  const supabase = await createClient()
  const user = await getUserFromCookie()
  if (!user) return null

  const { data: exams } = await supabase
    .from('exams')
    .select('id, title, status, time_limit, created_at, class_id, classes(name)')
    .eq('teacher_id', user.id)
    .order('created_at', { ascending: false })

  // 시험별 문제 수 & 제출 수
  const examIds = (exams ?? []).map(e => e.id)

  const { data: qCounts } = examIds.length > 0
    ? await supabase.from('exam_questions').select('exam_id').in('exam_id', examIds)
    : { data: [] }

  const { data: submissions } = examIds.length > 0
    ? await supabase.from('submissions').select('exam_id, percentage').in('exam_id', examIds)
    : { data: [] }

  // 집계
  const qMap: Record<string, number> = {}
  for (const q of qCounts ?? []) {
    qMap[q.exam_id] = (qMap[q.exam_id] ?? 0) + 1
  }

  const subMap: Record<string, { count: number; avgPct: number }> = {}
  for (const s of submissions ?? []) {
    if (!subMap[s.exam_id]) subMap[s.exam_id] = { count: 0, avgPct: 0 }
    subMap[s.exam_id].count++
    subMap[s.exam_id].avgPct += s.percentage ?? 0
  }
  for (const id of Object.keys(subMap)) {
    subMap[id].avgPct = Math.round(subMap[id].avgPct / subMap[id].count)
  }

  const grouped = {
    published: (exams ?? []).filter(e => e.status === 'published'),
    draft: (exams ?? []).filter(e => e.status === 'draft'),
    closed: (exams ?? []).filter(e => e.status === 'closed'),
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function ExamCard({ exam }: { exam: any }) {
    const cfg = STATUS_CONFIG[exam.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.draft
    const qCount = qMap[exam.id] ?? 0
    const sub = subMap[exam.id]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cls = exam.classes as any

    return (
      <Link href={`/teacher/exams/${exam.id}`}
        className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition p-5 block group">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 pr-3">
            <h3 className="font-bold text-gray-900 group-hover:text-blue-600 transition">{exam.title}</h3>
            {cls && <p className="text-xs text-gray-400 mt-0.5">{cls.name}</p>}
          </div>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 flex-shrink-0 ${cfg.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <FileText size={13} />
            {qCount}문제
          </span>
          {exam.time_limit && (
            <span className="flex items-center gap-1">
              <Clock size={13} />
              {exam.time_limit}분
            </span>
          )}
          {sub && (
            <span className="flex items-center gap-1">
              <Users size={13} />
              {sub.count}명 제출
            </span>
          )}
          {sub && (
            <span className={`font-bold ml-auto ${sub.avgPct >= 80 ? 'text-emerald-600' : sub.avgPct >= 60 ? 'text-blue-600' : 'text-amber-600'}`}>
              평균 {sub.avgPct}%
            </span>
          )}
        </div>
      </Link>
    )
  }

  return (
    <div className="p-4 md:p-7">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">📝 시험 관리</h1>
          <p className="text-gray-500 text-sm mt-1">총 {(exams ?? []).length}개의 시험</p>
        </div>
        <Link href="/teacher/exams/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition shadow-sm">
          <Plus size={16} />
          새 시험 만들기
        </Link>
      </div>

      {(exams ?? []).length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
          <BookOpen size={48} className="mx-auto text-gray-200 mb-4" />
          <p className="font-semibold text-gray-500">아직 시험이 없어요</p>
          <p className="text-sm text-gray-400 mt-1">문제은행에서 문제를 선택해 첫 시험을 만들어보세요</p>
          <Link href="/teacher/exams/new"
            className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition">
            <Plus size={15} /> 시험 만들기
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.published.length > 0 && (
            <section>
              <h2 className="text-sm font-bold text-blue-600 uppercase tracking-wide mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                진행중 ({grouped.published.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {grouped.published.map(e => <ExamCard key={e.id} exam={e} />)}
              </div>
            </section>
          )}

          {grouped.draft.length > 0 && (
            <section>
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />
                초안 ({grouped.draft.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {grouped.draft.map(e => <ExamCard key={e.id} exam={e} />)}
              </div>
            </section>
          )}

          {grouped.closed.length > 0 && (
            <section>
              <h2 className="text-sm font-bold text-emerald-600 uppercase tracking-wide mb-3 flex items-center gap-2">
                <CheckCircle size={14} />
                종료된 시험 ({grouped.closed.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {grouped.closed.map(e => <ExamCard key={e.id} exam={e} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
