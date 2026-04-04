import { redirect } from 'next/navigation'
import { createClient, getUserFromCookie } from '@/lib/supabase/server'
import { CREDIT_COST } from '@/lib/plan-guard'
import CreditCostsClient from './CreditCostsClient'

// 카테고리 및 라벨 메타 (하드코딩 fallback용)
const CREDIT_META: Record<string, { label: string; category: string }> = {
  choose_response:        { label: '객관식 문제',          category: '문제 생성' },
  complete_the_words:     { label: '단어 완성',             category: '문제 생성' },
  sentence_reordering:    { label: '문장 배열',             category: '문제 생성' },
  daily_life_email:       { label: '일상 이메일',           category: '문제 생성' },
  daily_life_text_chain:  { label: '문자 대화',             category: '문제 생성' },
  daily_life_notice:      { label: '안내문',                category: '문제 생성' },
  daily_life_guide:       { label: '가이드',                category: '문제 생성' },
  daily_life_article:     { label: '기사',                  category: '문제 생성' },
  daily_life_campus_notice: { label: '캠퍼스 공지',         category: '문제 생성' },
  academic_passage:       { label: '학술 지문',             category: '문제 생성' },
  conversation:           { label: '대화',                  category: '문제 생성' },
  academic_talk:          { label: '학술 강의',             category: '문제 생성' },
  campus_announcement:    { label: '캠퍼스 안내',           category: '문제 생성' },
  email_writing:          { label: '이메일 작문',           category: '문제 생성' },
  academic_discussion:    { label: '학술 토론',             category: '문제 생성' },
  listen_and_repeat:      { label: '듣고 따라하기',         category: '문제 생성' },
  take_an_interview:      { label: '인터뷰',                category: '문제 생성' },
  sentence_completion:    { label: '문장 완성',             category: '문제 생성' },
  vocab_per_word:         { label: '어휘 생성 (단어당)',     category: '어휘' },
  collocation_quiz:       { label: '콜로케이션 퀴즈',       category: '어휘' },
  passage_translation:    { label: '지문 번역/해설',        category: '지문' },
  speaking_eval:          { label: '스피킹 평가',           category: '평가/기타' },
  tts:                    { label: '음성 합성 (TTS)',        category: '평가/기타' },
}

export default async function CreditCostsPage() {
  const user = await getUserFromCookie()
  if (!user) redirect('/login')

  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'superadmin') redirect('/teacher/manage')

  // DB에서 현재 단가 조회
  const { data: dbCosts } = await supabase
    .from('credit_costs')
    .select('id, label, category, cost')

  const dbMap = Object.fromEntries((dbCosts ?? []).map(r => [r.id, r]))

  // 하드코딩 CREDIT_COST와 병합 (DB에 없는 항목은 기본값)
  const items = Object.keys(CREDIT_META).map(id => {
    const meta = CREDIT_META[id]
    const dbRow = dbMap[id]
    return {
      id,
      label: dbRow?.label ?? meta.label,
      category: dbRow?.category ?? meta.category,
      cost: dbRow?.cost ?? CREDIT_COST[id] ?? 10,
    }
  })

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-gray-900">크레딧 단가 조정</h1>
          <p className="text-sm text-gray-400 mt-1">
            AI 기능별 크레딧 소모량을 조정합니다. 변경 사항은 즉시 적용됩니다.
          </p>
        </div>

        <CreditCostsClient items={items} />
      </div>
    </div>
  )
}
