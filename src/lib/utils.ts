import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import React from 'react'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 날짜 포맷
export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
  }).format(new Date(date))
}

// 문제 유형별 기본 제한시간 (초)
export const DEFAULT_TIME_LIMITS: Record<string, number> = {
  // Reading
  complete_the_words:     300,  // 5분
  sentence_completion:    300,  // 5분
  daily_life_email:        60,  // 1분
  daily_life_text_chain:   60,  // 1분
  academic_passage:        70,  // 1분 10초
  // Listening
  choose_response:         30,
  conversation:            30,
  academic_talk:           30,
  campus_announcement:     30,
  // Writing
  sentence_reordering:     35,
  email_writing:          420,  // 7분
  academic_discussion:    600,  // 10분
  // Speaking
  listen_and_repeat:       10,
  take_an_interview:       45,
}

// 초 → "X분 Y초" 또는 "Y초" 포맷
export function formatSeconds(sec: number): string {
  if (sec >= 60) {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return s > 0 ? `${m}분 ${s}초` : `${m}분`
  }
  return `${sec}초`
}

// A/B/C/D 보기 표기 여부: 리스닝 전체 + 리딩 특정 서브타입
const ALPHA_OPTION_SUBTYPES = new Set(['daily_life_email', 'daily_life_text_chain', 'academic_passage'])
export function usesAlphaOptions(category: string, subtype?: string | null): boolean {
  return category === 'listening' || ALPHA_OPTION_SUBTYPES.has(subtype ?? '')
}
export function optionLabel(num: number, alpha: boolean): string {
  return alpha ? (['A', 'B', 'C', 'D', 'E'][num - 1] ?? String(num)) : String(num)
}

// TOEFL 섹션 한국어 변환
export const CATEGORY_LABELS: Record<string, string> = {
  reading: 'Reading',
  listening: 'Listening',
  writing: 'Writing',
  speaking: 'Speaking',
}

// TOEFL 섹션별 시간 (분)
export const TOEFL_SECTION_TIME: Record<string, number> = {
  reading: 35,
  listening: 36,
  speaking: 16,
  writing: 29,
}

// ─── 신 토플 (2026~) 밴드 스코어 시스템 ───────────────────────────────────────

// 10단계 정밀 난이도 그리드 (DB difficulty = FLOAT 1.0~6.0)
export const DIFFICULTY_LEVELS = [
  { level: 'L1',  value: 1.0, label: '1.0', name: '기초',       cefr: 'A1',  color: 'bg-slate-100  text-slate-600'  },
  { level: 'L2',  value: 1.5, label: '1.5', name: '기초 완성',  cefr: 'A2',  color: 'bg-gray-100   text-gray-600'   },
  { level: 'L3',  value: 2.0, label: '2.0', name: '중급 입문',  cefr: 'A2+', color: 'bg-lime-100   text-lime-700'   },
  { level: 'L4',  value: 2.5, label: '2.5', name: '중급 중간',  cefr: 'B1',  color: 'bg-green-100  text-green-700'  },
  { level: 'L5',  value: 3.0, label: '3.0', name: '중급 완성',  cefr: 'B1+', color: 'bg-teal-100   text-teal-700'   },
  { level: 'L6',  value: 3.5, label: '3.5', name: '중급 심화',  cefr: 'B2',  color: 'bg-blue-100   text-blue-700'   },
  { level: 'L7',  value: 4.0, label: '4.0', name: '고급 입문',  cefr: 'B2+', color: 'bg-indigo-100  text-indigo-700' },
  { level: 'L8',  value: 4.5, label: '4.5', name: '고급 중간',  cefr: 'C1',  color: 'bg-violet-100  text-violet-700' },
  { level: 'L9',  value: 5.0, label: '5.0', name: '고급 완성',  cefr: 'C1+', color: 'bg-purple-100  text-purple-700' },
  { level: 'L10', value: 5.5, label: '5.5', name: '전문가',     cefr: 'C2',  color: 'bg-orange-100  text-orange-700' },
  { level: 'MAX', value: 6.0, label: '6.0', name: 'Mastery',    cefr: 'C2+', color: 'bg-red-100    text-red-700'    },
] as const

export type DifficultyValue = typeof DIFFICULTY_LEVELS[number]['value']

// 난이도 값 → DIFFICULTY_LEVELS 항목 조회 (가장 가까운 값으로 반올림)
export function getDiffInfo(d: number) {
  const snap = Math.round(d * 2) / 2   // 0.5 단위 스냅
  return DIFFICULTY_LEVELS.find(l => l.value === snap) ?? DIFFICULTY_LEVELS[4] // 기본 3.0
}

// 구버전 호환: 구 INT(1~5) → Band FLOAT 변환 (DB 마이그레이션 전 데이터용)
export const LEGACY_DIFFICULTY_TO_BAND: Record<number, number> = {
  1: 2.0, 2: 3.0, 3: 4.0, 4: 5.0, 5: 6.0,
}

// ── 문제 유형별 배점 (max_score) ─────────────────────────────────────────────
export const MAX_SCORE_BY_SUBTYPE: Record<string, number> = {
  // Reading
  complete_the_words:    1,
  sentence_completion:   1,
  daily_life_email:      3,
  daily_life_text_chain: 3,
  academic_passage:      5,
  // Listening
  choose_response:       1,
  conversation:          2,
  academic_talk:         3,
  campus_announcement:   3,
  // Writing
  sentence_reordering:   1,
  email_writing:         5,
  academic_discussion:   15,
  // Speaking
  listen_and_repeat:     1,
  take_an_interview:     5,
}

// 서브타입 → max_score 조회 (없으면 1)
export function getMaxScore(subtype: string | null | undefined): number {
  return MAX_SCORE_BY_SUBTYPE[subtype ?? ''] ?? 1
}

// ── 채점 결과 타입 ────────────────────────────────────────────────────────────
export interface QuestionResult {
  questionId: string
  difficulty: number      // DB difficulty FLOAT 1.0~6.0 (레벨 표시용)
  maxScore: number        // 문제 배점 (MAX_SCORE_BY_SUBTYPE 기준)
  earnedScore: number     // 실제 획득 점수 (0 ~ maxScore, 부분점수 가능)
}

// ── 2단계: 섹션 밴드 계산 ─────────────────────────────────────────────────────
// Section Band = (Σ earned_score / Σ max_score) × ceiling_band
// 결과는 0.1 단위 소수점 (0.5단위 스냅 없음 — 섹션 단계에서는 세밀하게 유지)
export function calculateSectionBand(
  earnedTotal: number,
  maxTotal: number,
  ceilingBand: number,
): number {
  if (maxTotal === 0) return 0
  const raw = (earnedTotal / maxTotal) * ceilingBand
  return Math.round(Math.max(0, Math.min(6.0, raw)) * 10) / 10
}

// ── 3단계: 통합 밴드 산출 ─────────────────────────────────────────────────────
// Overall Band = 출제된 섹션 밴드들의 평균, 0.5 단위 스냅
export function calculateOverallBand(sectionBands: (number | null | undefined)[]): number {
  const valid = sectionBands.filter((b): b is number => b != null && b > 0)
  if (valid.length === 0) return 0
  const avg = valid.reduce((s, b) => s + b, 0) / valid.length
  return Math.round(Math.max(1.0, Math.min(6.0, avg)) * 2) / 2
}

// ── QuestionResult 배열 → 섹션 raw 합산 헬퍼 ─────────────────────────────────
export function sumScores(results: QuestionResult[]): { earned: number; max: number } {
  return results.reduce(
    (acc, r) => ({ earned: acc.earned + r.earnedScore, max: acc.max + r.maxScore }),
    { earned: 0, max: 0 },
  )
}

// ── 구 토플(0~120점) 환산 — 선생님 참고용 ────────────────────────────────────
export function mapToOldToeflScore(bandScore: number): string {
  if (bandScore >= 6.0) return '118~120점'
  if (bandScore >= 5.5) return '110~117점'
  if (bandScore >= 5.0) return '95~109점'
  if (bandScore >= 4.5) return '84~94점'
  if (bandScore >= 4.0) return '72~83점'
  if (bandScore >= 3.5) return '57~71점'
  if (bandScore >= 3.0) return '42~56점'
  if (bandScore >= 2.5) return '30~41점'
  if (bandScore >= 2.0) return '20~29점'
  return '19점 이하'
}

// ── 밴드 스코어 → 레벨 설명 ───────────────────────────────────────────────────
export function bandToLevel(band: number): string {
  if (band >= 6.0) return 'C2 (Mastery)'
  if (band >= 5.5) return 'C1+ (Advanced+)'
  if (band >= 5.0) return 'C1 (Advanced)'
  if (band >= 4.5) return 'B2+ (Upper-Int+)'
  if (band >= 4.0) return 'B2 (Upper-Intermediate)'
  if (band >= 3.5) return 'B1+ (Intermediate+)'
  if (band >= 3.0) return 'B1 (Intermediate)'
  if (band >= 2.0) return 'A2 (Elementary)'
  return 'A1 (Beginner)'
}

// ── @deprecated 구형 함수 (하위 호환용, 신규 코드에서 사용 금지) ───────────────
/** @deprecated calculateSectionBand / calculateOverallBand 사용 */
export function calculateWeightedBand(results: QuestionResult[], maxBand: number): number {
  const { earned, max } = sumScores(results)
  return calculateSectionBand(earned, max, maxBand)
}
/** @deprecated calculateSectionBand 사용 */
export function calculateObjectiveBand(results: QuestionResult[]): number {
  const { earned, max } = sumScores(results)
  return calculateSectionBand(earned, max, 6.0)
}
/** @deprecated 직접 earned_score 합산 방식으로 교체됨 */
export function speakingScoreToBand(score: number): number {
  const map: Record<number, number> = { 0: 1.0, 1: 2.0, 2: 3.5, 3: 5.0, 4: 6.0 }
  return map[Math.round(score)] ?? 1.0
}
/** @deprecated 직접 earned_score 합산 방식으로 교체됨 */
export function writingScoreToBand(score: number): number {
  const map: Record<number, number> = { 0: 1.0, 1: 2.0, 2: 3.0, 3: 4.0, 4: 5.0, 5: 6.0 }
  return map[Math.round(score)] ?? 1.0
}
/** @deprecated calculateSectionBand 사용 */
export function accuracyToBand(accuracy: number): number {
  return calculateSectionBand(accuracy, 100, 6.0)
}

// 구 토플 호환 — 섹션별 만점 (참고용으로만 유지)
export const TOEFL_SECTION_MAX: Record<string, number> = {
  reading: 30,
  listening: 30,
  speaking: 30,
  writing: 30,
}

// 구 토플 총점 계산 (구형 호환)
export function toeflTotalScore(sectionScores: Record<string, number>) {
  return Object.values(sectionScores).reduce((a, b) => a + b, 0)
}

// 구 토플 등급 (구형 호환)
export function toeflLevel(total: number) {
  if (total >= 110) return 'Advanced (C1)'
  if (total >= 87) return 'Upper Intermediate (B2)'
  if (total >= 57) return 'Intermediate (B1)'
  if (total >= 30) return 'Basic (A2)'
  return 'Below Basic (A1)'
}

// TOEFL 문제 세부유형 라벨
export const QUESTION_SUBTYPE_LABELS: Record<string, Record<string, string>> = {
  reading: {
    // ── 빈칸 채우기 ──
    complete_the_words:    'Complete the Words',
    sentence_completion:   'Sentence Completion',
    // ── 일상 읽기 ──
    daily_life_email:      'Daily Life — Email',
    daily_life_text_chain: 'Daily Life — Text Chain',
    // ── 학술 독해 ──
    academic_passage:      'Academic Passage',
    factual:               'Factual Information',
    negative_factual:      'Negative Factual',
    inference:             'Inference',
    rhetorical_purpose:    'Rhetorical Purpose',
    vocabulary:            'Vocabulary',
    reference:             'Reference',
    sentence_simplification: 'Sentence Simplification',
    insert_text:           'Insert Text',
    prose_summary:         'Prose Summary',
    fill_table:            'Fill in a Table',
    // ── 구형 호환 (표시용 라벨 유지) ──
    read_in_daily_life:    'Read in Daily Life (구형)',
  },
  listening: {
    // ── 2026 신규 유형 ──
    choose_response:      'Choose a Response',
    conversation:         'Conversation',
    academic_talk:        'Academic Talk',
    campus_announcement:  'Campus Announcement',
    // ── 구형 유형 (호환) ──
    gist_content:       'Gist-Content',
    gist_purpose:       'Gist-Purpose',
    detail:             'Detail',
    function:           'Function',
    attitude:           'Attitude',
    organization:       'Organization',
    connecting_content: 'Connecting Content',
    inference:          'Inference',
    announcement:       'Announcement',
  },
  speaking: {
    // ── 2026 신규 유형 ──
    listen_and_repeat: 'Listen and Repeat',
    take_an_interview: 'Take an Interview',
    // ── 구형 유형 (호환) ──
    independent:                     'Task 1: Independent',
    integrated_read_listen:          'Task 2: Campus (Read+Listen)',
    integrated_read_listen_academic: 'Task 3: Academic (Read+Listen)',
    integrated_listen:               'Task 4: Lecture Summary',
  },
  writing: {
    // ── 2026 신규 유형 ──
    sentence_reordering: 'Build a Sentence',
    email_writing:       'Write an Email',
    academic_discussion: 'Academic Discussion',
    // ── 구형 유형 (호환) ──
    integrated_writing:  'Task 1: Integrated Writing',
  },
}

// 특수 렌더링이 필요한 문제 유형
export const SPECIAL_QUESTION_SUBTYPES = {
  prose_summary: true,    // 6지선다, 3개 선택
  fill_table: true,        // 카테고리 분류
  complete_the_words: true, // 빈칸 채우기 (서술형)
} as const

// TOEFL Speaking 시간 설정 (초)
export const SPEAKING_TASK_TIMES: Record<string, { prep: number; response: number }> = {
  independent: { prep: 15, response: 45 },
  integrated_read_listen: { prep: 30, response: 60 },
  integrated_read_listen_academic: { prep: 30, response: 60 },
  integrated_listen: { prep: 20, response: 60 },
  listen_and_repeat: { prep: 0, response: 15 },
  take_an_interview: { prep: 15, response: 45 },
}

// TOEFL 섹션별 실제 문제 구성
export const TOEFL_SECTION_STRUCTURE = {
  reading: { passages: 2, questionsPerPassage: 10, totalQuestions: 20 },
  listening: { lectures: 3, conversations: 2, questionsPerLecture: 6, questionsPerConversation: 5, totalQuestions: 28 },
  speaking: { tasks: 4 },
  writing: { tasks: 2 },
}

// 난이도 별 표시
export function difficultyStars(level: number) {
  return '★'.repeat(level) + '☆'.repeat(5 - level)
}

// 정답률 색상
export function accuracyColor(accuracy: number) {
  if (accuracy >= 80) return 'text-emerald-600'
  if (accuracy >= 60) return 'text-blue-600'
  if (accuracy >= 40) return 'text-amber-600'
  return 'text-red-600'
}

// XP → 레벨 계산
export function xpToLevel(xp: number) {
  return Math.floor(Math.sqrt(xp / 100)) + 1
}

// <u>텍스트</u> 를 실제 밑줄로 렌더링
export function renderWithUnderlines(text: string): React.ReactNode {
  const parts = text.split(/(<u>[\s\S]*?<\/u>)/g)
  return parts.map((part, i) => {
    if (part.startsWith('<u>') && part.endsWith('</u>')) {
      return React.createElement('u', { key: i, className: 'underline decoration-2' }, part.slice(3, -4))
    }
    return part
  })
}

// 레벨 타이틀 (TOEFL)
export function levelTitle(level: number) {
  const titles = [
    'TOEFL Beginner', 'Vocabulary Builder', 'Reading Explorer',
    'Listening Learner', 'Speaking Starter', 'Writing Apprentice',
    'Section Master', 'Score Climber', 'Test Strategist', 'TOEFL Champion',
  ]
  return titles[Math.min(level - 1, titles.length - 1)]
}
