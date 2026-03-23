import { NextRequest, NextResponse } from 'next/server'
import { getUserFromCookie } from '@/lib/supabase/server'

export const maxDuration = 60 // Vercel Pro: 60초 타임아웃

export async function POST(req: NextRequest) {
  const user = await getUserFromCookie()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { audioUrl, prompt } = await req.json()
  if (!audioUrl) return NextResponse.json({ error: 'audioUrl required' }, { status: 400 })

  // Google Cloud 키 우선 사용 (할당량 제한 없음), 없으면 Gemini AI Studio 키
  const apiKey = process.env.GOOGLE_TTS_API_KEY ?? process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'API key not configured' }, { status: 500 })

  // 1단계: 오디오 파일 fetch
  const audioRes = await fetch(audioUrl)
  if (!audioRes.ok) {
    return NextResponse.json({ error: `Failed to fetch audio: ${audioRes.status}` }, { status: 500 })
  }
  const audioBuffer = Buffer.from(await audioRes.arrayBuffer())
  const mimeType = audioUrl.endsWith('.mp4') ? 'audio/mp4' : 'audio/webm'

  // 2단계: Gemini Files API multipart 업로드
  const boundary = `boundary${Date.now()}`
  const metaJson = JSON.stringify({ file: { displayName: 'student-recording', mimeType } })
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=utf-8\r\n\r\n${metaJson}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
    audioBuffer,
    Buffer.from(`\r\n--${boundary}--`),
  ])

  const uploadRes = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?uploadType=multipart&key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    }
  )

  if (!uploadRes.ok) {
    const errText = await uploadRes.text()
    console.error('Files API upload error:', errText)
    return NextResponse.json({ error: 'Upload failed', detail: errText }, { status: 500 })
  }

  const uploadData = await uploadRes.json()
  const fileUri: string = uploadData?.file?.uri
  const fileMimeType: string = uploadData?.file?.mimeType ?? mimeType

  if (!fileUri) {
    return NextResponse.json({ error: 'No fileUri returned', raw: uploadData }, { status: 500 })
  }

  // 3단계: 파일 처리 대기 (ACTIVE 상태 확인)
  let fileState = uploadData?.file?.state ?? 'PROCESSING'
  let retries = 0
  while (fileState === 'PROCESSING' && retries < 10) {
    await new Promise(r => setTimeout(r, 1000))
    const statusRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/files/${uploadData.file.name}?key=${apiKey}`
    )
    const statusData = await statusRes.json()
    fileState = statusData?.state ?? 'ACTIVE'
    retries++
  }

  // 4단계: 평가 요청
  const evalPrompt = `You are an English speaking evaluator for Korean middle/high school students.
Task: ${prompt ?? 'General English speaking'}

Evaluate the spoken English on:
1. Pronunciation & Fluency: 0-25
2. Grammar & Vocabulary: 0-25
3. Content & Relevance: 0-25
4. Confidence & Expression: 0-25

Reply in JSON only (no markdown):
{"totalScore":0,"pronunciation":0,"grammar":0,"content":0,"confidence":0,"feedback":"한국어 피드백","strengths":"한국어 장점","improvements":"한국어 개선점"}`

  const evalRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-04-17:generateContent?key=${apiKey}`,
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
      }),
    }
  )

  // 5단계: 파일 삭제 (비동기)
  const fileName = uploadData?.file?.name
  if (fileName) {
    fetch(`https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`, {
      method: 'DELETE',
    }).catch(() => {})
  }

  if (!evalRes.ok) {
    const errText = await evalRes.text()
    console.error('Gemini eval error:', errText)
    return NextResponse.json({ error: 'Evaluation failed', detail: errText }, { status: 500 })
  }

  const evalData = await evalRes.json()
  const text: string = evalData?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

  if (!text) {
    return NextResponse.json({ error: 'Empty response from Gemini', raw: evalData }, { status: 500 })
  }

  try {
    const clean = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    const result = JSON.parse(clean)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'JSON parse failed', raw: text }, { status: 500 })
  }
}
