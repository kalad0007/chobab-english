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

// TOEFL 섹션 한국어 변환
export const CATEGORY_LABELS: Record<string, string> = {
  reading: 'Reading',
  listening: 'Listening',
  speaking: 'Speaking',
  writing: 'Writing',
}

// TOEFL 섹션별 시간 (분)
export const TOEFL_SECTION_TIME: Record<string, number> = {
  reading: 35,
  listening: 36,
  speaking: 16,
  writing: 29,
}

// TOEFL 섹션별 만점
export const TOEFL_SECTION_MAX: Record<string, number> = {
  reading: 30,
  listening: 30,
  speaking: 30,
  writing: 30,
}

// TOEFL 총점 계산
export function toeflTotalScore(sectionScores: Record<string, number>) {
  return Object.values(sectionScores).reduce((a, b) => a + b, 0)
}

// TOEFL 등급
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
    // 기본 10가지 유형 (현행)
    factual: 'Factual Information',
    negative_factual: 'Negative Factual',
    inference: 'Inference',
    rhetorical_purpose: 'Rhetorical Purpose',
    vocabulary: 'Vocabulary',
    reference: 'Reference',
    sentence_simplification: 'Sentence Simplification',
    insert_text: 'Insert Text',
    prose_summary: 'Prose Summary (3개 선택)',
    fill_table: 'Fill in a Table (카테고리 분류)',
    // 2026 신규 유형
    complete_the_words: 'Complete the Words (단락 빈칸) ★NEW',
    sentence_completion: 'Sentence Completion (문장 Set 빈칸) ★NEW',
    read_in_daily_life: 'Read in Daily Life (실용문) ★NEW',
  },
  listening: {
    // 기본 유형 (현행)
    gist_content: 'Gist-Content',
    gist_purpose: 'Gist-Purpose',
    detail: 'Detail',
    function: 'Function',
    attitude: 'Attitude',
    organization: 'Organization',
    connecting_content: 'Connecting Content',
    inference: 'Inference',
    // 2026 신규 유형
    choose_response: 'Choose a Response ★NEW',
    announcement: 'Announcement ★NEW',
  },
  speaking: {
    // 기본 4가지 과제 (현행)
    independent: 'Task 1: Independent',
    integrated_read_listen: 'Task 2: Campus (Read+Listen)',
    integrated_read_listen_academic: 'Task 3: Academic (Read+Listen)',
    integrated_listen: 'Task 4: Lecture Summary',
    // 2026 신규 유형
    listen_and_repeat: 'Listen and Repeat ★NEW 2026',
    take_an_interview: 'Take an Interview ★NEW 2026',
  },
  writing: {
    integrated_writing: 'Task 1: Integrated Writing',
    academic_discussion: 'Task 2: Academic Discussion',
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
