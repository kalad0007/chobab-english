import { SupabaseClient } from '@supabase/supabase-js'
import { getMaxScore, calculateSectionBand, calculateOverallBand } from '@/lib/utils'

/**
 * 채점 완료 후 submissions 테이블의 섹션별/통합 밴드 점수를 재계산하여 업데이트합니다.
 * GradeEssayPanel, GradeSpeakingPanel에서 공통으로 사용합니다.
 *
 * @param supabase  Supabase 클라이언트
 * @param submissionId  대상 submission ID
 * @param examId  시험 ID (max_band_ceiling 조회용)
 */
export async function recalcSubmissionBands(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  submissionId: string,
  examId: string,
): Promise<void> {
  const [{ data: allAnswers }, { data: exam }] = await Promise.all([
    supabase
      .from('submission_answers')
      .select('score, is_correct, questions(category, question_subtype)')
      .eq('submission_id', submissionId),
    supabase
      .from('exams')
      .select('max_band_ceiling')
      .eq('id', examId)
      .single(),
  ])

  if (!allAnswers) return

  const ceiling: number = (exam as { max_band_ceiling?: number } | null)?.max_band_ceiling ?? 6.0
  const cats = ['reading', 'listening', 'writing', 'speaking'] as const
  const sectionBands: Record<string, number | null> = {}

  for (const cat of cats) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const qs = allAnswers.filter(a => (a.questions as any)?.category === cat)
    if (qs.length === 0) continue
    const allGraded = qs.every(a => a.is_correct !== null)
    if (!allGraded) continue
    const earned = qs.reduce((s, a) => s + (a.score ?? 0), 0)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const max = qs.reduce((s, a) => s + getMaxScore((a.questions as any)?.question_subtype), 0)
    sectionBands[cat] = calculateSectionBand(earned, max, ceiling)
  }

  const overallBand = calculateOverallBand(Object.values(sectionBands))
  const gradedCount = allAnswers.filter(a => a.is_correct !== null).length

  await supabase.from('submissions').update({
    reading_band:   sectionBands.reading   ?? undefined,
    listening_band: sectionBands.listening ?? undefined,
    writing_band:   sectionBands.writing   ?? undefined,
    speaking_band:  sectionBands.speaking  ?? undefined,
    overall_band:   overallBand > 0 ? overallBand : undefined,
    ...(gradedCount === allAnswers.length ? { status: 'graded' } : {}),
  }).eq('id', submissionId)
}
