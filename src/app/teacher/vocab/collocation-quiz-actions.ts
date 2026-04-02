'use server'

import { createAdminClient, getUserFromCookie } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createCollocationQuiz(payload: {
  setId: string
  title: string
  orderNum: number
  classIds: string[]
  items: { wordId: string; collocation: string; orderNum: number }[]
}) {
  const user = await getUserFromCookie()
  if (!user) return { error: '로그인이 필요합니다.' }

  const admin = createAdminClient()

  // 퀴즈 생성
  const { data: quiz, error: quizError } = await admin
    .from('collocation_quizzes')
    .insert({
      teacher_id: user.id,
      set_id: payload.setId,
      title: payload.title,
      order_num: payload.orderNum,
      status: payload.classIds.length > 0 ? 'published' : 'draft',
    })
    .select('id')
    .single()

  if (quizError || !quiz) return { error: quizError?.message ?? '퀴즈 생성 실패' }

  // 아이템 저장
  if (payload.items.length > 0) {
    const { error: itemsError } = await admin.from('collocation_quiz_items').insert(
      payload.items.map(item => ({
        quiz_id: quiz.id,
        word_id: item.wordId,
        collocation: item.collocation,
        order_num: item.orderNum,
      }))
    )
    if (itemsError) return { error: itemsError.message }
  }

  // 반 배포
  if (payload.classIds.length > 0) {
    await admin.from('collocation_quiz_classes').insert(
      payload.classIds.map(cid => ({ quiz_id: quiz.id, class_id: cid }))
    )
  }

  revalidatePath('/teacher/vocab/collocation-quiz')
  return { id: quiz.id }
}

export async function deleteCollocationQuiz(quizId: string) {
  const user = await getUserFromCookie()
  if (!user) return { error: '로그인이 필요합니다.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('collocation_quizzes')
    .delete()
    .eq('id', quizId)
    .eq('teacher_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/teacher/vocab/collocation-quiz')
  return {}
}

export async function toggleCollocationQuizPublish(quizId: string, classIds: string[]) {
  const user = await getUserFromCookie()
  if (!user) return { error: '로그인이 필요합니다.' }

  const admin = createAdminClient()
  const newStatus = classIds.length > 0 ? 'published' : 'draft'

  await admin.from('collocation_quizzes')
    .update({ status: newStatus })
    .eq('id', quizId)
    .eq('teacher_id', user.id)

  await admin.from('collocation_quiz_classes').delete().eq('quiz_id', quizId)
  if (classIds.length > 0) {
    await admin.from('collocation_quiz_classes').insert(
      classIds.map(cid => ({ quiz_id: quizId, class_id: cid }))
    )
  }

  revalidatePath('/teacher/vocab/collocation-quiz')
  return {}
}

export async function renameCollocationQuiz(quizId: string, title: string) {
  const user = await getUserFromCookie()
  if (!user) return { error: '로그인이 필요합니다.' }
  if (!title.trim()) return { error: '제목을 입력하세요.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('collocation_quizzes')
    .update({ title: title.trim() })
    .eq('id', quizId)
    .eq('teacher_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/teacher/vocab/collocation-quiz')
  return {}
}
