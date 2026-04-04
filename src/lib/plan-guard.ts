import { createClient } from '@/lib/supabase/server'
import type { CreditLogType } from '@/types/database'

export type PlanTier = 'free' | 'standard' | 'pro' | 'premium'

const PLAN_ORDER: Record<PlanTier, number> = {
  free: 0, standard: 1, pro: 2, premium: 3,
}

/** AI 생성 종류별 크레딧 단가 */
export const CREDIT_COST: Record<string, number> = {
  // 단순 문제
  choose_response: 5,
  complete_the_words: 5,
  sentence_reordering: 5,
  // 복잡한 문제 (문제당 10)
  daily_life_email: 10,
  daily_life_text_chain: 10,
  daily_life_notice: 10,
  daily_life_guide: 10,
  daily_life_article: 10,
  daily_life_campus_notice: 10,
  academic_passage: 10,
  conversation: 10,
  academic_talk: 10,
  campus_announcement: 10,
  email_writing: 10,
  academic_discussion: 10,
  listen_and_repeat: 10,
  take_an_interview: 10,
  sentence_completion: 10,
  // 퀴즈 생성
  collocation_quiz: 20,
  // 어휘 생성 (단어당 2)
  vocab_per_word: 2,
  // 지문 번역/해설
  passage_translation: 5,
  // 스피킹 평가
  speaking_eval: 5,
  // TTS 음성 합성
  tts: 1,
}

export function hasPlanAccess(current: PlanTier, required: PlanTier): boolean {
  return PLAN_ORDER[current] >= PLAN_ORDER[required]
}

export function getCreditCost(subtype: string, count: number = 1): number {
  const unitCost = CREDIT_COST[subtype] ?? 10
  return unitCost * count
}

/** DB credit_costs 테이블에서 단가 조회 (없으면 하드코딩 기본값 사용) */
export async function getCreditCostFromDB(subtype: string, count: number = 1): Promise<number> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('credit_costs')
    .select('cost')
    .eq('id', subtype)
    .single()

  const unitCost = data?.cost ?? CREDIT_COST[subtype] ?? 10
  return unitCost * count
}

export async function getTeacherPlan(userId: string) {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, plan_expires_at, credits, credits_reset_at')
    .eq('id', userId)
    .single()

  const { data: limits } = await supabase
    .from('plan_limits')
    .select('*')
    .eq('plan', profile?.plan ?? 'free')
    .single()

  // 월 초기화: 매월 기본 크레딧 리필
  const now = new Date()
  const resetAt = profile?.credits_reset_at ? new Date(profile.credits_reset_at) : new Date(0)
  const needsReset = now.getMonth() !== resetAt.getMonth() || now.getFullYear() !== resetAt.getFullYear()

  if (needsReset && profile) {
    const monthlyCredits = limits?.monthly_credits ?? 100
    await supabase.from('profiles').update({
      credits: monthlyCredits,
      credits_reset_at: now.toISOString(),
    }).eq('id', userId)
    profile.credits = monthlyCredits
  }

  return {
    plan: (profile?.plan ?? 'free') as PlanTier,
    limits,
    credits: profile?.credits ?? 0,
  }
}

/** 크레딧 차감 시도. 잔액 부족 시 allowed: false */
export async function deductCredits(
  userId: string,
  cost: number,
  description?: string
): Promise<{ allowed: boolean; remaining: number; plan: PlanTier }> {
  const { plan, credits } = await getTeacherPlan(userId)

  if (credits < cost) {
    return { allowed: false, remaining: credits, plan }
  }

  const supabase = await createClient()
  await supabase.from('profiles')
    .update({ credits: credits - cost })
    .eq('id', userId)

  // 크레딧 사용 로그
  await supabase.from('credit_logs').insert({
    user_id: userId,
    amount: -cost,
    type: 'usage',
    description: description ?? null,
    related_user_id: null,
  })

  return {
    allowed: true,
    remaining: credits - cost,
    plan,
  }
}

/** 크레딧 로그 기록
 *  - supabase를 넘기면 해당 클라이언트 사용 (admin client 포함)
 *  - 넘기지 않으면 일반 createClient() 사용
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function insertCreditLog({
  userId,
  amount,
  type,
  description,
  relatedUserId,
  supabase: supabaseArg,
}: {
  userId: string
  amount: number
  type: CreditLogType
  description?: string
  relatedUserId?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase?: any
}) {
  const supabase = supabaseArg ?? (await createClient())
  await supabase.from('credit_logs').insert({
    user_id: userId,
    amount,
    type,
    description: description ?? null,
    related_user_id: relatedUserId ?? null,
  })
}

/** 크레딧 환불 (AI 생성 실패 시) */
export async function refundCredits(userId: string, cost: number) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('credits')
    .eq('id', userId)
    .single()

  await supabase.from('profiles')
    .update({ credits: (data?.credits ?? 0) + cost })
    .eq('id', userId)
}
