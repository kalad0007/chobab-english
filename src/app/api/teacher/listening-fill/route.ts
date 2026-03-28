import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// 슬롯 유형별 question_subtype 매핑 (2026 기준)
const RESPONSE_SUBTYPES = ['choose_response']
const CONV_SUBTYPES     = ['conversation']
const TALK_SUBTYPES     = ['academic_talk', 'campus_announcement']

// 모듈별 난이도 창 (FLOAT ±0.5)
function getDiffWindow(target: number, module: string) {
  if (module === 'M1')   return { min: target - 0.5, max: target + 0.5 }
  if (module === 'M2up') return { min: target + 0.5, max: target + 1.0 }
  return                        { min: target - 1.0, max: target - 0.5 }
}

// 세트 수량 최적화: sets 목록에서 총 targetCount 문항에 가장 가깝게 조합 (Greedy)
function optimizeSets(
  sets: { groupId: string; audioUrl: string | null; questions: Record<string, unknown>[] }[],
  targetCount: number,
) {
  const sorted = [...sets].sort((a, b) => b.questions.length - a.questions.length)
  const chosen: typeof sets = []
  let remaining = targetCount
  for (const s of sorted) {
    if (remaining <= 0) break
    if (s.questions.length <= remaining) {
      chosen.push(s)
      remaining -= s.questions.length
    }
  }
  return chosen
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const {
    classId,
    targetBand,   // FLOAT 1.0~6.0
    maxBand,      // FLOAT 상한선
    module,       // 'M1' | 'M2up' | 'M2down'
    slotType,     // 'response' | 'conversation' | 'academic_talk'
    targetCount,  // 필요 총 문항 수
    excludeIds,   // 이미 사용된 question IDs
  } = await req.json()

  const { min: rawMin, max: rawMax } = getDiffWindow(targetBand, module)
  const effectiveMax = Math.min(rawMax, maxBand ?? 6.0)

  // 클래스 이력 조회
  const usedIds: string[] = [...(excludeIds ?? [])]
  if (classId) {
    const { data: exams } = await supabase
      .from('exams').select('id').eq('class_id', classId)
    if (exams?.length) {
      const { data: eq } = await supabase
        .from('exam_questions').select('question_id')
        .in('exam_id', exams.map((e: { id: string }) => e.id))
      eq?.forEach((r: { question_id: string }) => usedIds.push(r.question_id))
    }
  }

  // 탄력적 보충을 위해 넓은 풀 조회
  const poolMin = Math.max(1.0, rawMin - 1.0)
  const poolMax = Math.min(6.0, effectiveMax + 1.0)

  const subtypes = slotType === 'response' ? RESPONSE_SUBTYPES
    : slotType === 'conversation' ? CONV_SUBTYPES : TALK_SUBTYPES

  let q = supabase
    .from('questions')
    // passage_group_id: 세트 그룹 ID (listening도 동일 필드 사용)
    .select('id, content, difficulty, audio_url, passage_group_id, question_subtype, type')
    .eq('category', 'listening')
    .eq('is_active', true)
    .gte('difficulty', poolMin)
    .lte('difficulty', poolMax)
    .in('question_subtype', subtypes)
    .order('created_at', { ascending: false })
    .limit(200)

  if (usedIds.length > 0)
    q = q.not('id', 'in', `(${usedIds.map(id => `'${id}'`).join(',')})`)

  const { data: raw, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 목표 난이도 가까운 순 정렬
  const sorted = (raw ?? []).sort((a, b) =>
    Math.abs(a.difficulty - targetBand) - Math.abs(b.difficulty - targetBand)
  )

  // ── Response: 개별 문항 반환 ──
  if (slotType === 'response') {
    const picked = sorted.slice(0, targetCount * 2).sort(() => Math.random() - 0.5).slice(0, targetCount)
    return NextResponse.json({ type: 'response', questions: picked })
  }

  // ── Conversation / Academic Talk: passage_group_id로 그룹핑 ──
  const grouped: Record<string, { groupId: string; audioUrl: string | null; questions: typeof raw }> = {}
  for (const item of sorted) {
    const key = item.passage_group_id
    if (!key) continue
    if (!grouped[key]) {
      grouped[key] = { groupId: key, audioUrl: item.audio_url ?? null, questions: [] }
    }
    grouped[key].questions.push(item)
  }

  let sets = Object.values(grouped)

  if (slotType === 'conversation') {
    sets = sets.filter(s => s.questions.length >= 2)
    sets = sets.sort(() => Math.random() - 0.5)
    const setsNeeded = Math.ceil(targetCount / 2)
    // AudioSet 형태로 반환 (groupId → audioId 호환)
    return NextResponse.json({
      type: 'sets',
      sets: sets.slice(0, setsNeeded).map(s => ({ audioId: s.groupId, audioUrl: s.audioUrl, questions: s.questions })),
    })
  }

  // Academic Talk: 2~5문항 세트
  sets = sets.filter(s => s.questions.length >= 2 && s.questions.length <= 5)
  sets = sets.sort(() => Math.random() - 0.5).slice(0, 20)
  const chosen = optimizeSets(sets, targetCount)
  return NextResponse.json({
    type: 'sets',
    sets: chosen.map(s => ({ audioId: s.groupId, audioUrl: s.audioUrl, questions: s.questions })),
  })
}
