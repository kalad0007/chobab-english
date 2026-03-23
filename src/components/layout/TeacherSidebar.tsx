'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, BookOpen, Sparkles, FileText, ClipboardList,
  Users, School, BarChart3, BookMarked, LogOut
} from 'lucide-react'

const navItems = [
  {
    section: '메인',
    items: [
      { href: '/teacher/dashboard', label: '대시보드', icon: LayoutDashboard },
      { href: '/teacher/analytics', label: '통계 분석', icon: BarChart3 },
    ],
  },
  {
    section: '문제 관리',
    items: [
      { href: '/teacher/questions', label: '문제은행', icon: BookOpen },
      { href: '/teacher/questions/generate', label: 'AI 문제 생성', icon: Sparkles },
    ],
  },
  {
    section: '시험',
    items: [
      { href: '/teacher/exams', label: '시험 관리', icon: FileText },
      { href: '/teacher/grading', label: '채점/결과', icon: ClipboardList },
    ],
  },
  {
    section: '학생',
    items: [
      { href: '/teacher/students', label: '학생 관리', icon: Users },
      { href: '/teacher/classes', label: '반 관리', icon: School },
    ],
  },
  {
    section: '콘텐츠',
    items: [
      { href: '/teacher/contents', label: '학습 자료', icon: BookMarked },
    ],
  },
]

export default function TeacherSidebar({ teacherName }: { teacherName: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

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
            <p className="font-extrabold text-blue-600 leading-tight">영어공부</p>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2">선생님 패널 · {teacherName}</p>
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
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                        active
                          ? 'bg-blue-50 text-blue-700 font-semibold'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      )}
                    >
                      <Icon size={16} className={active ? 'text-blue-600' : 'text-gray-400'} />
                      {item.label}
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
