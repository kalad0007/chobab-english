import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getUserFromCookie } from '@/lib/supabase/server'
import { deductCredits, refundCredits, getCreditCostFromDB } from '@/lib/plan-guard'

const TOPIC_EN: Record<string, string> = {
  biology: 'Biology', chemistry: 'Chemistry', physics: 'Physics',
  astronomy: 'Astronomy', geology: 'Geology', ecology: 'Ecology',
  history_us: 'American History', history_world: 'World History',
  anthropology: 'Anthropology', psychology: 'Psychology',
  sociology: 'Sociology', economics: 'Economics',
  art_music: 'Art & Music', literature: 'Literature',
  architecture: 'Architecture', environmental: 'Environmental Science',
  linguistics: 'Linguistics', general: 'General Academic',
}

function bandToCefr(d: number) {
  if (d >= 5.0) return 'C1-C2 (TOEFL 100-120)'
  if (d >= 4.0) return 'B2 (TOEFL 80-100)'
  if (d >= 3.0) return 'B1-B2 (TOEFL 60-80)'
  return 'A2-B1 (TOEFL 45-60)'
}

function buildPrompt(word_level: string, count: number, topic: string, difficulty: number, excludeClause: string): string {
  const topicEn = TOPIC_EN[topic] ?? topic

  if (word_level === 'elem_1_2') {
    return `You are an English teacher for Korean elementary school students (grade 1-2, EFL beginners).
Suggest ${count} English words appropriate for Korean grade 1-2 students learning English as a foreign language.
Level: CEFR A1. Focus on: Dolch Pre-Primer and Primer words, basic concrete nouns (cat, dog, ball, cup),
basic action verbs (run, sit, eat, go), basic adjectives (big, small, red, happy).
Words must be: 2-5 letters preferred, immediately recognizable with pictures, used in Korean elementary English curriculum.
Topic: ${topic}. Avoid any abstract concepts, academic words, or words with complex spelling.

Return ONLY a JSON array of words — no definitions, no explanations, just the words:
["word1", "word2", "word3", ...]

Exactly ${count} unique words${excludeClause}`
  }

  if (word_level === 'elem_3_4') {
    return `You are an English teacher for Korean elementary school students (grade 3-4, EFL learners).
Suggest ${count} English words appropriate for Korean grade 3-4 students learning English as a foreign language.
Level: CEFR A1-A2. Fry words 1-300 range. Simple everyday words from Korean 초3-4 English textbook. Basic sentences possible.
Topic: ${topic}.

Return ONLY a JSON array of words — no definitions, no explanations, just the words:
["word1", "word2", "word3", ...]

Exactly ${count} unique words${excludeClause}`
  }

  if (word_level === 'elem_5_6') {
    return `You are an English teacher for Korean elementary school students (grade 5-6, EFL learners).
Suggest ${count} English words appropriate for Korean grade 5-6 students learning English as a foreign language.
Level: CEFR A2. Fry words 300-600 range. Korean 초5-6 English textbook level. Can handle short conversations and simple descriptions.
Topic: ${topic}.

Return ONLY a JSON array of words — no definitions, no explanations, just the words:
["word1", "word2", "word3", ...]

Exactly ${count} unique words${excludeClause}`
  }

  if (word_level === 'middle') {
    return `You are an English teacher for Korean middle school students (EFL learners).
Suggest ${count} English words appropriate for Korean middle school students.
Level: CEFR B1. Fry words 600-1000 range. Korean 중학교 English textbook level. Include some abstract concepts, opinions, feelings.
Slightly below TOEFL level. Topic: ${topic}.

Return ONLY a JSON array of words — no definitions, no explanations, just the words:
["word1", "word2", "word3", ...]

Exactly ${count} unique words${excludeClause}`
  }

  // toefl (default)
  const cefr = bandToCefr(difficulty)
  return `You are a TOEFL vocabulary expert. Generate exactly ${count} important TOEFL vocabulary words for the academic topic: "${topicEn}"

Difficulty level: Band ${difficulty} (${cefr})

Return ONLY a JSON array of words — no definitions, no explanations, just the words:
["word1", "word2", "word3", ...]

Requirements:
- Academic register words that commonly appear in TOEFL reading/listening passages about ${topicEn}
- Appropriate difficulty for ${cefr}
- No proper nouns
- Mix of adjectives, verbs, and nouns
- Words that are frequently paraphrased in TOEFL answer choices
- No extremely common words (like "big", "fast", "new")
- Exactly ${count} unique words${excludeClause}`
}

export async function POST(req: NextRequest) {
  const user = await getUserFromCookie()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { topic, count = 20, difficulty = 3.0, word_level = 'toefl', excludeWords = [] } = await req.json()
  if (!topic) return NextResponse.json({ error: 'topic required' }, { status: 400 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Anthropic API key not configured' }, { status: 500 })

  const cost = await getCreditCostFromDB('vocab_per_word', count)
  const { allowed, remaining } = await deductCredits(user.id, cost, '어휘 추천 생성')
  if (!allowed) {
    return NextResponse.json({ error: '크레딧이 부족합니다', remaining }, { status: 403 })
  }

  try {
    const client = new Anthropic({ apiKey })

    const excludeClause = excludeWords.length > 0
      ? `\n\nDo NOT include any of these already-existing words: ${excludeWords.join(', ')}`
      : ''

    const prompt = buildPrompt(word_level, count, topic, difficulty, excludeClause)

    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = (msg.content[0] as { type: string; text: string }).text?.trim()

    try {
      const arr = JSON.parse(raw)
      if (!Array.isArray(arr)) throw new Error('not array')
      return NextResponse.json({ words: arr.slice(0, count) })
    } catch {
      const match = raw.match(/\[[\s\S]*\]/)
      if (match) {
        try {
          const arr = JSON.parse(match[0])
          return NextResponse.json({ words: arr.slice(0, count) })
        } catch { /* fall through */ }
      }
      return NextResponse.json({ error: 'AI 응답 파싱 실패', raw }, { status: 500 })
    }
  } catch (err) {
    await refundCredits(user.id, cost)
    throw err
  }
}
