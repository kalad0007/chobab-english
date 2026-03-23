import { NextRequest, NextResponse } from 'next/server'
import { getUserFromCookie } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const user = await getUserFromCookie()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { audioUrl, prompt } = await req.json()
  if (!audioUrl) return NextResponse.json({ error: 'audioUrl required' }, { status: 400 })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 })

  // 1단계: Supabase Storage에서 오디오 파일 fetch
  const audioRes = await fetch(audioUrl)
  if (!audioRes.ok) {
    return NextResponse.json({ error: 'Failed to fetch audio file' }, { status: 500 })
  }
  const audioBuffer = Buffer.from(await audioRes.arrayBuffer())
  const mimeType = audioUrl.endsWith('.mp4') ? 'audio/mp4' : 'audio/webm'

  // 2단계: Gemini Files API에 업로드 (WebM 지원)
  const uploadRes = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Command': 'start, upload, finalize',
        'X-Goog-Upload-Header-Content-Length': String(audioBuffer.length),
        'X-Goog-Upload-Header-Content-Type': mimeType,
        'Content-Type': mimeType,
      },
      body: audioBuffer,
    }
  )

  if (!uploadRes.ok) {
    const errText = await uploadRes.text()
    console.error('Gemini Files upload error:', errText)
    return NextResponse.json({ error: 'Audio upload failed', detail: errText }, { status: 500 })
  }

  const uploadData = await uploadRes.json()
  const fileUri: string = uploadData?.file?.uri
  const fileMimeType: string = uploadData?.file?.mimeType ?? mimeType

  if (!fileUri) {
    return NextResponse.json({ error: 'No file URI from upload', raw: uploadData }, { status: 500 })
  }

  // 3단계: 업로드된 파일로 평가 요청
  const evalPrompt = `You are an English speaking evaluator for Korean middle/high school students.

Question/Task: ${prompt ?? 'General English speaking'}

Please evaluate the student's spoken English response based on:
1. Pronunciation & Fluency (발음/유창성): 0-25점
2. Grammar & Vocabulary (문법/어휘): 0-25점
3. Content & Relevance (내용/관련성): 0-25점
4. Confidence & Expression (자신감/표현): 0-25점

Respond in JSON format ONLY (no markdown, no code block):
{"totalScore":0,"pronunciation":0,"grammar":0,"content":0,"confidence":0,"feedback":"Korean feedback","strengths":"Korean strengths","improvements":"Korean improvements"}`

  const evalRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { fileData: { mimeType: fileMimeType, fileUri } },
            { text: evalPrompt },
          ],
        }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    }
  )

  // 4단계: 사용 후 파일 삭제 (비동기, 실패해도 무시)
  const fileName = fileUri.split('/').pop()
  if (fileName) {
    fetch(`https://generativelanguage.googleapis.com/v1beta/files/${fileName}?key=${apiKey}`, {
      method: 'DELETE',
    }).catch(() => {})
  }

  if (!evalRes.ok) {
    const errText = await evalRes.text()
    console.error('Gemini eval error:', errText)
    return NextResponse.json({ error: 'Evaluation failed', detail: errText }, { status: 500 })
  }

  const evalData = await evalRes.json()
  const text: string = evalData?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'

  try {
    // JSON 파싱 (```json 블록 대응)
    const clean = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    const result = JSON.parse(clean)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Failed to parse evaluation result', raw: text }, { status: 500 })
  }
}
