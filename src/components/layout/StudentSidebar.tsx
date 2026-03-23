'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { LayoutDashboard, FileText, RefreshCw, BookOpen, BarChart3, Trophy, LogOut } from 'lucide-react'

const navItems = [
  {
    section: '학습',
    items: [
      { href: '/student/dashboard', label: '내 대시보드', icon: LayoutDashboard },
      { href: '/student/exams', label: '시험 보기', icon: FileText },
      { href: '/student/review', label: '오답 다시 풀기', icon: RefreshCw },
      { href: '/student/learn', label: '학습 자료', icon: BookOpen },
    ],
  },
  {
    section: '내 기록',
    items: [
      { href: '/student/results', label: '성적 확인', icon: BarChart3 },
      { href: '/student/badges', label: '내 뱃지', icon: Trophy },
    ],
  },
]

interface StudentSidebarProps {
  studentName: string
  className?: string
  pendingReviews?: number
  pendingExams?: number
}

export default function StudentSidebar({ studentName, className, pendingReviews = 0, pendingExams = 0 }: StudentSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const badges: Record<string, number> = {
    '/student/exams': pendingExams,
    '/student/review': pendingReviews,
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="w-56 min-h-screen bg-white border-r border-gray-100 flex flex-col shadow-sm flex-shrink-0">
      {/* 로고 */}
      <div className="px-5 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🍣</span>
          <div>
            <p className="font-extrabold text-gray-900 leading-tight">초밥샘의</p>
            <p className="font-extrabold text-purple-600 leading-tight">영어공부</p>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          {className && `${className} · `}{studentName}
        </p>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 py-4 px-3 space-y-5 overflow-y-auto">
        {navItems.map(group => (
          <div key={group.section}>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2 mb-1.5">
              {group.section}
            </p>
            <ul className="space-y-0.5">
              {group.items.map(item => {
                const Icon = item.icon
                const active = pathname === item.href || pathname.startsWith(item.href + '/')
                const badge = badges[item.href]
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
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
  )
}
