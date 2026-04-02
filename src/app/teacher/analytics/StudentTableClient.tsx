'use client'

import { useState } from 'react'
import { X, TrendingUp } from 'lucide-react'

interface SubtypeStat {
  category: string
  subtype: string
  shortLabel: string
  accuracy: number | null
  total: number
}

interface StudentRow {
  id: string
  name: string
  className: string
  overall: number | null
  reading: number | null
  listening: number | null
  speaking: number | null
  writing: number | null
  submCount: number
  recentSubs: { date: string; band: number | null }[]
  subtypeAccuracy: SubtypeStat[]
}

function bandTag(band: number | null) {
  if (!band || band === 0) return <span className="text-gray-300 font-medium">—</span>
  const color =
    band >= 5.0 ? 'bg-purple-100 text-purple-700' :
    band >= 4.0 ? 'bg-blue-100 text-blue-700' :
    band >= 3.0 ? 'bg-teal-100 text-teal-700' :
    band >= 2.0 ? 'bg-amber-100 text-amber-700' :
    'bg-red-100 text-red-600'
  return (
    <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>
      {band.toFixed(1)}
    </span>
  )
}

function MiniSparkline({ data }: { data: { band: number | null }[] }) {
  const valid = data.filter(d => d.band && d.band > 0).map(d => d.band!)
  if (valid.length < 2) return <span className="text-xs text-gray-300">—</span>
  const W = 60, H = 24
  const coords = valid.map((v, i) => ({
    x: (i / (valid.length - 1)) * (W - 6) + 3,
    y: H - 3 - ((v - 1) / 5) * (H - 6),
  }))
  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')
  const isUp = valid[valid.length - 1] >= valid[0]
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <path d={path} fill="none" stroke={isUp ? '#10b981' : '#ef4444'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={coords[coords.length - 1].x} cy={coords[coords.length - 1].y} r="2.5" fill={isUp ? '#10b981' : '#ef4444'} />
    </svg>
  )
}

function StudentModal({ student, onClose }: { student: StudentRow; onClose: () => void }) {
  const sections: { key: keyof StudentRow; label: string; color: string }[] = [
    { key: 'reading',   label: 'Reading',   color: 'bg-blue-500' },
    { key: 'listening', label: 'Listening', color: 'bg-amber-500' },
    { key: 'speaking',  label: 'Speaking',  color: 'bg-rose-500' },
    { key: 'writing',   label: 'Writing',   color: 'bg-purple-500' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-extrabold text-gray-900">{student.name}</h3>
            <p className="text-sm text-gray-400 mt-0.5">{student.className} · 총 {student.submCount}회 응시</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 transition text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        {/* Overall Band */}
        <div className="px-6 py-5 border-b border-gray-50">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">최근 종합 밴드</p>
          <div className="flex items-end gap-3">
            <span className="text-5xl font-black text-gray-900">
              {student.overall ? student.overall.toFixed(1) : '—'}
            </span>
            {student.overall && (
              <span className="text-base text-gray-400 mb-1">/ 6.0</span>
            )}
          </div>
        </div>

        {/* Section Bands */}
        <div className="px-6 py-5 border-b border-gray-50">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">섹션별 밴드</p>
          <div className="space-y-3">
            {sections.map(({ key, label, color }) => {
              const val = student[key] as number | null
              const pct = val ? (val / 6) * 100 : 0
              return (
                <div key={key} className="flex items-center gap-3">
                  <span className="w-16 text-sm font-semibold text-gray-700 flex-shrink-0">{label}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                    <div className={`h-2.5 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-8 text-right text-sm font-bold text-gray-700 flex-shrink-0">
                    {val ? val.toFixed(1) : '—'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Subtype Accuracy */}
        {(student.subtypeAccuracy ?? []).some(s => s.accuracy !== null) && (
          <div className="px-6 py-5 border-b border-gray-50">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">문제 유형별 정답률</p>
            {(['reading', 'listening', 'writing', 'speaking'] as const).map(cat => {
              const items = (student.subtypeAccuracy ?? []).filter(s => s.category === cat && (s.accuracy !== null || s.total > 0))
              if (items.length === 0) return null
              const catColor: Record<string, string> = {
                reading: 'text-blue-600', listening: 'text-amber-600',
                writing: 'text-purple-600', speaking: 'text-rose-600',
              }
              const barColor: Record<string, string> = {
                reading: 'bg-blue-400', listening: 'bg-amber-400',
                writing: 'bg-purple-400', speaking: 'bg-rose-400',
              }
              return (
                <div key={cat} className="mb-3">
                  <p className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 ${catColor[cat]}`}>{cat}</p>
                  <div className="space-y-1.5">
                    {items.map(item => {
                      const pct = item.accuracy ?? 0
                      return (
                        <div key={item.subtype} className="flex items-center gap-2">
                          <span className="text-xs text-gray-600 w-20 flex-shrink-0 truncate">{item.shortLabel}</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                            {item.accuracy !== null && (
                              <div
                                className={`h-1.5 rounded-full transition-all ${barColor[cat]}`}
                                style={{ width: `${pct}%` }}
                              />
                            )}
                          </div>
                          <span className="text-xs font-bold text-gray-600 w-8 text-right flex-shrink-0">
                            {item.accuracy !== null ? `${item.accuracy}%` : '—'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Recent Trend */}
        {student.recentSubs.length > 0 && (
          <div className="px-6 py-5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">최근 응시 이력</p>
            <div className="space-y-2">
              {student.recentSubs.slice().reverse().map((s, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 text-xs">
                    {s.date ? new Date(s.date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) : '날짜 미상'}
                  </span>
                  {bandTag(s.band)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function StudentTableClient({ students }: { students: StudentRow[] }) {
  const [selected, setSelected] = useState<StudentRow | null>(null)

  if (students.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
        <TrendingUp size={40} className="mx-auto text-gray-200 mb-3" />
        <p className="font-semibold text-gray-500">등록된 학생이 없어요</p>
      </div>
    )
  }

  return (
    <>
      {selected && <StudentModal student={selected} onClose={() => setSelected(null)} />}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50">
          <h2 className="font-bold text-gray-900">👥 전체 학생 밴드 현황</h2>
        </div>

        {/* 모바일: 카드 리스트 */}
        <div className="md:hidden space-y-3 p-4">
          {students.map(s => (
            <div key={s.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-bold text-gray-900 text-sm">{s.name}</p>
                  <p className="text-xs text-gray-400">{s.className}</p>
                </div>
                <div className="flex items-center gap-2">
                  {bandTag(s.overall)}
                  <button
                    onClick={() => setSelected(s)}
                    className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 font-semibold px-2.5 py-1.5 rounded-lg transition min-h-[32px]"
                  >
                    상세
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {([['R', s.reading], ['L', s.listening], ['S', s.speaking], ['W', s.writing]] as [string, number | null][]).map(([label, val]) => (
                  <div key={label} className="text-center bg-gray-50 rounded-xl p-2">
                    <p className="text-xs font-bold text-gray-400 mb-1">{label}</p>
                    <p className="text-sm font-bold text-gray-900">{val != null && val > 0 ? val.toFixed(1) : '—'}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                <span className="text-xs text-gray-400">응시 {s.submCount}회</span>
                <MiniSparkline data={s.recentSubs} />
              </div>
            </div>
          ))}
        </div>

        {/* 데스크탑: 테이블 */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs font-bold text-gray-400 uppercase tracking-wide">
                <th className="text-left px-5 py-3">학생</th>
                <th className="text-left px-3 py-3">반</th>
                <th className="text-center px-3 py-3">Reading</th>
                <th className="text-center px-3 py-3">Listening</th>
                <th className="text-center px-3 py-3">Speaking</th>
                <th className="text-center px-3 py-3">Writing</th>
                <th className="text-center px-3 py-3">종합</th>
                <th className="text-center px-3 py-3">추이</th>
                <th className="text-center px-3 py-3">응시</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {students.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 transition">
                  <td className="px-5 py-3 font-semibold text-gray-800">{s.name}</td>
                  <td className="px-3 py-3 text-xs text-gray-400">{s.className}</td>
                  <td className="px-3 py-3 text-center">{bandTag(s.reading)}</td>
                  <td className="px-3 py-3 text-center">{bandTag(s.listening)}</td>
                  <td className="px-3 py-3 text-center">{bandTag(s.speaking)}</td>
                  <td className="px-3 py-3 text-center">{bandTag(s.writing)}</td>
                  <td className="px-3 py-3 text-center">{bandTag(s.overall)}</td>
                  <td className="px-3 py-3 text-center">
                    <MiniSparkline data={s.recentSubs} />
                  </td>
                  <td className="px-3 py-3 text-center text-xs text-gray-500 font-semibold">{s.submCount}회</td>
                  <td className="px-3 py-3 text-center">
                    <button
                      onClick={() => setSelected(s)}
                      className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 font-semibold px-2.5 py-1 rounded-lg transition"
                    >
                      상세 리포트
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
