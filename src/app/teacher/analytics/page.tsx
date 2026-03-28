import { createClient, getUserFromCookie } from '@/lib/supabase/server'
import { QUESTION_SUBTYPE_LABELS } from '@/lib/utils'
import StudentTableClient from './StudentTableClient'
import { TrendingDown, TrendingUp, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react'

// ── helpers ─────────────────────────────────────────────────────────────────

function BandTrendChart({ data }: { data: { label: string; avgBand: number }[] }) {
  if (data.length < 2) {
    return <div className="flex items-center justify-center h-16 text-xs text-gray-400">데이터 2회 이상 필요</div>
  }
  const W = 220, H = 64, PAD = 8
  const cW = W - PAD * 2, cH = H - PAD * 2
  const coords = data.map((d, i) => ({
    x: PAD + (i / (data.length - 1)) * cW,
    y: PAD + cH - ((d.avgBand - 1) / 5) * cH,
  }))
  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')
  const isUp = data[data.length - 1].avgBand >= data[0].avgBand
  const stroke = isUp ? '#10b981' : '#ef4444'
  return (
    <div className="flex-1">
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.2" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Area fill */}
        <path
          d={`${path} L${coords[coords.length - 1].x.toFixed(1)},${(PAD + cH).toFixed(1)} L${coords[0].x.toFixed(1)},${(PAD + cH).toFixed(1)} Z`}
          fill="url(#trendGrad)"
        />
        {/* Line */}
        <path d={path} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Dots */}
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r="3" fill={stroke} />
        ))}
      </svg>
      {/* X-axis labels */}
      <div className="flex justify-between px-2 mt-1">
        {data.map((d, i) => (
          <span key={i} className="text-[9px] text-gray-400 truncate" style={{ maxWidth: '40px' }}>{d.label}</span>
        ))}
      </div>
    </div>
  )
}

const HEAT_LABELS: Record<string, string> = {
  complete_the_words: '빈칸채우기', sentence_completion: '문장완성',
  daily_life_email: '이메일독해', daily_life_text_chain: '문자독해',
  academic_passage: '학술독해', choose_response: '응답선택',
  conversation: '대화', academic_talk: '학술강의',
  campus_announcement: '공지문', sentence_reordering: '문장배열',
  email_writing: '이메일쓰기', academic_discussion: '학술토론',
  listen_and_repeat: '따라말하기', take_an_interview: '인터뷰',
}

const CAT_COLOR: Record<string, { bg: string; border: string }> = {
  reading:   { bg: 'bg-blue-50',   border: 'border-blue-200' },
  listening: { bg: 'bg-amber-50',  border: 'border-amber-200' },
  writing:   { bg: 'bg-purple-50', border: 'border-purple-200' },
  speaking:  { bg: 'bg-rose-50',   border: 'border-rose-200' },
}

const CURRENT_SUBTYPES = [
  { category: 'reading',   subtype: 'complete_the_words' },
  { category: 'reading',   subtype: 'sentence_completion' },
  { category: 'reading',   subtype: 'daily_life_email' },
  { category: 'reading',   subtype: 'daily_life_text_chain' },
  { category: 'reading',   subtype: 'academic_passage' },
  { category: 'listening', subtype: 'choose_response' },
  { category: 'listening', subtype: 'conversation' },
  { category: 'listening', subtype: 'academic_talk' },
  { category: 'listening', subtype: 'campus_announcement' },
  { category: 'writing',   subtype: 'sentence_reordering' },
  { category: 'writing',   subtype: 'email_writing' },
  { category: 'writing',   subtype: 'academic_discussion' },
  { category: 'speaking',  subtype: 'listen_and_repeat' },
  { category: 'speaking',  subtype: 'take_an_interview' },
] as const

function heatColor(acc: number, hasData: boolean): string {
  if (!hasData) return 'bg-gray-100 text-gray-400'
  if (acc >= 80) return 'bg-emerald-500 text-white'
  if (acc >= 60) return 'bg-teal-400 text-white'
  if (acc >= 40) return 'bg-amber-400 text-white'
  if (acc >= 20) return 'bg-orange-400 text-white'
  return 'bg-red-500 text-white'
}

function bandChip(band: number) {
  const color =
    band >= 5.0 ? 'bg-purple-100 text-purple-700' :
    band >= 4.0 ? 'bg-blue-100 text-blue-700' :
    band >= 3.0 ? 'bg-teal-100 text-teal-700' :
    'bg-amber-100 text-amber-700'
  return <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${color}`}>{band.toFixed(1)}</span>
}

// ── page ─────────────────────────────────────────────────────────────────────

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const user = await getUserFromCookie()
  if (!user) return null

  // Classes & members
  const { data: classes } = await supabase
    .from('classes').select('id, name').eq('teacher_id', user.id).order('created_at', { ascending: true })
  const classIds = (classes ?? []).map(c => c.id)

  const { data: members } = classIds.length > 0
    ? await supabase.from('class_members')
        .select('student_id, class_id, profiles:student_id(name), classes(name)')
        .in('class_id', classIds)
    : { data: [] }

  // Exams & submissions
  const { data: exams } = await supabase
    .from('exams').select('id, title, created_at').eq('teacher_id', user.id)
    .order('created_at', { ascending: true })
  const examIds = (exams ?? []).map(e => e.id)

  const { data: submissions } = examIds.length > 0
    ? await supabase.from('submissions')
        .select('id, student_id, exam_id, status, overall_band, reading_band, listening_band, speaking_band, writing_band, submitted_at')
        .in('exam_id', examIds)
        .in('status', ['submitted', 'graded'])
        .order('submitted_at', { ascending: true })
    : { data: [] }

  // Subtype accuracy from submission_answers
  const submissionIds = (submissions ?? []).map(s => s.id)
  const { data: subtypeAnswers } = submissionIds.length > 0
    ? await supabase.from('submission_answers')
        .select('is_correct, submission_id, questions!inner(category, sub_type)')
        .in('submission_id', submissionIds)
        .not('is_correct', 'is', null)
        .limit(3000)
    : { data: [] }

  // ── 1. Band Trend ────────────────────────────────────────────
  const examBandMap: Record<string, { title: string; date: string; bands: number[] }> = {}
  for (const e of exams ?? []) {
    examBandMap[e.id] = { title: e.title, date: e.created_at, bands: [] }
  }
  for (const sub of submissions ?? []) {
    if (sub.overall_band && sub.overall_band > 0 && examBandMap[sub.exam_id]) {
      examBandMap[sub.exam_id].bands.push(sub.overall_band)
    }
  }
  const trendData = Object.values(examBandMap)
    .filter(e => e.bands.length > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-8)
    .map(e => ({
      label: e.title.slice(0, 5),
      avgBand: Math.round((e.bands.reduce((s, b) => s + b, 0) / e.bands.length) * 10) / 10,
    }))

  const currentAvgBand = trendData.length > 0 ? trendData[trendData.length - 1].avgBand : null
  const prevAvgBand = trendData.length > 1 ? trendData[trendData.length - 2].avgBand : null
  const bandDelta = currentAvgBand && prevAvgBand
    ? Math.round((currentAvgBand - prevAvgBand) * 10) / 10
    : null

  // ── 2. Subtype Heatmap ────────────────────────────────────────
  const subtypeAgg: Record<string, { correct: number; total: number }> = {}
  for (const { category, subtype } of CURRENT_SUBTYPES) {
    subtypeAgg[`${category}::${subtype}`] = { correct: 0, total: 0 }
  }
  for (const sa of subtypeAnswers ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q = sa.questions as any
    if (!q?.category || !q?.sub_type) continue
    const key = `${q.category}::${q.sub_type}`
    if (subtypeAgg[key]) {
      subtypeAgg[key].total++
      if (sa.is_correct) subtypeAgg[key].correct++
    }
  }

  const subtypeStats = CURRENT_SUBTYPES.map(({ category, subtype }) => {
    const agg = subtypeAgg[`${category}::${subtype}`]
    const hasData = agg.total > 0
    const accuracy = hasData ? Math.round((agg.correct / agg.total) * 100) : 0
    const fullLabel = QUESTION_SUBTYPE_LABELS[category]?.[subtype] ?? subtype
    const shortLabel = HEAT_LABELS[subtype] ?? subtype
    return { category, subtype, fullLabel, shortLabel, accuracy, total: agg.total, hasData }
  })

  const withData = subtypeStats.filter(s => s.hasData)
  let aiSummary = '아직 분석할 데이터가 없어요. 시험을 채점하면 취약 유형이 자동 분석됩니다.'
  if (withData.length >= 2) {
    const best  = withData.reduce((a, b) => a.accuracy > b.accuracy ? a : b)
    const worst = withData.reduce((a, b) => a.accuracy < b.accuracy ? a : b)
    aiSummary = `학생들은 '${best.shortLabel}'에서 가장 높은 성취(${best.accuracy}%)를 보이나, '${worst.shortLabel}'에서 심각한 취약점(${worst.accuracy}%)이 발견됩니다. 해당 유형 집중 보강이 필요합니다.`
  }

  // ── 3. Alert Students ────────────────────────────────────────
  const memberMap: Record<string, { name: string; className: string }> = {}
  for (const m of members ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = m.profiles as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = m.classes as any
    memberMap[m.student_id] = { name: p?.name ?? '?', className: c?.name ?? '' }
  }

  const studentSubHistory: Record<string, NonNullable<typeof submissions>[number][]> = {}
  for (const sub of submissions ?? []) {
    if (!studentSubHistory[sub.student_id]) studentSubHistory[sub.student_id] = []
    studentSubHistory[sub.student_id].push(sub)
  }

  // 📉 성적 하락
  const dropAlerts: { id: string; name: string; cls: string; prev: number; curr: number; drop: number }[] = []
  for (const [sid, subs] of Object.entries(studentSubHistory)) {
    const graded = subs.filter(s => s.overall_band && s.overall_band > 0)
    if (graded.length < 2) continue
    const prev = graded[graded.length - 2].overall_band!
    const curr = graded[graded.length - 1].overall_band!
    if (curr < prev) {
      dropAlerts.push({ id: sid, name: memberMap[sid]?.name ?? '?', cls: memberMap[sid]?.className ?? '', prev, curr, drop: Math.round((prev - curr) * 10) / 10 })
    }
  }
  dropAlerts.sort((a, b) => b.drop - a.drop)

  // ⚖️ 섹션 불균형
  const imbalAlerts: { id: string; name: string; cls: string; maxB: number; minB: number; gap: number; maxCat: string; minCat: string }[] = []
  for (const [sid, subs] of Object.entries(studentSubHistory)) {
    const latest = subs.filter(s => s.status === 'graded').at(-1)
    if (!latest) continue
    const bands = [
      { cat: 'Reading', v: latest.reading_band ?? 0 },
      { cat: 'Listening', v: latest.listening_band ?? 0 },
      { cat: 'Speaking', v: latest.speaking_band ?? 0 },
      { cat: 'Writing', v: latest.writing_band ?? 0 },
    ].filter(b => b.v > 0)
    if (bands.length < 2) continue
    const maxB = bands.reduce((a, b) => a.v > b.v ? a : b)
    const minB = bands.reduce((a, b) => a.v < b.v ? a : b)
    const gap = Math.round((maxB.v - minB.v) * 10) / 10
    if (gap >= 1.5) {
      imbalAlerts.push({ id: sid, name: memberMap[sid]?.name ?? '?', cls: memberMap[sid]?.className ?? '', maxB: maxB.v, minB: minB.v, gap, maxCat: maxB.cat, minCat: minB.cat })
    }
  }
  imbalAlerts.sort((a, b) => b.gap - a.gap)

  // ⚠️ 장기 미응시
  const now = new Date()
  const inactiveAlerts: { id: string; name: string; cls: string; days: number }[] = []
  for (const m of members ?? []) {
    const subs = studentSubHistory[m.student_id]
    let days = 999
    if (subs && subs.length > 0) {
      const last = subs.at(-1)
      if (last?.submitted_at) {
        days = Math.floor((now.getTime() - new Date(last.submitted_at).getTime()) / 86400000)
      }
    }
    if (days >= 14) {
      inactiveAlerts.push({ id: m.student_id, name: memberMap[m.student_id]?.name ?? '?', cls: memberMap[m.student_id]?.className ?? '', days })
    }
  }
  inactiveAlerts.sort((a, b) => b.days - a.days)

  // ── Per-student subtype accuracy ─────────────────────────────
  const subToStudent: Record<string, string> = {}
  for (const sub of submissions ?? []) subToStudent[sub.id] = sub.student_id

  const studentSubtypeAgg: Record<string, Record<string, { correct: number; total: number }>> = {}
  for (const sa of subtypeAnswers ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q = sa.questions as any
    if (!q?.category || !q?.sub_type) continue
    const sid = subToStudent[(sa as any).submission_id]
    if (!sid) continue
    if (!studentSubtypeAgg[sid]) studentSubtypeAgg[sid] = {}
    const key = `${q.category}::${q.sub_type}`
    if (!studentSubtypeAgg[sid][key]) studentSubtypeAgg[sid][key] = { correct: 0, total: 0 }
    studentSubtypeAgg[sid][key].total++
    if (sa.is_correct) studentSubtypeAgg[sid][key].correct++
  }

  // ── 4. Student Table ──────────────────────────────────────────
  const studentRows = (members ?? []).map(m => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = m.profiles as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = m.classes as any
    const subs = studentSubHistory[m.student_id] ?? []
    const graded = subs.filter(s => s.status === 'graded').sort((a, b) => (a.submitted_at ?? '').localeCompare(b.submitted_at ?? ''))
    const latest = graded.at(-1)
    return {
      id: m.student_id,
      name: p?.name ?? '?',
      className: c?.name ?? '',
      overall:   latest?.overall_band   ?? null,
      reading:   latest?.reading_band   ?? null,
      listening: latest?.listening_band ?? null,
      speaking:  latest?.speaking_band  ?? null,
      writing:   latest?.writing_band   ?? null,
      submCount: subs.length,
      recentSubs: graded.slice(-5).map(s => ({ date: s.submitted_at ?? '', band: s.overall_band ?? null })),
      subtypeAccuracy: CURRENT_SUBTYPES.map(({ category, subtype }) => {
        const agg = studentSubtypeAgg[m.student_id]?.[`${category}::${subtype}`]
        return {
          category,
          subtype,
          shortLabel: HEAT_LABELS[subtype] ?? subtype,
          accuracy: agg && agg.total > 0 ? Math.round((agg.correct / agg.total) * 100) : null,
          total: agg?.total ?? 0,
        }
      }),
    }
  })
  studentRows.sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0))

  const totalAlerts = dropAlerts.length + imbalAlerts.length + inactiveAlerts.length

  return (
    <div className="p-4 md:p-7 space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900">📊 성적 분석</h1>
        <p className="text-gray-500 text-sm mt-1">밴드 기반 학습 성취 분석</p>
      </div>

      {/* ── 1. 반별 밴드 트렌드 ─────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-bold text-gray-900 mb-4">📈 반 평균 밴드 트렌드</h2>
        {currentAvgBand === null ? (
          <div className="flex items-center justify-center py-8 text-sm text-gray-400">
            채점 완료된 시험이 없어요
          </div>
        ) : (
          <div className="flex items-center gap-6">
            {/* Current band (big) */}
            <div className="flex-shrink-0 text-center">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">현재 평균</p>
              <p className="text-5xl font-black text-gray-900">{currentAvgBand.toFixed(1)}</p>
              {bandDelta !== null && (
                <div className={`flex items-center justify-center gap-1 mt-1 text-sm font-bold ${bandDelta >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {bandDelta >= 0
                    ? <><TrendingUp size={14} /> +{bandDelta}</>
                    : <><TrendingDown size={14} /> {bandDelta}</>
                  }
                </div>
              )}
            </div>
            {/* Trend chart */}
            <BandTrendChart data={trendData} />
          </div>
        )}
      </div>

      {/* ── 2 + 3. Heatmap + Alerts ────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* 취약점 히트맵 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col">
          <div className="px-5 py-4 border-b border-gray-50">
            <h2 className="font-bold text-gray-900">🔥 14대 유형 취약점 히트맵</h2>
          </div>

          {/* AI Summary */}
          <div className="mx-5 mt-4 mb-3 px-4 py-3 bg-blue-50 rounded-xl text-xs text-blue-800 font-medium leading-relaxed">
            🤖 {aiSummary}
          </div>

          {/* Heatmap grid grouped by category */}
          <div className="px-5 pb-5 space-y-3">
            {(['reading', 'listening', 'writing', 'speaking'] as const).map(cat => {
              const items = subtypeStats.filter(s => s.category === cat)
              const colors = CAT_COLOR[cat]
              return (
                <div key={cat}>
                  <p className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 ${
                    cat === 'reading' ? 'text-blue-600' :
                    cat === 'listening' ? 'text-amber-600' :
                    cat === 'writing' ? 'text-purple-600' : 'text-rose-600'
                  }`}>{cat}</p>
                  <div className="grid grid-cols-5 gap-1">
                    {items.map(item => (
                      <div
                        key={item.subtype}
                        title={`${item.fullLabel}: ${item.hasData ? item.accuracy + '%' : '데이터 없음'} (${item.total}문)`}
                        className={`rounded-lg p-1.5 text-center cursor-default transition ${heatColor(item.accuracy, item.hasData)} ${colors.border} border`}
                      >
                        <p className="text-[10px] font-bold leading-tight">{item.shortLabel}</p>
                        <p className="text-[11px] font-black mt-0.5">
                          {item.hasData ? `${item.accuracy}%` : '—'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 주의 학생 알림 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
            <h2 className="font-bold text-gray-900">⚠️ 주의 학생 알림</h2>
            {totalAlerts > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{totalAlerts}</span>
            )}
          </div>

          <div className="flex-1 overflow-auto divide-y divide-gray-50">
            {totalAlerts === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center px-5">
                <CheckCircle2 size={36} className="text-gray-200 mb-3" />
                <p className="font-semibold text-gray-500 text-sm">주의 학생 없음</p>
                <p className="text-xs text-gray-400 mt-1">모든 학생이 안정적인 상태예요</p>
              </div>
            ) : (
              <>
                {/* 성적 하락 */}
                {dropAlerts.slice(0, 3).map(a => (
                  <div key={a.id} className="flex items-start gap-3 px-5 py-3.5">
                    <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <TrendingDown size={14} className="text-red-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">
                        {a.name} <span className="text-xs text-gray-400 font-normal">({a.cls})</span>
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        최근 모의고사 Band {bandChip(a.prev)} → {bandChip(a.curr)} <span className="text-red-500 font-bold">(-{a.drop})</span>
                      </p>
                    </div>
                    <span className="text-[10px] bg-red-50 text-red-500 font-bold px-1.5 py-0.5 rounded flex-shrink-0">성적 하락</span>
                  </div>
                ))}

                {/* 섹션 불균형 */}
                {imbalAlerts.slice(0, 3).map(a => (
                  <div key={a.id} className="flex items-start gap-3 px-5 py-3.5">
                    <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <AlertTriangle size={14} className="text-amber-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">
                        {a.name} <span className="text-xs text-gray-400 font-normal">({a.cls})</span>
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {a.maxCat} {bandChip(a.maxB)} vs {a.minCat} {bandChip(a.minB)} <span className="text-amber-600 font-bold">(갭 {a.gap})</span>
                      </p>
                    </div>
                    <span className="text-[10px] bg-amber-50 text-amber-600 font-bold px-1.5 py-0.5 rounded flex-shrink-0">불균형</span>
                  </div>
                ))}

                {/* 장기 미응시 */}
                {inactiveAlerts.slice(0, 3).map(a => (
                  <div key={a.id} className="flex items-start gap-3 px-5 py-3.5">
                    <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Clock size={14} className="text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">
                        {a.name} <span className="text-xs text-gray-400 font-normal">({a.cls})</span>
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {a.days >= 999 ? '한 번도 응시하지 않음' : `최근 ${a.days}일간 미응시`}
                      </p>
                    </div>
                    <span className="text-[10px] bg-gray-100 text-gray-500 font-bold px-1.5 py-0.5 rounded flex-shrink-0">미응시</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── 4. Student Table ─────────────────────────────────── */}
      <StudentTableClient students={studentRows} />
    </div>
  )
}
