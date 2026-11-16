import { Activity, BookOpen, CheckCircle2, Compass, FileCheck2, LogOut, ShieldCheck, Sprout, UserCheck } from 'lucide-react'
import type { LearnerUser } from '../../types'

export type ActiveScreen = 'scr01_auth' | 'scr02_roadmap' | 'scr03_lesson' | 'scr04_quiz' | 'scr08_locked'

interface HeaderProps {
  user: LearnerUser | null
  activeScreen: ActiveScreen
  setActiveScreen: (screen: ActiveScreen) => void
  onLogout: () => Promise<void>
  isDrawerOpen: boolean
  setIsDrawerOpen: (open: boolean) => void
  masteredCount: number
}

export function Header({
  user,
  activeScreen,
  setActiveScreen,
  onLogout,
  isDrawerOpen,
  setIsDrawerOpen,
  masteredCount,
}: HeaderProps) {
  return (
    <header className="border-b border-[#D8E2D8] bg-white sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        {/* Brand identity */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#F0FDF4] border border-[#16A34A] flex items-center justify-center text-[#15803D]">
            <Sprout className="w-6 h-6 text-[#15803D]" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-[#14241B]">
                Plumora — Lộ trình Backend RL
              </h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#F0FDF4] border border-[#16A34A] text-[#14532D] font-bold">
                RL MVP v1.0
              </span>
            </div>
            <p
              className="text-xs text-[#3F5247]"
              data-testid="env01-scaffold-ready"
            >
              Cá nhân hóa lộ trình 12 khái niệm Backend bằng Học tăng cường Sâu (DQN)
            </p>
          </div>
        </div>

        {/* Global Progress & Provenance Drawer Trigger */}
        <div className="flex flex-wrap items-center gap-3">
          <div
            className="flex items-center gap-2 bg-[#F0FDF4] border border-[#16A34A] text-[#14532D] px-3 py-1.5 rounded-lg text-xs font-semibold"
            data-testid="global-mastery-counter"
          >
            <CheckCircle2 className="w-4 h-4 text-[#16A34A]" aria-hidden="true" />
            <span>
              Đã thông thạo: {masteredCount} / 12 khái niệm (
              {Math.round((masteredCount / 12) * 100)}%)
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsDrawerOpen(!isDrawerOpen)}
            className="plumora-btn-outline text-xs"
            data-testid="open-provenance-drawer-btn"
            aria-label="Mở ngăn kéo Bằng chứng RL 24 chiều"
          >
            <Activity className="w-4 h-4 text-[#15803D]" aria-hidden="true" />
            <span className="hidden md:inline">Bằng chứng AI &amp; Vector 24 chiều</span>
          </button>
        </div>

        {/* Navigation Tabs and User Auth Status */}
        <div className="flex items-center gap-2">
          <nav className="flex items-center gap-1" aria-label="Chuyển màn hình">
            <button
              type="button"
              onClick={() => setActiveScreen('scr01_auth')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold ${
                activeScreen === 'scr01_auth'
                  ? 'bg-[#15803D] text-white'
                  : 'text-[#3F5247] hover:bg-stone-100'
              }`}
            >
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                <span>SCR-01: Đăng nhập</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveScreen('scr02_roadmap')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold ${
                activeScreen === 'scr02_roadmap'
                  ? 'bg-[#15803D] text-white'
                  : 'text-[#3F5247] hover:bg-stone-100'
              }`}
            >
              <span className="inline-flex items-center gap-1">
                <Compass className="w-3.5 h-3.5" aria-hidden="true" />
                <span>SCR-02: Bản đồ DAG</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveScreen('scr03_lesson')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold ${
                activeScreen === 'scr03_lesson'
                  ? 'bg-[#15803D] text-white'
                  : 'text-[#3F5247] hover:bg-stone-100'
              }`}
            >
              <span className="inline-flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
                <span>SCR-03: Bài học</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveScreen('scr04_quiz')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold ${
                activeScreen === 'scr04_quiz'
                  ? 'bg-[#15803D] text-white'
                  : 'text-[#3F5247] hover:bg-stone-100'
              }`}
            >
              <span className="inline-flex items-center gap-1">
                <FileCheck2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>SCR-04: Làm Quiz</span>
              </span>
            </button>
          </nav>

          {user ? (
            <div className="flex items-center gap-2 border-l border-[#D8E2D8] pl-3">
              <UserCheck className="w-4 h-4 text-[#15803D]" aria-hidden="true" />
              <span className="text-xs font-semibold font-mono" data-testid="active-username">
                {user.username}
              </span>
              <button
                type="button"
                onClick={onLogout}
                className="text-xs text-stone-600 hover:text-rose-800 inline-flex items-center gap-1"
              >
                <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Đăng xuất</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}
