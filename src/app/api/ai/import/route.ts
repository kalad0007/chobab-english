import { NextRequest, NextResponse } from 'next/server'
import { getUserFromCookie } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60 // Vercel Pro: 60초 타임아웃 지원

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromCookie()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized (Please log in again)' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    const mimeType = file.type
    if (!mimeType.startsWith('image/') && mimeType !== 'application/pdf') {
      return NextResponse.json({ error: '올바른 이미지 또는 PDF 파일을 업로드해주세요.' }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Anthropic API 키가 설정되지 않았습니다.' }, { status: 500 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64Data = buffer.toString('base64')

    const anthropic = new Anthropic({
      apiKey: apiKey,
    })

    const prompt = `You are an expert TOEFL question extractor. 
Analyze the provided document (image or PDF) and extract the questions.
Format the output as a valid JSON array of objects.
EACH object MUST match this JSON schema exactly:
{
  "category": "reading" | "listening" | "speaking" | "writing" | "grammar" | "vocabulary",
  "difficulty": 1 (easiest), 2, 3, 4, or 5 (hardest),
  "content": "The actual question text",
  "passage": "The associated reading passage or transcript, if any (null if none)",
  "options": [ { "num": 1, "text": "Option A" }, { "num": 2, "text": "Option B" }, ... ] (Provide options for multiple choice, null for essay/short answer),
  "answer": "The correct option number (e.g., '1') or the answer text for essay",
  "explanation": "Detailed explanation in Korean for the correct answer"
}

IMPORTANT: 
1. DO NOT include any markdown blocks (like \`\`\`json) in the entire output.
2. Return ONLY the raw JSON array string.
3. Make sure the output is a valid JSON array. For example: [{"category": "reading", ...}]`

    const contentBlock: any = {
      type: mimeType === 'application/pdf' ? 'document' : 'image',
      source: {
        type: 'base64',
        media_type: mimeType,
        data: base64Data
      }
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      temperature: 0.1,
      messages: [
        {
          role: 'user',
          content: [
            contentBlock,
            { type: 'text', text: prompt }
          ]
        }
      ]
    }, {
      // PDF 지원을 위한 베타 헤더 추가
      headers: {
        'anthropic-beta': 'pdfs-2024-09-25'
      }
    })

    let responseText = ''
    if (message.content[0].type === 'text') {
      responseText = message.content[0].text
    } else {
      responseText = '[]'
    }

    responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    let questions = []
    try {
      questions = JSON.parse(responseText)
    } catch (e) {
      console.error('Failed to parse Anthropic JSON:', responseText)
      throw new Error('AI가 올바른 JSON 형식을 반환하지 않았습니다.')
    }

    return NextResponse.json({ questions })
  } catch (err: any) {
    console.error('Import Error Full:', err)
    return NextResponse.json({ error: err.message || '서버 오류 발생' }, { status: 500 })
  }
}
