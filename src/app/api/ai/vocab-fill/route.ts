import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getUserFromCookie } from '@/lib/supabase/server'

const TOPIC_OPTIONS = [
  'biology','chemistry','physics','astronomy','geology','ecology',
  'history_us','history_world','anthropology','psychology','sociology',
  'economics','art_music','literature','architecture','environmental',
  'linguistics','general',
]

function buildPrompt(word: string, word_level: string): string {
  if (word_level === 'elem_1_2') {
    return `You are an English teacher for Korean grade 1-2 elementary school students. Generate a complete vocab card for the English word: "${word}"

Return ONLY valid JSON (no markdown, no code blocks):
{
  "part_of_speech": "noun",
  "definition_ko": "사과",
  "definition_en": "a round red fruit",
  "synonyms": [],
  "antonyms": [],
  "idioms": [],
  "topic_category": "general",
  "example_sentence": "I *eat* an apple.",
  "example_sentence_ko": "나는 사과를 *먹어요*.",
  "morphemes": null,
  "collocations": ["eat an apple", "red apple"]
}

Rules:
- part_of_speech: noun | verb | adjective | adverb | preposition | conjunction | phrase
- definition_ko: 8자 이내, extremely simple Korean translation for grade 1-2 students
- definition_en: 3-5 word simple English definition using only the most basic words
- synonyms: 0-1 synonyms that grade 1-2 students would know (empty array [] if none)
- antonyms: 0-1 antonyms (empty array [] if none natural)
- idioms: always empty array []
- topic_category: pick ONE from: ${TOPIC_OPTIONS.join(', ')}
- example_sentence: 4-6 word very simple sentence. Mark the target word with *asterisks*. Use " / " sparingly only if needed.
- example_sentence_ko: Korean direct translation. Wrap the Korean equivalent of the target word with *asterisks*.
- morphemes: ALWAYS return null
- collocations: 1-2 everyday collocations that include the target word`
  }

  if (word_level === 'elem_3_4') {
    return `You are an English teacher for Korean grade 3-4 elementary school students. Generate a complete vocab card for the English word: "${word}"

Return ONLY valid JSON (no markdown, no code blocks):
{
  "part_of_speech": "noun",
  "definition_ko": "사과",
  "definition_en": "a round fruit with red or green skin",
  "synonyms": ["fruit"],
  "antonyms": [],
  "idioms": [],
  "topic_category": "general",
  "example_sentence": "I eat *an apple* / every morning.",
  "example_sentence_ko": "나는 *사과를* 먹어요 / 매일 아침.",
  "morphemes": null,
  "collocations": ["eat an apple", "apple juice", "red apple"]
}

Rules:
- part_of_speech: noun | verb | adjective | adverb | preposition | conjunction | phrase
- definition_ko: 10자 이내, simple Korean translation for grade 3-4 students
- definition_en: 5-8 word simple English definition
- synonyms: 1-2 simple synonyms (empty array [] if none)
- antonyms: 0-1 antonyms (empty array [] if none natural)
- idioms: always empty array []
- topic_category: pick ONE from: ${TOPIC_OPTIONS.join(', ')}
- example_sentence: 6-10 word simple sentence. Mark the target word with *asterisks*. Add chunk breaks " / " at natural phrase boundaries.
- example_sentence_ko: Korean direct translation matching the EXACT same chunk breaks " / " as example_sentence. Wrap the Korean equivalent of the target word with *asterisks*.
- morphemes: ALWAYS return null
- collocations: 2-3 everyday collocations that include the target word`
  }

  if (word_level === 'elem_5_6') {
    return `You are an English teacher for Korean grade 5-6 elementary school students. Generate a complete vocab card for the English word: "${word}"

Return ONLY valid JSON (no markdown, no code blocks):
{
  "part_of_speech": "noun",
  "definition_ko": "사과, 과일",
  "definition_en": "a round fruit with red or green skin that grows on trees",
  "synonyms": ["fruit", "snack"],
  "antonyms": [],
  "idioms": [],
  "topic_category": "general",
  "example_sentence": "She picks *a fresh apple* / from the tree / every morning.",
  "example_sentence_ko": "그녀는 *신선한 사과를* 딴다 / 나무에서 / 매일 아침.",
  "morphemes": null,
  "collocations": ["apple juice", "apple tree", "fresh apple"]
}

Rules:
- part_of_speech: noun | verb | adjective | adverb | preposition | conjunction | phrase
- definition_ko: 15자 이내, clear Korean translation for grade 5-6 students
- definition_en: 8-12 word English definition using clear everyday language
- synonyms: 2-3 synonyms that grade 5-6 students would know (empty array [] if none)
- antonyms: 0-2 antonyms (empty array [] if none natural)
- idioms: 0-1 very simple expressions (empty array [] if none natural)
- topic_category: pick ONE from: ${TOPIC_OPTIONS.join(', ')}
- example_sentence: 10-15 word simple sentence. Mark the target word with *asterisks*. Add chunk breaks " / " at natural phrase boundaries.
- example_sentence_ko: Korean direct translation matching the EXACT same chunk breaks " / " as example_sentence. Wrap the Korean equivalent of the target word with *asterisks*.
- morphemes: ALWAYS return null
- collocations: 2-3 everyday collocations that include the target word`
  }

  if (word_level === 'middle') {
    return `You are an English teacher for Korean middle school students. Generate a complete vocab card for the English word: "${word}"

Return ONLY valid JSON (no markdown, no code blocks):
{
  "part_of_speech": "adjective",
  "definition_ko": "중요한, 필수적인",
  "definition_en": "very important and necessary for something",
  "synonyms": ["important", "necessary", "essential", "vital"],
  "antonyms": ["unimportant", "unnecessary"],
  "idioms": [],
  "topic_category": "general",
  "example_sentence": "Exercise is *essential* / for good health / and a happy life.",
  "example_sentence_ko": "운동은 *필수적이다* / 건강을 위해 / 그리고 행복한 삶을 위해.",
  "morphemes": null,
  "collocations": ["essential for", "essential part", "essential skill", "absolutely essential"]
}

Rules:
- part_of_speech: noun | verb | adjective | adverb | preposition | conjunction | phrase
- definition_ko: 20자 이내, clear Korean translation for middle school students
- definition_en: 10-15 word English definition using clear language
- synonyms: 3-4 synonyms at middle school level (empty array [] if none)
- antonyms: 1-2 antonyms (empty array [] if none natural)
- idioms: 0-2 simple expressions or phrasal verbs using this word (empty array [] if none natural)
- topic_category: pick ONE from: ${TOPIC_OPTIONS.join(', ')}
- example_sentence: 12-18 word sentence. Mark the target word with *asterisks*. Add chunk breaks " / " at natural phrase boundaries.
- example_sentence_ko: Korean direct translation matching the EXACT same chunk breaks " / " as example_sentence. Wrap the Korean equivalent of the target word with *asterisks*.
- morphemes: optional — return null for most words; only include if word has obvious Latin/Greek roots that middle schoolers would benefit from
- collocations: 3-4 natural collocations that include the target word`
  }

  // toefl (default)
  return `You are a TOEFL vocabulary expert. Generate a complete vocab card for the English word: "${word}"

Return ONLY valid JSON (no markdown, no code blocks):
{
  "part_of_speech": "adjective",
  "definition_ko": "없어서는 안 될, 필수적인",
  "definition_en": "absolutely necessary; impossible to be without",
  "synonyms": ["essential","crucial","vital","necessary","imperative"],
  "antonyms": ["dispensable","unnecessary","optional"],
  "idioms": ["indispensable to", "prove indispensable"],
  "topic_category": "general",
  "example_sentence": "Clean water is *indispensable* / for the survival / of all living organisms.",
  "example_sentence_ko": "깨끗한 물은 *없어서는 안 된다* / 생존을 위해 / 모든 살아있는 생명체에게.",
  "morphemes": { "prefix": "in", "prefix_meaning": "not", "root": "dispens", "root_meaning": "weigh out", "suffix": "able", "suffix_meaning": "capable of" },
  "collocations": ["absolutely indispensable", "indispensable role", "indispensable part of"]
}

Rules:
- part_of_speech: noun | verb | adjective | adverb | preposition | conjunction | phrase
- definition_ko: concise Korean translation (up to 20 chars)
- definition_en: one clear English definition
- synonyms: exactly 3-5 TOEFL-level synonyms commonly used in academic paraphrasing
- antonyms: 1-3 antonyms (empty array [] if none natural)
- idioms: 0-3 common idioms, phrasal verbs, or fixed expressions using this word (empty array [] if none natural). Include the word in context, e.g. "take off", "run out of time".
- topic_category: pick ONE from: ${TOPIC_OPTIONS.join(', ')}
- example_sentence: 15-25 word academic-register sentence. Mark the target word with *asterisks*. Add chunk breaks " / " (space-slash-space) at natural phrase boundaries (subject / predicate / modifier groups).
- example_sentence_ko: Korean direct translation matching the EXACT same chunk breaks " / " as example_sentence. Wrap the Korean equivalent of the target word with *asterisks*.
- morphemes: etymological breakdown of the word. Return an object with keys: "prefix", "prefix_meaning", "root", "root_meaning", "suffix", "suffix_meaning". Omit any key that does not apply (e.g. no prefix means no "prefix"/"prefix_meaning" keys). Return null for monosyllabic words, native English words, or words without clear Latin/Greek/French etymology.
- collocations: 3-5 natural English collocations (word combinations frequently used together) that include the target word. Focus on academic and TOEFL-relevant expressions.`
}

export async function POST(req: NextRequest) {
  const user = await getUserFromCookie()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { word, word_level = 'toefl' } = await req.json()
  if (!word?.trim()) return NextResponse.json({ error: 'word required' }, { status: 400 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Anthropic API key not configured' }, { status: 500 })

  const client = new Anthropic({ apiKey })

  const prompt = buildPrompt(word.trim(), word_level)

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = (msg.content[0] as { type: string; text: string }).text?.trim()
  try {
    const parsed = JSON.parse(raw)
    return NextResponse.json(parsed)
  } catch {
    // Try to extract JSON from response
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        return NextResponse.json(JSON.parse(match[0]))
      } catch { /* fall through */ }
    }
    return NextResponse.json({ error: 'AI 응답 파싱 실패', raw }, { status: 500 })
  }
}
