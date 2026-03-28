import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getUserFromCookie } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const user = await getUserFromCookie()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { topic, topicLabel, difficulty, paraCount = 4 } = await req.json()
  if (!topic) return NextResponse.json({ error: 'topic required' }, { status: 400 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'API key missing' }, { status: 500 })

  const client = new Anthropic({ apiKey })

  function bandToCefr(d: number) {
    if (d >= 5.0) return 'C1-C2 (TOEFL 100-120, very advanced academic)'
    if (d >= 4.0) return 'B2 (TOEFL 80-100, upper-intermediate academic)'
    if (d >= 3.0) return 'B1-B2 (TOEFL 60-80, intermediate academic)'
    return 'A2-B1 (TOEFL 45-60, lower-intermediate)'
  }

  const cefr = bandToCefr(difficulty)

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `Write a TOEFL-style academic reading passage about "${topicLabel ?? topic}".

Requirements:
- Exactly ${paraCount} paragraphs
- Difficulty: ${cefr}
- Academic register, similar to real TOEFL reading passages
- Each paragraph 60-120 words
- Include a clear title
- NO question prompts, NO headers per paragraph, just continuous prose
- The passage should be cohesive with a clear topic development

Return ONLY valid JSON (no markdown, no code blocks):
{
  "title": "The passage title here",
  "paragraphs": [
    "First paragraph text...",
    "Second paragraph text...",
    "Third paragraph text...",
    "Fourth paragraph text..."
  ]
}`,
    }],
  })

  const raw = (msg.content[0] as { type: string; text: string }).text?.trim()
  try {
    const parsed = JSON.parse(raw)
    return NextResponse.json(parsed)
  } catch {
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) {
      try { return NextResponse.json(JSON.parse(match[0])) } catch { /* fall */ }
    }
    return NextResponse.json({ error: 'AI 응답 파싱 실패' }, { status: 500 })
  }
}
