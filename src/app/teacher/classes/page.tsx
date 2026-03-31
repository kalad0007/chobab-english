import { createClient, getUserFromCookie } from '@/lib/supabase/server'
import { Users, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import NewClassButton from './NewClassButton'
import CopyCodeButton from './CopyCodeButton'

export default async function ClassesPage() {
  const supabase = await createClient()
  const user = await getUserFromCookie()
  if (!user) return null

  const { data: classes } = await supabase
    .from('classes')
    .select('id, name, invite_code, created_at')
    .eq('teacher_id', user.id)
    .order('created_at', { ascending: false })

  const classIds = (classes ?? []).map(c => c.id)

  const { data: members } = classIds.length > 0
    ? await supabase.from('class_members').select('class_id').in('class_id', classIds)
    : { data: [] }

  const countMap: Record<string, number> = {}
  for (const m of members ?? []) {
    countMap[m.class_id] = (countMap[m.class_id] ?? 0) + 1
  }

  return (
    <div className="p-3 md:p-7">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div>
          <h1 className="text-lg md:text-2xl font-extrabold text-gray-900">🏫 반 관리</h1>
          <p className="text-gray-500 text-xs md:text-sm mt-0.5">총 {(classes ?? []).length}개 반</p>
        </div>
        <NewClassButton />
      </div>

      {(classes ?? []).length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <Users size={40} className="mx-auto text-gray-200 mb-3" />
          <p className="font-semibold text-gray-500">아직 반이 없어요</p>
          <p className="text-sm text-gray-400 mt-1">반을 만들고 학생들에게 초대 코드를 공유하세요</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(classes ?? []).map(cls => {
            const count = countMap[cls.id] ?? 0
            return (
              <Link key={cls.id} href={`/teacher/classes/${cls.id}`} className="block bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-100 transition">
                <div className="px-4 py-3.5 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="font-bold text-gray-900 text-sm md:text-base truncate">{cls.name}</h2>
                    <p className="text-xs text-gray-400 mt-0.5">총 {count}명 등록</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="flex items-center gap-1 bg-gray-50 rounded-lg px-2 py-1">
                      <span className="text-[10px] text-gray-400">초대코드</span>
                      <span className="font-mono font-bold text-blue-600 tracking-widest text-xs">{cls.invite_code}</span>
                    </div>
                    <CopyCodeButton code={cls.invite_code} />
                    <ChevronRight size={16} className="text-gray-300" />
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
