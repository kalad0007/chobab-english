import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getUserFromCookie } from '@/lib/supabase/server'

// 학생 스피킹 녹음 → Supabase Storage 업로드
export async function POST(req: NextRequest) {
  const user = await getUserFromCookie()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { audioBase64, mimeType, submissionId, questionId } = await req.json()
  if (!audioBase64) return NextResponse.json({ error: 'audioBase64 required' }, { status: 400 })

  const audioBuffer = Buffer.from(audioBase64, 'base64')
  const ext = mimeType?.includes('mp4') ? 'mp4' : 'webm'
  const fileName = `speaking/${user.id}_${submissionId}_${questionId}_${Date.now()}.${ext}`

  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error: uploadError } = await supabase.storage
    .from('question-audio')
    .upload(fileName, audioBuffer, {
      contentType: mimeType ?? 'audio/webm',
      upsert: true,
    })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage
    .from('question-audio')
    .getPublicUrl(fileName)

  return NextResponse.json({ audioUrl: publicUrl })
}
