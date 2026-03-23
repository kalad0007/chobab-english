import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient, getUserFromCookie } from '@/lib/supabase/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const CATEGORY_PROMPTS: Record<string, string> = {
  grammar:    '영어 문법 (시제, 조동사, 관계사, 수동태 등)',
  vocabulary: '영어 어휘 (동의어, 반의어, 문맥상 의미)',
  reading:    '영어 독해 (주제, 요지, 세부내용, 빈칸)',
  writing:    '영어 쓰기 (문장 배열, 문단 구성)',
  cloze:      '영어 빈칸 추론 (연결사, 문맥에 맞는 표현)',
  ordering:   '문장/문단 순서 배열',
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const user = await getUserFromCookie()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { category, difficulty, count, topic } = await req.json()

  const categoryDesc = CATEGORY_PROMPTS[category] ?? category
  const difficultyDesc = ['', '매우 쉬움(중학교 1학년)', '쉬움(중학교 2-3학년)', '보통(고등학교 1학년)', '어려움(고등학교 2학년)', '매우 어려움(수능 수준)'][difficulty]
  const topicDesc = topic ? `주제/소재: ${topic}` : ''

  const prompt = `당신은 한국 중고등학교 영어 교사입니다. 다음 조건에 맞는 영어 객관식 5지선다 문제를 ${count}개 생성해주세요.

조건:
- 영역: ${categoryDesc}
- 난이도: ${difficultyDesc}
- ${topicDesc}
- 한국 수능/내신 스타일로 출제
- 각 문제는 명확한 정답이 있어야 함

반드시 다음 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{
  "questions": [
    {
      "content": "문제 본문 (한국어로 질문)",
      "passage": "지문 (독해 문제인 경우, 없으면 null)",
      "options": [
        {"num": 1, "text": "보기 내용"},
        {"num": 2, "text": "보기 내용"},
        {"num": 3, "text": "보기 내용"},
        {"num": 4, "text": "보기 내용"},
        {"num": 5, "text": "보기 내용"}
      ],
      "answer": "정답 번호 (1-5 숫자)",
      "explanation": "정답 해설 (한국어)",
      "category": "${category}",
      "difficulty": ${difficulty}
    }
  ]
}`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''

  // JSON 파싱 (```json ... ``` 블록 처리)
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/({[\s\S]*})/)
  const jsonStr = jsonMatch ? jsonMatch[1] ?? jsonMatch[0] : text

  const parsed = JSON.parse(jsonStr)
  return NextResponse.json(parsed)
}
