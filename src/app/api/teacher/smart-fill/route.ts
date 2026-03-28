import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// 슬롯 유형별 question_subtype 매핑
const SLOT_SUBTYPES: Record<string, string[]> = {
  fill_blank:   ['complete_the_words', 'sentence_completion'],
  daily_life:   ['daily_life_email', 'daily_life_text_chain', 'read_in_daily_life'],  // 구형 호환 포함
  deep_reading: ['factual', 'negative_factual', 'inference', 'rhetorical_purpose',
                 'vocabulary', 'reference', 'sentence_simplification', 'insert_text',
                 'academic_passage'],  // academic_passage도 deep_reading 계열
}

// 모듈별 난이도 창 계산 (FLOAT ±0.5 단위)
function getDiffWindow(target: number, module: string) {
  if (module === 'M1')   return { min: target - 0.5, max: target + 0.5 }
  if (module === 'M2up') return { min: target + 0.5, max: target + 1.0 }
  /* M2down */           return { min: target - 1.0, max: target - 0.5 }
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const {
    classId,
    targetBand,   // FLOAT 1.0~6.0
    module,       // 'M1' | 'M2up' | 'M2down'
    slotType,     // 'fill_blank' | 'daily_life' | 'deep_reading'
    count,        // 필요 문제 수
    excludeIds,   // 이미 사용된 question IDs
    maxBand,      // FLOAT 상한선
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

  const subtypes = SLOT_SUBTYPES[slotType] ?? []

  // ── 탄력적 보충: 넓은 풀 조회 후 목표 난이도와 가까운 순으로 정렬 ──
  // 1차: ±0.5 범위, 부족 시 최대 ±2.0까지 자동 확장
  const poolMin = Math.max(1.0, rawMin - 1.5)
  const poolMax = Math.min(6.0, effectiveMax + 1.5)

  let query = supabase
    .from('questions')
    .select('id, content, difficulty, question_subtype, passage_id, type, category, options')
    .eq('category', 'reading')
    .eq('is_active', true)
    .gte('difficulty', poolMin)
    .lte('difficulty', poolMax)
    .order('created_at', { ascending: false })
    .limit(200)

  if (subtypes.length > 0)
    query = query.in('question_subtype', subtypes)
  if (usedIds.length > 0)
    query = query.not('id', 'in', `(${usedIds.map(id => `'${id}'`).join(',')})`)

  const { data: raw, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 목표 난이도와의 거리 순으로 정렬 → 가장 가까운 문제 우선
  const sorted = (raw ?? [])
    .sort((a, b) => Math.abs(a.difficulty - targetBand) - Math.abs(b.difficulty - targetBand))

  // 같은 거리 내에서 셔플 (다양성 보장)
  const buckets: Record<string, typeof sorted> = {}
  for (const q of sorted) {
    const dist = Math.abs(q.difficulty - targetBand).toFixed(1)
    if (!buckets[dist]) buckets[dist] = []
    buckets[dist].push(q)
  }
  const shuffled = Object.values(buckets)
    .flatMap(bucket => bucket.sort(() => Math.random() - 0.5))
    .slice(0, count)

  return NextResponse.json({ questions: shuffled })
}
