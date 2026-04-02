import { createClient } from '@/lib/supabase/server'

export type PlanTier = 'free' | 'lite' | 'standard' | 'pro' | 'premium'

const PLAN_ORDER: Record<PlanTier, number> = {
  free: 0, lite: 1, standard: 2, pro: 3, premium: 4,
}

export function hasPlanAccess(current: PlanTier, required: PlanTier): boolean {
  return PLAN_ORDER[current] >= PLAN_ORDER[required]
}

export async function getTeacherPlan(userId: string) {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, plan_expires_at, ai_question_count, ai_question_reset_at, ai_vocab_count, ai_vocab_reset_at')
    .eq('id', userId)
    .single()

  const { data: limits } = await supabase
    .from('plan_limits')
    .select('*')
    .eq('plan', profile?.plan ?? 'free')
    .single()

  // 월 초기화 체크
  const now = new Date()
  const resetAt = profile?.ai_question_reset_at ? new Date(profile.ai_question_reset_at) : new Date(0)
  const needsReset = now.getMonth() !== resetAt.getMonth() || now.getFullYear() !== resetAt.getFullYear()

  if (needsReset && profile) {
    await supabase.from('profiles').update({
      ai_question_count: 0,
      ai_question_reset_at: now.toISOString(),
      ai_vocab_count: 0,
      ai_vocab_reset_at: now.toISOString(),
    }).eq('id', userId)
    profile.ai_question_count = 0
    profile.ai_vocab_count = 0
  }

  return {
    plan: (profile?.plan ?? 'free') as PlanTier,
    limits,
    ai_question_count: profile?.ai_question_count ?? 0,
    ai_vocab_count: profile?.ai_vocab_count ?? 0,
  }
}

export async function checkAndIncrementAiQuestion(userId: string): Promise<
  { allowed: boolean; remaining: number | null; plan: PlanTier }
> {
  const { plan, limits, ai_question_count } = await getTeacherPlan(userId)
  const max = limits?.ai_questions_per_month ?? null

  if (max !== null && ai_question_count >= max) {
    return { allowed: false, remaining: 0, plan }
  }

  const supabase = await createClient()
  await supabase.from('profiles')
    .update({ ai_question_count: ai_question_count + 1 })
    .eq('id', userId)

  return {
    allowed: true,
    remaining: max !== null ? max - ai_question_count - 1 : null,
    plan,
  }
}

export async function checkAndIncrementAiVocab(userId: string): Promise<
  { allowed: boolean; remaining: number | null; plan: PlanTier }
> {
  const { plan, limits, ai_vocab_count } = await getTeacherPlan(userId)
  const max = limits?.ai_vocab_per_month ?? null

  if (max !== null && ai_vocab_count >= max) {
    return { allowed: false, remaining: 0, plan }
  }

  const supabase = await createClient()
  await supabase.from('profiles')
    .update({ ai_vocab_count: ai_vocab_count + 1 })
    .eq('id', userId)

  return {
    allowed: true,
    remaining: max !== null ? max - ai_vocab_count - 1 : null,
    plan,
  }
}
