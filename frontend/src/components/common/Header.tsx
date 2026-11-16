import { Activity, LogOut, Server } from 'lucide-react'
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
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between">
          {/* Brand Cluster */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#F0FDF4] border border-[#16A34A] flex items-center justify-center shadow-2xs overflow-hidden p-1">
              <img
                src="/Logo_Secondary.webp"
                alt="Plumora Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg text-[#15803D] tracking-tight">
                  Plumora — Lộ trình Backend RL
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-mono font-semibold bg-[#F5F5F4] text-[#57534E] border border-[#D8E2D8]">
                  SCR-01
                </span>
              </div>
              <p
                className="text-xs text-[#3F5247] font-medium"
                data-testid="env01-scaffold-ready"
              >
                Cá nhân hóa lộ trình 12 khái niệm Backend bằng Học tăng cường Sâu (DQN)
              </p>
            </div>
          </div>

          {/* Environment & Telemetry Status */}
          <div className="hidden md:flex items-center gap-2.5 bg-[#F6F8F5] border border-[#D8E2D8] rounded-full px-3.5 py-1.5 shadow-2xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#15803D] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#15803D]"></span>
            </span>
            <Server className="w-3.5 h-3.5 text-[#57534E]" aria-hidden="true" />
            <span className="text-xs font-mono font-medium text-[#14241B]">
              Local Docker Dev Env • PostgreSQL 16 • Redis 7
            </span>
          </div>
        </div>
      </header>
    )
  }

  // 2. Authenticated Header (Stitch SCR-02..06)
  const percent = Math.round((masteredCount / 12) * 100)

  return (
    <header className="w-full bg-white border-b border-[#D8E2D8] sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        {/* Left: Brand + Navigation to Roadmap */}
        <button
          type="button"
          onClick={() => onNavigate('roadmap')}
          className="flex items-center gap-3 text-left cursor-pointer group"
          title="Quay về Bản đồ Lộ trình"
        >
          <div className="w-9 h-9 rounded-xl bg-[#F0FDF4] border border-[#16A34A] flex items-center justify-center group-hover:border-[#15803D] group-hover:shadow-xs transition-all duration-150 shadow-2xs overflow-hidden p-1">
            <img
              src="/Logo_Secondary.webp"
              alt="Plumora Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg text-[#15803D] tracking-tight">
                Plumora
              </span>
              <span className="bg-[#F0FDF4] text-[#14532D] text-[11px] font-bold px-2 py-0.5 rounded-full border border-[#BBF7D0]">
                Backend RL
              </span>
            </div>
            <p className="text-[11px] text-[#57534E] font-mono">
              DQN Policy v1.0.0 • DAG Engine
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
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsDrawerOpen(!isDrawerOpen)}
            className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-[#15803D] bg-white border border-[#D8E2D8] rounded-lg hover:bg-[#F0FDF4] hover:border-[#15803D] transition-colors cursor-pointer"
            data-testid="open-provenance-drawer-btn"
            aria-label="Mở ngăn kéo Bằng chứng RL 24 chiều"
          >
            <Activity className="w-4 h-4 text-[#15803D]" aria-hidden="true" />
            <span>Bằng chứng AI &amp; Lịch sử</span>
          </button>

          <div className="flex items-center gap-2 pl-2 border-l border-[#D8E2D8]">
            <div className="flex items-center gap-2 bg-[#F6F8F5] px-2.5 py-1 rounded-full border border-[#D8E2D8]">
              <span className="w-2 h-2 rounded-full bg-[#15803D] animate-pulse"></span>
              <span
                className="font-mono text-xs font-bold text-[#14241B]"
                data-testid="active-username"
              >
                {user.username}
              </span>
            </div>

            <button
              type="button"
              onClick={onLogout}
              className="text-[#57534E] hover:text-[#9F1239] p-1.5 rounded-lg hover:bg-[#FFF1F2] transition-colors cursor-pointer"
              title="Đăng xuất"
              data-testid="logout-btn"
              aria-label="Đăng xuất khỏi hệ thống"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
