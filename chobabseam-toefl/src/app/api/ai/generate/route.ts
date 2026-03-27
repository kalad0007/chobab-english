import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient, getUserFromCookie } from '@/lib/supabase/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SECTION_PROMPTS: Record<string, string> = {
  reading: `TOEFL iBT Reading 섹션 문제를 생성하세요.
- 700단어 이상의 학술적 영어 지문 (대학 교재 수준)
- 주제: 자연과학, 사회과학, 인문학, 역사 등
- 문제 유형: 사실 확인(Factual), 부정 사실(Negative Factual), 추론(Inference), 어휘(Vocabulary), 문장 삽입(Sentence Insertion), 요약(Summary)
- 4지선다 (A, B, C, D)`,

  listening: `TOEFL iBT Listening 섹션 문제를 생성하세요.
- 강의(Lecture) 또는 대화(Conversation) 스크립트 작성
- 강의: 대학 수업 형태 (교수가 학생들에게 설명)
- 대화: 캠퍼스 상황 (학생-교수, 학생-직원)
- 문제 유형: 주제(Gist-Content), 목적(Gist-Purpose), 세부사항(Detail), 태도(Attitude), 기능(Function), 구조(Organization)
- 4지선다`,

  speaking: `TOEFL iBT Speaking 섹션 과제를 생성하세요.
- Task 1 (Independent): 개인적 경험/의견 묻기 (45초 준비, 45초 답변)
- Task 2 (Integrated): 캠퍼스 공지 + 학생 대화 → 요약
- Task 3 (Integrated): 학술 지문 + 강의 → 요약
- Task 4 (Integrated): 강의 요약 (학술 주제)
- 루브릭: Delivery, Language Use, Topic Development (0-4점)`,

  writing: `TOEFL iBT Writing 섹션 과제를 생성하세요.
- Integrated Writing: 학술 지문(250단어) + 강의 스크립트 → 요약 에세이 (20분)
- Academic Discussion: 교수 질문 + 학생 2명 의견 → 자신의 의견 작성 (10분)
- 루브릭: 내용, 구성, 언어 사용 (0-5점)`,
}

const DIFFICULTY_DESC: Record<number, string> = {
  1: 'TOEFL 입문 (50-60점 수준)',
  2: 'TOEFL 기초 (60-80점 수준)',
  3: 'TOEFL 중급 (80-90점 수준)',
  4: 'TOEFL 중상급 (90-100점 수준)',
  5: 'TOEFL 고급 (100-120점 수준)',
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const user = await getUserFromCookie()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { category, difficulty, count, topic } = await req.json()

  const sectionDesc = SECTION_PROMPTS[category] ?? category
  const difficultyDesc = DIFFICULTY_DESC[difficulty] ?? ''
  const topicDesc = topic ? `특정 주제/소재: ${topic}` : ''

  let prompt = ''

  if (category === 'speaking') {
    prompt = `당신은 TOEFL iBT Speaking 전문 출제자입니다.

${sectionDesc}

조건:
- 난이도: ${difficultyDesc}
- ${topicDesc}
- ${count}개의 Speaking 과제를 생성

반드시 다음 JSON 형식으로만 응답하세요:
{
  "questions": [
    {
      "content": "Task 지시문 (한국어 번역 포함)",
      "passage": "읽기 지문 (Integrated Task인 경우, Independent는 null)",
      "options": null,
      "answer": "모범 답변 예시 (영어)",
      "explanation": "채점 포인트 및 해설 (한국어)",
      "category": "speaking",
      "difficulty": ${difficulty},
      "speaking_prompt": "학생이 읽을 영어 프롬프트",
      "audio_script": "강의/대화 오디오 스크립트 (Integrated Task인 경우, 없으면 null)"
    }
  ]
}`
  } else if (category === 'writing') {
    prompt = `당신은 TOEFL iBT Writing 전문 출제자입니다.

${sectionDesc}

조건:
- 난이도: ${difficultyDesc}
- ${topicDesc}
- ${count}개의 Writing 과제를 생성

반드시 다음 JSON 형식으로만 응답하세요:
{
  "questions": [
    {
      "content": "Task 지시문 (한국어 번역 포함)",
      "passage": "읽기 지문 (Integrated인 경우) 또는 토론 배경 (Academic Discussion인 경우)",
      "options": null,
      "answer": "모범 답변 예시 (영어, 300단어 이상)",
      "explanation": "채점 포인트 및 해설 (한국어)",
      "category": "writing",
      "difficulty": ${difficulty},
      "audio_script": "강의 오디오 스크립트 (Integrated인 경우, 없으면 null)"
    }
  ]
}`
  } else {
    // Reading & Listening → 객관식
    prompt = `당신은 TOEFL iBT 전문 출제자입니다.

${sectionDesc}

조건:
- 난이도: ${difficultyDesc}
- ${topicDesc}
- ${count}개의 문제를 생성
- 하나의 지문에 대해 여러 문제를 만들어주세요

반드시 다음 JSON 형식으로만 응답하세요:
{
  "questions": [
    {
      "content": "문제 본문 (영어, 한국어 번역 병기)",
      "passage": "지문 (Reading: 학술 지문 700단어+, Listening: 강의/대화 스크립트)",
      "options": [
        {"num": 1, "text": "보기 A (영어)"},
        {"num": 2, "text": "보기 B (영어)"},
        {"num": 3, "text": "보기 C (영어)"},
        {"num": 4, "text": "보기 D (영어)"}
      ],
      "answer": "정답 번호 (1-4)",
      "explanation": "정답 해설 (한국어, 오답 분석 포함)",
      "category": "${category}",
      "difficulty": ${difficulty}${category === 'listening' ? ',\n      "audio_script": "오디오 스크립트 (강의/대화 전체)"' : ''}
    }
  ]
}`
  }

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''

  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/({[\s\S]*})/)
  const jsonStr = jsonMatch ? jsonMatch[1] ?? jsonMatch[0] : text

  const parsed = JSON.parse(jsonStr)
  return NextResponse.json(parsed)
}
