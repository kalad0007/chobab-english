import { createClient, getUserFromCookie } from '@/lib/supabase/server'
import Link from 'next/link'
import { CATEGORY_LABELS } from '@/lib/utils'

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const user = await getUserFromCookie()
  if (!user) return null

  const { data: classes } = await supabase.from('classes').select('id, name').eq('teacher_id', user.id)
  const classIds = (classes ?? []).map(c => c.id)

  // 학생 목록
  const { data: members } = classIds.length > 0
    ? await supabase.from('class_members')
        .select('student_id, profiles(name), classes(name)')
        .in('class_id', classIds)
    : { data: [] }

  const studentIds = (members ?? []).map(m => m.student_id)

  // 학생별 스킬 통계
  const { data: skillStats } = studentIds.length > 0
    ? await supabase.from('student_skill_stats').select('*').in('student_id', studentIds)
    : { data: [] }

  // 최근 시험 결과
  const { data: exams } = await supabase
    .from('exams').select('id, title, created_at').eq('teacher_id', user.id)
    .eq('status', 'closed').order('created_at', { ascending: false }).limit(5)

  // 카테고리별 집계
  const catAgg: Record<string, { total: number; correct: number }> = {}
  for (const s of skillStats ?? []) {
    if (!catAgg[s.category]) catAgg[s.category] = { total: 0, correct: 0 }
    catAgg[s.category].total += s.total_count
    catAgg[s.category].correct += s.correct_count
  }

  // 학생별 종합 정답률
  const studentAgg: Record<string, { name: string; className: string; total: number; correct: number }> = {}
  for (const m of members ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profile = m.profiles as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cls = m.classes as any
    studentAgg[m.student_id] = {
      name: profile?.name ?? '알 수 없음',
      className: cls?.name ?? '',
      total: 0, correct: 0,
    }
  }
  for (const s of skillStats ?? []) {
    if (studentAgg[s.student_id]) {
      studentAgg[s.student_id].total += s.total_count
      studentAgg[s.student_id].correct += s.correct_count
    }
  }

  const studentList = Object.entries(studentAgg)
    .map(([id, data]) => ({
      id,
      ...data,
      accuracy: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
    }))
    .sort((a, b) => a.accuracy - b.accuracy)

  return (
    <div className="p-7">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900">📊 통계 분석</h1>
        <p className="text-gray-500 text-sm mt-1">전체 학생 학습 현황</p>
      </div>

      <div className="grid grid-cols-2 gap-5 mb-6">
        {/* 영역별 정답률 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-50">
            <h2 className="font-bold text-gray-900">영역별 전체 정답률</h2>
          </div>
          <div className="px-5 py-4 space-y-4">
            {Object.entries(CATEGORY_LABELS).map(([cat, label]) => {
              const agg = catAgg[cat]
              const accuracy = agg && agg.total > 0 ? Math.round((agg.correct / agg.total) * 100) : 0
              return (
                <div key={cat} className="flex items-center gap-3">
                  <span className="w-16 text-sm font-semibold text-gray-700 flex-shrink-0">{label}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-3">
                    <div className={`h-3 rounded-full transition-all ${
                      accuracy >= 80 ? 'bg-emerald-500' : accuracy >= 60 ? 'bg-blue-500' :
                      accuracy >= 40 ? 'bg-amber-400' : agg ? 'bg-red-400' : 'bg-gray-200'
                    }`} style={{ width: `${accuracy}%` }} />
                  </div>
                  <span className={`w-10 text-right text-sm font-bold flex-shrink-0 ${
                    !agg ? 'text-gray-300' :
                    accuracy >= 80 ? 'text-emerald-600' : accuracy >= 60 ? 'text-blue-600' :
                    accuracy >= 40 ? 'text-amber-600' : 'text-red-500'
                  }`}>
                    {agg ? `${accuracy}%` : '—'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* 취약 학생 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-50">
            <h2 className="font-bold text-gray-900">⚠️ 주의 학생 (정답률 낮은 순)</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {studentList.slice(0, 5).map(s => (
              <div key={s.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{s.name}</p>
                  <p className="text-xs text-gray-400">{s.className}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-20 bg-gray-100 rounded-full h-2">
                    <div className={`h-2 rounded-full ${s.accuracy < 60 ? 'bg-red-400' : 'bg-amber-400'}`}
                      style={{ width: `${s.accuracy}%` }} />
                  </div>
                  <span className={`text-sm font-bold w-10 text-right ${s.accuracy < 60 ? 'text-red-500' : 'text-amber-600'}`}>
                    {s.total > 0 ? `${s.accuracy}%` : '—'}
                  </span>
                </div>
              </div>
            ))}
            {studentList.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">아직 데이터가 없어요</p>
            )}
          </div>
        </div>
      </div>

      {/* 전체 학생 테이블 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
          <h2 className="font-bold text-gray-900">👥 전체 학생 성적 현황</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-bold text-gray-400 uppercase tracking-wide">학생</th>
                <th className="text-left px-3 py-3 text-xs font-bold text-gray-400 uppercase tracking-wide">반</th>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <th key={k} className="text-center px-3 py-3 text-xs font-bold text-gray-400 uppercase tracking-wide">{v}</th>
                ))}
                <th className="text-center px-3 py-3 text-xs font-bold text-gray-400 uppercase tracking-wide">전체</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {studentList.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-8 text-gray-400">데이터가 없어요</td></tr>
              ) : (
                studentList.map(student => {
                  const studentSkills = (skillStats ?? []).filter(s => s.student_id === student.id)
                  return (
                    <tr key={student.id} className="hover:bg-gray-50 transition">
                      <td className="px-5 py-3 font-semibold text-gray-800">{student.name}</td>
                      <td className="px-3 py-3 text-gray-500 text-xs">{student.className}</td>
                      {Object.keys(CATEGORY_LABELS).map(cat => {
                        const stat = studentSkills.find(s => s.category === cat)
                        const acc = stat ? Math.round(stat.accuracy) : null
                        return (
                          <td key={cat} className="px-3 py-3 text-center">
                            {acc !== null ? (
                              <span className={`text-xs font-bold ${acc >= 80 ? 'text-emerald-600' : acc >= 60 ? 'text-blue-600' : acc >= 40 ? 'text-amber-600' : 'text-red-500'}`}>
                                {acc}%
                              </span>
                            ) : <span className="text-gray-200">—</span>}
                          </td>
                        )
                      })}
                      <td className="px-3 py-3 text-center">
                        <span className={`text-sm font-black ${
                          student.accuracy >= 80 ? 'text-emerald-600' :
                          student.accuracy >= 60 ? 'text-blue-600' :
                          student.total > 0 ? 'text-amber-600' : 'text-gray-300'
                        }`}>
                          {student.total > 0 ? `${student.accuracy}%` : '—'}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
