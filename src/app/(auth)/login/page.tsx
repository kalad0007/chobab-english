'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { X, UserCircle2, Zap } from 'lucide-react'

const STORAGE_KEY = 'chobab_saved_accounts'

interface SavedAccount {
  email: string
  password: string
  name: string
  role: string
  savedAt: number
}

function getSavedAccounts(): SavedAccount[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function saveAccount(account: SavedAccount) {
  const list = getSavedAccounts().filter(a => a.email !== account.email)
  list.unshift(account)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 10)))
}

function removeAccount(email: string) {
  const list = getSavedAccounts().filter(a => a.email !== email)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

const ROLE_LABEL: Record<string, string> = { teacher: '선생님', student: '학생' }
const ROLE_COLOR: Record<string, string> = {
  teacher: 'bg-blue-100 text-blue-700',
  student: 'bg-purple-100 text-purple-700',
}

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [tab, setTab] = useState<'login' | 'quick'>('login')

  function blockKorean(value: string) {
    return value.replace(/[ㄱ-ㅎㅏ-ㅣ가-힣]/g, '')
  }
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [loading, setLoading] = useState(false)
  const [quickLoadingEmail, setQuickLoadingEmail] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const accounts = getSavedAccounts()
    setSavedAccounts(accounts)
    if (accounts.length > 0) setTab('quick')
  }, [])

  async function doLogin(loginEmail: string, loginPassword: string, shouldRemember: boolean) {
    setError('')
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    })

    if (authError) {
      setError('이메일 또는 비밀번호가 올바르지 않습니다.')
      return null
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', data.user.id)
      .single()

    if (shouldRemember && profile) {
      saveAccount({
        email: loginEmail,
        password: loginPassword,
        name: profile.full_name ?? loginEmail.split('@')[0],
        role: profile.role ?? 'student',
        savedAt: Date.now(),
      })
    }

    router.refresh()
    if (profile?.role === 'teacher') {
      router.push('/teacher/dashboard')
    } else {
      router.push('/student/dashboard')
    }

    return profile
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await doLogin(email, password, remember)
    setLoading(false)
  }

  async function handleQuickLogin(account: SavedAccount) {
    setQuickLoadingEmail(account.email)
    await doLogin(account.email, account.password, true)
    setQuickLoadingEmail(null)
  }

  function handleRemove(e: React.MouseEvent, email: string) {
    e.stopPropagation()
    removeAccount(email)
    const updated = getSavedAccounts()
    setSavedAccounts(updated)
    if (updated.length === 0) setTab('login')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* 로고 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg">
            <span className="text-3xl">🍣</span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900">초밥샘 TOEFL</h1>
          <p className="text-gray-500 mt-1 text-sm">TOEFL iBT 학습을 시작하세요</p>
        </div>

        {/* 탭 */}
        <div className="flex bg-gray-100 rounded-2xl p-1 mb-4 gap-1">
          <button
            onClick={() => setTab('login')}
            className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition ${tab === 'login' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
          >
            로그인
          </button>
          <button
            onClick={() => setTab('quick')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-bold rounded-xl transition ${tab === 'quick' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
          >
            <Zap size={14} />
            자동로그인
            {savedAccounts.length > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tab === 'quick' ? 'bg-blue-100 text-blue-600' : 'bg-gray-300 text-gray-600'}`}>
                {savedAccounts.length}
              </span>
            )}
          </button>
        </div>

        {/* 폼 카드 */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">

          {/* ── 일반 로그인 ── */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-5">
              {error && (
                <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">이메일</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(blockKorean(e.target.value))}
                  placeholder="example@email.com"
                  lang="en"
                  required
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">비밀번호</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(blockKorean(e.target.value))}
                  placeholder="••••••••"
                  lang="en"
                  required
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>

              {/* 자동로그인 저장 체크 */}
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={e => setRemember(e.target.checked)}
                  className="w-4 h-4 rounded accent-blue-600"
                />
                <span className="text-sm text-gray-600">이 기기에 자동로그인 저장</span>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold py-3 rounded-xl transition text-sm"
              >
                {loading ? '로그인 중...' : '로그인'}
              </button>
            </form>
          )}

          {/* ── 자동로그인 탭 ── */}
          {tab === 'quick' && (
            <div className="space-y-3">
              {error && (
                <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200 mb-1">
                  {error}
                </div>
              )}
              {savedAccounts.length === 0 ? (
                <div className="text-center py-8">
                  <UserCircle2 size={40} className="mx-auto text-gray-200 mb-3" />
                  <p className="text-sm text-gray-400 font-medium">저장된 계정이 없어요</p>
                  <p className="text-xs text-gray-300 mt-1">로그인 시 "자동로그인 저장"을 체크하세요</p>
                  <button
                    onClick={() => setTab('login')}
                    className="mt-4 text-sm text-blue-600 font-semibold hover:underline"
                  >
                    로그인하러 가기
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-xs text-gray-400 mb-1">계정을 선택하면 바로 로그인됩니다</p>
                  {savedAccounts.map(account => {
                    const isLoading = quickLoadingEmail === account.email
                    const initials = account.name.slice(0, 2)
                    return (
                      <button
                        key={account.email}
                        onClick={() => handleQuickLogin(account)}
                        disabled={!!quickLoadingEmail}
                        className="w-full flex items-center gap-3 p-4 bg-gray-50 hover:bg-blue-50 border border-gray-100 hover:border-blue-200 rounded-2xl text-left transition disabled:opacity-60 group relative"
                      >
                        {/* Avatar */}
                        <div className="w-11 h-11 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 text-white font-bold text-sm">
                          {isLoading
                            ? <span className="animate-spin text-lg">⏳</span>
                            : initials
                          }
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate">{account.name}</p>
                          <p className="text-xs text-gray-400 truncate">{account.email}</p>
                        </div>
                        {/* Role badge */}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${ROLE_COLOR[account.role] ?? 'bg-gray-100 text-gray-600'}`}>
                          {ROLE_LABEL[account.role] ?? account.role}
                        </span>
                        {/* Remove */}
                        <button
                          onClick={e => handleRemove(e, account.email)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-100 text-gray-300 hover:text-red-500 transition flex-shrink-0"
                          title="저장 삭제"
                        >
                          <X size={14} />
                        </button>
                      </button>
                    )
                  })}
                  <button
                    onClick={() => setTab('login')}
                    className="w-full py-2.5 text-sm text-gray-400 hover:text-gray-600 transition"
                  >
                    + 다른 계정으로 로그인
                  </button>
                </>
              )}
            </div>
          )}

          {/* 하단 링크 */}
          {tab === 'login' && (
            <div className="mt-6 text-center space-y-3">
              <p className="text-sm text-gray-500">
                계정이 없으신가요?{' '}
                <Link href="/register" className="text-blue-600 font-semibold hover:underline">
                  선생님 회원가입
                </Link>
              </p>
              <p className="text-sm text-gray-500">
                초대 코드가 있으신가요?{' '}
                <Link href="/join" className="text-purple-600 font-semibold hover:underline">
                  학생 참여하기
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
