import { Activity, LogOut } from 'lucide-react'
import type { ActiveView, LearnerUser } from '../../types'

interface HeaderProps {
  user: LearnerUser | null
  activeView: ActiveView
  onNavigate: (view: ActiveView) => void
  onLogout: () => Promise<void>
  isDrawerOpen: boolean
  setIsDrawerOpen: (open: boolean) => void
  masteredCount: number
}

export function Header({
  user,
  onNavigate,
  onLogout,
  isDrawerOpen,
  setIsDrawerOpen,
  masteredCount,
}: HeaderProps) {
  // 1. Unauthenticated Minimal Header (Stitch SCR-01)
  if (!user) {
    return (
      <header className="w-full bg-white border-b border-[#D8E2D8] shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          {/* Brand Cluster */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#F0FDF4] border border-[#16A34A] flex items-center justify-center shadow-2xs overflow-hidden p-1 shrink-0">
              <img
                src="/Logo_Secondary.webp"
                alt="Plumora Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base sm:text-lg text-[#15803D] tracking-tight">
                  Plumora — Lộ trình Backend RL
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-[#F0FDF4] text-[#14532D] border border-[#BBF7D0]">
                  Lộ trình Học thích ứng AI
                </span>
              </div>
              <p
                className="text-xs text-[#3F5247] font-medium hidden sm:block"
                data-testid="env01-scaffold-ready"
              >
                Hệ thống khuyến nghị và quản lý lộ trình học tập cá nhân hóa bằng Học tăng cường
              </p>
            </div>
          </div>
        </div>
      </header>
    )
  }

  // 2. Authenticated Header
  const percent = Math.round((masteredCount / 12) * 100)

  return (
    <header className="w-full bg-white border-b border-[#D8E2D8] sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-2 sm:px-6 py-2 sm:py-3 flex items-center justify-between gap-1.5 sm:gap-2">
        {/* Left: Brand + Navigation to Roadmap */}
        <button
          type="button"
          onClick={() => onNavigate('roadmap')}
          className="flex items-center gap-1.5 sm:gap-3 text-left cursor-pointer group shrink-0 min-w-0"
          title="Quay về Bản đồ Lộ trình"
        >
          <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl bg-[#F0FDF4] border border-[#16A34A] flex items-center justify-center group-hover:border-[#15803D] group-hover:shadow-xs transition-all duration-150 shadow-2xs overflow-hidden p-0.5 sm:p-1 shrink-0">
            <img
              src="/Logo_Secondary.webp"
              alt="Plumora Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1 sm:gap-2">
              <span className="font-extrabold text-sm sm:text-lg text-[#15803D] tracking-tight">
                Plumora
              </span>
              <span className="bg-[#F0FDF4] text-[#14532D] text-[9px] sm:text-[11px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full border border-[#BBF7D0] whitespace-nowrap">
                Lộ trình AI
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-[#57534E] font-medium hidden sm:block">
              Học tăng cường thích ứng cá nhân hóa
            </p>
          </div>
        </button>

        {/* Center: Progress Pill */}
        <div
          className="hidden md:flex items-center gap-3 bg-[#F6F8F5] px-4 py-2 rounded-full border border-[#D8E2D8]"
          data-testid="global-mastery-counter"
        >
          <div className="text-xs font-medium text-[#14241B]">
            Đã thông thạo:{' '}
            <strong className="font-bold text-[#15803D]">
              {masteredCount} / 12 khái niệm ({percent}%)
            </strong>
          </div>
          <div className="w-32 h-2.5 bg-[#E2E8F0] rounded-full overflow-hidden relative">
            <div
              className="bg-[#15803D] h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${percent}%` }}
            ></div>
          </div>
        </div>

        {/* Right Actions: Provenance, User Pill, Logout */}
        <div className="flex items-center gap-1 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setIsDrawerOpen(!isDrawerOpen)}
            className="inline-flex items-center gap-1 px-1.5 py-1 sm:px-3 text-xs font-semibold text-[#15803D] bg-white border border-[#D8E2D8] rounded-lg hover:bg-[#F0FDF4] hover:border-[#15803D] transition-colors cursor-pointer"
            data-testid="open-provenance-drawer-btn"
            aria-label="Mở ngăn kéo Bằng chứng RL 24 chiều"
          >
            <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#15803D] shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">Bằng chứng AI</span>
          </button>

          <div className="flex items-center gap-1 sm:gap-2 pl-1 sm:pl-2 border-l border-[#D8E2D8]">
            <div className="flex items-center gap-1 bg-[#F6F8F5] px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full border border-[#D8E2D8] max-w-[70px] sm:max-w-none">
              <span className="w-1.5 h-1.5 rounded-full bg-[#15803D] animate-pulse shrink-0"></span>
              <span
                className="font-mono text-[11px] sm:text-xs font-bold text-[#14241B] truncate"
                data-testid="active-username"
              >
                {user.username}
              </span>
            </div>

            <button
              type="button"
              onClick={onLogout}
              className="text-[#57534E] hover:text-[#9F1239] p-1 sm:p-1.5 rounded-lg hover:bg-[#FFF1F2] transition-colors cursor-pointer"
              title="Đăng xuất"
              data-testid="logout-btn"
              aria-label="Đăng xuất khỏi hệ thống"
            >
              <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
