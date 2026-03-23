import { createClient, getUserFromCookie } from '@/lib/supabase/server'
import { Users, Copy, Plus } from 'lucide-react'
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
    ? await supabase.from('class_members')
        .select('class_id, student_id, joined_at, profiles(name)')
        .in('class_id', classIds)
    : { data: [] }

  const memberMap: Record<string, Array<{ id: string; name: string; joinedAt: string }>> = {}
  for (const m of members ?? []) {
    if (!memberMap[m.class_id]) memberMap[m.class_id] = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profile = m.profiles as any
    memberMap[m.class_id].push({
      id: m.student_id,
      name: profile?.name ?? '알 수 없음',
      joinedAt: m.joined_at,
    })
  }

  return (
    <div className="p-7">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">🏫 반 관리</h1>
          <p className="text-gray-500 text-sm mt-1">총 {(classes ?? []).length}개 반</p>
        </div>
        <NewClassButton />
      </div>

      {(classes ?? []).length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
          <Users size={48} className="mx-auto text-gray-200 mb-4" />
          <p className="font-semibold text-gray-500">아직 반이 없어요</p>
          <p className="text-sm text-gray-400 mt-1">반을 만들고 학생들에게 초대 코드를 공유하세요</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {(classes ?? []).map(cls => {
            const clsMembers = memberMap[cls.id] ?? []
            return (
              <div key={cls.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
                  <div>
                    <h2 className="font-bold text-gray-900">{cls.name}</h2>
                    <p className="text-xs text-gray-400 mt-0.5">{clsMembers.length}명 등록</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 bg-gray-50 rounded-xl px-3 py-1.5">
                      <span className="text-xs text-gray-400">초대코드</span>
                      <span className="font-mono font-bold text-blue-600 tracking-widest text-sm">{cls.invite_code}</span>
                    </div>
                    <CopyCodeButton code={cls.invite_code} />
                  </div>
                </div>

                {clsMembers.length === 0 ? (
                  <div className="px-5 py-8 text-center">
                    <p className="text-sm text-gray-400">아직 학생이 없어요</p>
                    <p className="text-xs text-gray-300 mt-1">초대코드를 학생에게 공유하세요</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {clsMembers.map(m => (
                      <div key={m.id} className="flex items-center justify-between px-5 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                            {m.name.charAt(0)}
                          </div>
                          <span className="text-sm font-semibold text-gray-800">{m.name}</span>
                        </div>
                        <span className="text-xs text-gray-400">
                          {new Date(m.joinedAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} 가입
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
