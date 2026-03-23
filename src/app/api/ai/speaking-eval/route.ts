import { NextRequest, NextResponse } from 'next/server'
import { getUserFromCookie } from '@/lib/supabase/server'

// Gemini 스피킹 평가 API
// audioUrl: Supabase Storage 공개 URL (서버에서 fetch)
// prompt: 문제/평가 기준
export async function POST(req: NextRequest) {
  const user = await getUserFromCookie()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { audioUrl, audioBase64: directBase64, mimeType, prompt } = await req.json()

  let audioBase64: string
  let resolvedMimeType = mimeType ?? 'audio/webm'

  if (audioUrl) {
    // 서버에서 오디오 파일 fetch → base64 변환
    const audioRes = await fetch(audioUrl)
    if (!audioRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch audio file' }, { status: 500 })
    }
    const arrayBuffer = await audioRes.arrayBuffer()
    audioBase64 = Buffer.from(arrayBuffer).toString('base64')
    // URL에서 mime type 추정
    if (audioUrl.endsWith('.mp4')) resolvedMimeType = 'audio/mp4'
    else if (audioUrl.endsWith('.webm')) resolvedMimeType = 'audio/webm'
  } else if (directBase64) {
    audioBase64 = directBase64
  } else {
    return NextResponse.json({ error: 'audioUrl or audioBase64 required' }, { status: 400 })
  }

  if (!audioBase64) return NextResponse.json({ error: 'No audio data' }, { status: 400 })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 })

  const evalPrompt = `You are an English speaking evaluator for Korean middle/high school students.

Question/Task: ${prompt ?? 'General English speaking'}

Please evaluate the student's spoken English response based on:
1. Pronunciation & Fluency (발음/유창성): 0-25점
2. Grammar & Vocabulary (문법/어휘): 0-25점
3. Content & Relevance (내용/관련성): 0-25점
4. Confidence & Expression (자신감/표현): 0-25점

Respond in JSON format ONLY:
{
  "totalScore": <0-100>,
  "pronunciation": <0-25>,
  "grammar": <0-25>,
  "content": <0-25>,
  "confidence": <0-25>,
  "feedback": "<Korean feedback, 2-3 sentences>",
  "strengths": "<Korean, what was good>",
  "improvements": "<Korean, what to improve>"
}`

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: mimeType ?? 'audio/webm',
                  data: audioBase64,
                },
              },
              { text: evalPrompt },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
        },
      }),
    }
  )

  if (!geminiRes.ok) {
    const errText = await geminiRes.text()
    console.error('Gemini eval error:', errText)
    return NextResponse.json({ error: 'Evaluation failed', detail: errText }, { status: 500 })
  }

  const data = await geminiRes.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'

  try {
    const result = JSON.parse(text)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Failed to parse evaluation result', raw: text }, { status: 500 })
  }
}
