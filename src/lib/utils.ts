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

// 카테고리 한국어 변환
export const CATEGORY_LABELS: Record<string, string> = {
  grammar: '문법',
  vocabulary: '어휘',
  reading: '독해',
  writing: '쓰기',
  cloze: '빈칸',
  ordering: '순서/삽입',
  listening: '리스닝',
  speaking: '스피킹',
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

// 레벨 타이틀
export function levelTitle(level: number) {
  const titles = [
    'Beginner', 'Word Learner', 'Grammar Student', 'Reading Rookie',
    'Sentence Builder', 'Vocabulary Seeker', 'Grammar Warrior',
    'Reading Expert', 'Writing Master', 'English Champion',
  ]
  return titles[Math.min(level - 1, titles.length - 1)]
}
