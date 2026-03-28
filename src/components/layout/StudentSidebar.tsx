'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { LayoutDashboard, FileText, RefreshCw, BookOpen, BarChart3, Trophy, LogOut, Menu, X, Headphones, Mic, PenTool } from 'lucide-react'

const navItems = [
  {
    section: 'TOEFL 학습',
    items: [
      { href: '/student/dashboard', label: '내 대시보드', icon: LayoutDashboard },
      { href: '/student/exams', label: '모의고사', icon: FileText },
      { href: '/student/review', label: '오답 복습', icon: RefreshCw },
      { href: '/student/learn', label: '학습 자료', icon: BookOpen },
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

  const badges: Record<string, number> = {
    '/student/exams': pendingExams,
    '/student/review': pendingReviews,
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
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
        'fixed inset-y-0 left-0 z-50 w-56 min-h-screen bg-white border-r border-gray-100 flex flex-col shadow-sm transition-transform duration-200',
        'md:relative md:translate-x-0 md:z-auto',
        mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      )}>
        {/* 로고 */}
        <div className="px-5 py-5 border-b border-gray-100 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🍣</span>
              <div>
                <p className="font-extrabold text-gray-900 leading-tight">초밥샘</p>
                <p className="font-extrabold text-blue-600 leading-tight">TOEFL</p>
              </div>
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

        {/* 네비게이션 */}
        <nav className="flex-1 py-4 px-3 space-y-5 overflow-y-auto">
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

        {/* 로그아웃 */}
        <div className="p-3 border-t border-gray-100">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut size={16} />
            로그아웃
          </button>
        </div>
      </aside>
    </>
  )
}
