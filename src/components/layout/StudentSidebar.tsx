'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { LayoutDashboard, FileText, RefreshCw, BookOpen, BarChart3, Trophy, LogOut, Menu, X, Headphones, Mic, PenTool, BookA, ScrollText, BookMarked, KeyRound } from 'lucide-react'

const navItems = [
  {
    section: 'TOEFL 학습',
    items: [
      { href: '/student/dashboard', label: '내 대시보드', icon: LayoutDashboard },
      { href: '/student/exams', label: '모의고사', icon: FileText },
      { href: '/student/review', label: '오답 복습', icon: RefreshCw },
      { href: '/student/learn',  label: 'TOEFL 기출 학습 자료', icon: BookOpen },
      { href: '/student/vocab',    label: '어휘 학습',  icon: BookA },
      { href: '/student/passages', label: '독해 지문',  icon: ScrollText },
      { href: '/student/my-words', label: '내 단어장', icon: BookMarked },
    ],
  },
  {
    section: '섹션별 연습',
    items: [
      { href: '/student/practice/reading', label: 'Reading', icon: BookOpen },
      { href: '/student/practice/listening', label: 'Listening', icon: Headphones },
      { href: '/student/practice/speaking', label: 'Speaking', icon: Mic },
      { href: '/student/practice/writing', label: 'Writing', icon: PenTool },
    ],
  },
  {
    section: '내 기록',
    items: [
      { href: '/student/results', label: '성적 분석', icon: BarChart3 },
      { href: '/student/badges', label: '내 뱃지', icon: Trophy },
    ],
  },
]

interface StudentSidebarProps {
  studentName: string
  className?: string
  pendingReviews?: number
  pendingExams?: number
  featureLevel?: number
}

export default function StudentSidebar({ studentName, className, pendingReviews = 0, pendingExams = 0, featureLevel = 1 }: StudentSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [pwModal, setPwModal] = useState(false)
  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)

  const badges: Record<string, number> = {
    '/student/exams': pendingExams,
    '/student/review': pendingReviews,
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwError('')
    if (newPw !== confirmPw) { setPwError('새 비밀번호가 일치하지 않습니다.'); return }
    if (newPw.length < 6) { setPwError('비밀번호는 최소 6자 이상이어야 합니다.'); return }
    setPwLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) { setPwError('사용자 정보를 불러올 수 없습니다.'); return }
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: user.email, password: oldPw })
      if (signInError) { setPwError('기존 비밀번호가 올바르지 않습니다.'); return }
      const { error: updateError } = await supabase.auth.updateUser({ password: newPw })
      if (updateError) { setPwError('비밀번호 변경 실패: ' + updateError.message); return }
      setPwSuccess(true)
      setOldPw(''); setNewPw(''); setConfirmPw('')
      setTimeout(() => { setPwModal(false); setPwSuccess(false) }, 1500)
    } finally {
      setPwLoading(false)
    }
  }

  return (
    <>
      {/* 모바일 햄버거 버튼 */}
      <button
        className="md:hidden fixed top-4 left-4 z-50 bg-white border border-gray-200 rounded-lg p-2 shadow-sm"
        onClick={() => setMobileOpen(true)}
      >
        <Menu size={20} className="text-gray-600" />
      </button>

      {/* 모바일 백드롭 */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* 사이드바 */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 w-56 min-h-screen border-r border-gray-100 flex flex-col shadow-sm transition-transform duration-200 overflow-hidden',
        'md:relative md:translate-x-0 md:z-auto',
        mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      )}>
        {/* 배경 패턴 */}
        <div className="absolute inset-0 bg-gradient-to-b from-purple-100/50 via-white/80 to-violet-50/40" />
        <div
          className="absolute inset-0 opacity-[0.08] pointer-events-none select-none"
          aria-hidden="true"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='420'%3E%3Ctext x='15' y='35' font-size='18' fill='%234B5563' font-family='serif' font-weight='bold'%3EABC%3C/text%3E%3Ctext x='105' y='75' font-size='14' fill='%234B5563'%3E%F0%9F%93%9D%3C/text%3E%3Ctext x='45' y='120' font-size='16' fill='%234B5563'%3E%E2%9C%8F%EF%B8%8F%3C/text%3E%3Ctext x='110' y='170' font-size='16' fill='%234B5563'%3E%F0%9F%8E%93%3C/text%3E%3Ctext x='20' y='215' font-size='14' fill='%234B5563'%3EHello%3C/text%3E%3Ctext x='90' y='260' font-size='18' fill='%234B5563'%3E%F0%9F%93%96%3C/text%3E%3Ctext x='30' y='305' font-size='16' fill='%234B5563'%3E%E2%AD%90%3C/text%3E%3Ctext x='100' y='345' font-size='12' fill='%234B5563' font-family='serif' font-style='italic'%3EEnglish%3C/text%3E%3Ctext x='10' y='385' font-size='18' fill='%234B5563'%3E%F0%9F%8C%8D%3C/text%3E%3Ctext x='95' y='410' font-size='14' fill='%234B5563'%3E%E2%9C%A8%3C/text%3E%3C/svg%3E")`,
            backgroundRepeat: 'repeat',
          }}
        />
        {/* 로고 */}
        <div className="px-5 py-5 border-b border-gray-100 flex items-start justify-between relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="에듀원" className="h-10 w-auto" />
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {className && `${className} · `}{studentName}
            </p>
          </div>
          <button
            className="md:hidden p-1 text-gray-400 hover:text-gray-600"
            onClick={() => setMobileOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        {/* 로그아웃 + 비밀번호 변경 */}
        <div className="px-3 py-3 border-b border-gray-100 space-y-0.5 relative z-10">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut size={16} />
            로그아웃
          </button>
          <button
            onClick={() => { setPwModal(true); setPwError(''); setPwSuccess(false) }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
          >
            <KeyRound size={16} />
            비밀번호 변경
          </button>
        </div>

        {/* 네비게이션 */}
        <nav className="flex-1 py-4 px-3 space-y-5 overflow-y-auto relative z-10">
          {navItems
            .filter(group => !(group.section === '섹션별 연습' && featureLevel < 3))
            .map(group => (
              <div key={group.section}>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2 mb-1.5">
                  {group.section}
                </p>
                <ul className="space-y-0.5">
                  {group.items
                    .filter(item => item.href !== '/student/review' || featureLevel >= 2)
                    .map(item => {
                      const Icon = item.icon
                      const active = pathname === item.href || pathname.startsWith(item.href + '/')
                      const badge = badges[item.href]
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={() => setMobileOpen(false)}
                            className={cn(
                              'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                              active
                                ? 'bg-purple-50 text-purple-700 font-semibold'
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                            )}
                          >
                            <Icon size={16} className={active ? 'text-purple-600' : 'text-gray-400'} />
                            <span className="flex-1">{item.label}</span>
                            {badge > 0 && (
                              <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                                {badge}
                              </span>
                            )}
                          </Link>
                        </li>
                      )
                    })}
                </ul>
              </div>
            ))}
        </nav>
      </aside>

      {/* 비밀번호 변경 모달 */}
      {pwModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-gray-900 text-base">비밀번호 변경</h3>
              <button onClick={() => setPwModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            {pwSuccess ? (
              <div className="text-center py-6">
                <p className="text-emerald-600 font-bold text-sm">✅ 비밀번호가 변경되었습니다!</p>
              </div>
            ) : (
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">기존 비밀번호</label>
                  <input
                    type="password" value={oldPw} onChange={e => setOldPw(e.target.value)} required
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="현재 비밀번호 입력"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">새 비밀번호</label>
                  <input
                    type="password" value={newPw} onChange={e => setNewPw(e.target.value)} required
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="새 비밀번호 (6자 이상)"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">새 비밀번호 확인</label>
                  <input
                    type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} required
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="새 비밀번호 재입력"
                  />
                </div>
                {pwError && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{pwError}</p>}
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => setPwModal(false)}
                    className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
                    취소
                  </button>
                  <button type="submit" disabled={pwLoading}
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl text-sm font-bold transition">
                    {pwLoading ? '변경 중...' : '변경하기'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
