'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function JoinPage() {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState<'code' | 'register'>('code')
  const [inviteCode, setInviteCode] = useState('')
  const [classInfo, setClassInfo] = useState<{ id: string; name: string } | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function checkCode(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: dbError } = await supabase
      .from('classes')
      .select('id, name')
      .eq('invite_code', inviteCode.trim().toUpperCase())
      .single()

    if (dbError || !data) {
      setError('유효하지 않은 초대 코드입니다. 선생님에게 다시 확인해주세요.')
      setLoading(false)
      return
    }

    setClassInfo(data)
    setStep('register')
    setLoading(false)
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    if (!classInfo) return

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError('올바른 이메일 형식을 입력해주세요.')
      return
    }

    setLoading(true)
    setError('')

    // 1. 회원가입
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, role: 'student' } },
    })

    if (authError || !data.user) {
      const msg = (authError?.message ?? '').toLowerCase()
      if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
        setError('이미 사용 중인 이메일입니다. 로그인을 시도해주세요.')
      } else if (msg.includes('invalid') || msg.includes('email')) {
        setError('올바른 이메일 형식을 입력해주세요.')
      } else if (msg.includes('password') || msg.includes('weak')) {
        setError('비밀번호는 6자 이상이어야 합니다.')
      } else if (msg.includes('rate') || msg.includes('limit')) {
        setError('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.')
      } else {
        setError(`가입에 실패했습니다: ${authError?.message ?? '알 수 없는 오류'}`)
      }
      setLoading(false)
      return
    }

    // 이메일 확인 모드에서 이미 존재하는 이메일이면 identities가 비어있음
    if (data.user.identities && data.user.identities.length === 0) {
      setError('이미 사용 중인 이메일입니다. 로그인을 시도해주세요.')
      setLoading(false)
      return
    }

    // 2. 반 참여
    await supabase.from('class_members').insert({
      class_id: classInfo.id,
      student_id: data.user.id,
    })

    router.push('/student/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-600 rounded-2xl mb-4 shadow-lg">
            <span className="text-3xl">🎓</span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900">학생 참여하기</h1>
          <p className="text-gray-500 mt-1 text-sm">선생님에게 받은 초대 코드로 참여하세요</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          {step === 'code' ? (
            <form onSubmit={checkCode} className="space-y-5">
              {error && (
                <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">초대 코드</label>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value)}
                  placeholder="예: abc12345"
                  required
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-center tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white font-bold py-3 rounded-xl transition text-sm"
              >
                {loading ? '확인 중...' : '코드 확인'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleJoin} className="space-y-5">
              <div className="bg-purple-50 rounded-xl px-4 py-3 mb-2">
                <p className="text-sm text-purple-700 font-semibold">
                  ✅ <strong>{classInfo?.name}</strong> 반에 참여합니다
                </p>
              </div>
              {error && (
                <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">이름</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="홍길동" required
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 transition" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">이메일</label>
                <input type="email" inputMode="email" lang="en" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="student@email.com" required
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 transition" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">비밀번호</label>
                <input type="password" lang="en" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="6자 이상" required
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 transition" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white font-bold py-3 rounded-xl transition text-sm">
                {loading ? '가입 중...' : '학생으로 가입하기'}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-gray-500">
            이미 계정이 있으신가요?{' '}
            <Link href="/login" className="text-purple-600 font-semibold hover:underline">로그인</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
