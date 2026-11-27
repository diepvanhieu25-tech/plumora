import { ArrowRight, Menu, Shield, Sprout, X } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import type { PublicPageKind } from '../router'
import { defaultPathForRole } from '../router'
import type { LearnerUser } from '../types'

interface PublicShowcaseShellProps {
  activePage: PublicPageKind
  user: LearnerUser | null
  onNavigatePath: (path: string) => void
  children: ReactNode
}

const NAV_ITEMS: Array<{
  id: PublicPageKind
  label: string
  path: string
  testId: string
}> = [
  { id: 'home', label: 'Trang chủ', path: '/', testId: 'pub-nav-home' },
  {
    id: 'how_it_works',
    label: 'Cách hoạt động AI',
    path: '/how-it-works',
    testId: 'pub-nav-how-it-works',
  },
  {
    id: 'curriculum',
    label: 'Lộ trình & Lĩnh vực',
    path: '/curriculum',
    testId: 'pub-nav-curriculum',
  },
  {
    id: 'about',
    label: 'Kiến trúc & Dự án',
    path: '/about',
    testId: 'pub-nav-about',
  },
]

export function PublicShowcaseShell({
  activePage,
  user,
  onNavigatePath,
  children,
}: PublicShowcaseShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  function handleNavClick(path: string) {
    setMobileMenuOpen(false)
    onNavigatePath(path)
    if (
      typeof window !== 'undefined' &&
      typeof window.scrollTo === 'function' &&
      !navigator.userAgent.includes('jsdom')
    ) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const workspacePath = user ? defaultPathForRole(user.role) : '/login'
  const workspaceLabel =
    user?.role === 'admin' || user?.role === 'expert'
      ? 'Vào Back-Office'
      : 'Vào không gian học tập'

  return (
    <div className="min-h-screen bg-background text-on-surface font-sans antialiased flex flex-col overflow-x-hidden w-full">
      {/* Sticky Topbar */}
      <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-[#D8E2D8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Brand */}
          <button
            type="button"
            onClick={() => handleNavClick('/')}
            className="flex items-center gap-2.5 text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            data-testid="pub-brand-btn"
          >
            <span className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
              <Sprout className="w-5 h-5" aria-hidden="true" />
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-base font-extrabold tracking-tight text-on-surface">
                Plumora
              </span>
              <span className="text-[11px] font-medium text-on-surface-variant hidden sm:inline">
                Adaptive Learning RL
              </span>
            </span>
          </button>

          {/* Desktop Navigation */}
          <nav
            aria-label="Điều hướng chính"
            className="hidden md:flex items-center gap-1"
          >
            {NAV_ITEMS.map((item) => {
              const isActive = activePage === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  data-testid={item.testId}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => handleNavClick(item.path)}
                  className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    isActive
                      ? 'bg-primary-container/70 text-on-primary-container'
                      : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
                  }`}
                >
                  {item.label}
                </button>
              )
            })}
          </nav>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-2.5">
            {user ? (
              <button
                type="button"
                data-testid="pub-nav-workspace-btn"
                onClick={() => handleNavClick(workspacePath)}
                className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-primary hover:bg-primary-dim text-on-primary text-sm font-semibold transition-colors shadow-xs"
              >
                <span>{workspaceLabel}</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  data-testid="pub-nav-login-btn"
                  onClick={() => handleNavClick('/login')}
                  className="px-4 py-2.5 min-h-[44px] rounded-xl border border-[#D8E2D8] bg-white hover:bg-surface-container-low text-on-surface text-sm font-semibold transition-colors"
                >
                  Đăng nhập
                </button>
                <button
                  type="button"
                  data-testid="pub-nav-register-btn"
                  onClick={() => handleNavClick('/register')}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-xl bg-primary hover:bg-primary-dim text-on-primary text-sm font-semibold transition-colors shadow-xs"
                >
                  <span>Bắt đầu học</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            data-testid="pub-mobile-menu-toggle"
            aria-label={mobileMenuOpen ? 'Đóng menu điều hướng' : 'Mở menu điều hướng'}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-xl border border-[#D8E2D8] bg-white text-on-surface hover:bg-surface-container-low transition-colors"
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5" aria-hidden="true" />
            ) : (
              <Menu className="w-5 h-5" aria-hidden="true" />
            )}
          </button>
        </div>

        {/* Mobile Drawer Panel */}
        {mobileMenuOpen && (
          <div
            data-testid="pub-mobile-menu"
            className="md:hidden border-t border-[#D8E2D8] bg-white px-4 py-4 space-y-2 shadow-sm"
          >
            <nav aria-label="Điều hướng di động" className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => {
                const isActive = activePage === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => handleNavClick(item.path)}
                    className={`w-full text-left px-3.5 py-2.5 min-h-[44px] rounded-xl text-sm font-semibold transition-colors ${
                      isActive
                        ? 'bg-primary-container/70 text-on-primary-container'
                        : 'text-on-surface-variant hover:bg-surface-container-low'
                    }`}
                  >
                    {item.label}
                  </button>
                )
              })}
            </nav>

            <div className="pt-3 border-t border-[#D8E2D8] flex flex-col gap-2">
              {user ? (
                <button
                  type="button"
                  onClick={() => handleNavClick(workspacePath)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-primary text-on-primary text-sm font-semibold"
                >
                  <span>{workspaceLabel}</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => handleNavClick('/login')}
                    className="w-full px-4 py-2.5 min-h-[44px] rounded-xl border border-[#D8E2D8] bg-white text-on-surface text-sm font-semibold"
                  >
                    Đăng nhập
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNavClick('/register')}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-xl bg-primary text-on-primary text-sm font-semibold"
                  >
                    <span>Bắt đầu học miễn phí</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full">{children}</main>

      {/* Unified Botanical Footer */}
      <footer className="w-full bg-white border-t border-[#D8E2D8] mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className="md:col-span-5 space-y-3">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center">
                <Sprout className="w-4 h-4" aria-hidden="true" />
              </span>
              <span className="text-base font-extrabold text-on-surface">Plumora</span>
            </div>
            <p className="text-sm text-on-surface-variant leading-relaxed max-w-md">
              Nền tảng gợi ý và quản lý lộ trình học tập thích ứng cá nhân hóa ứng dụng Học tăng cường đồ thị (GNN-PPO), đánh giá đào sâu 5 tầng và Code Sandbox cô lập.
            </p>
            <p className="text-xs font-mono text-outline">
              Kiến trúc chuẩn v4.1 · 4 Microservices + API Gateway
            </p>
          </div>

          <div className="md:col-span-4 space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface">
              Khám phá hệ thống
            </h3>
            <ul className="space-y-2 text-sm text-on-surface-variant">
              {NAV_ITEMS.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => handleNavClick(item.path)}
                    className="hover:text-primary transition-colors text-left"
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-3 space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface">
              Cổng truy cập
            </h3>
            <ul className="space-y-2 text-sm text-on-surface-variant">
              <li>
                <button
                  type="button"
                  onClick={() => handleNavClick('/login')}
                  className="hover:text-primary transition-colors text-left"
                >
                  Đăng nhập Học viên
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleNavClick('/register')}
                  className="hover:text-primary transition-colors text-left"
                >
                  Đăng ký Tài khoản mới
                </button>
              </li>
              <li>
                <button
                  type="button"
                  data-testid="pub-footer-backoffice-btn"
                  onClick={() => handleNavClick('/backoffice/login')}
                  className="inline-flex items-center gap-1.5 hover:text-primary transition-colors text-left"
                >
                  <Shield className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Cổng Quản trị & Chuyên gia</span>
                </button>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-[#D8E2D8]/80 py-4 px-4 sm:px-6">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-outline">
            <span>Plumora — Đồ án Tốt nghiệp Kỹ thuật Phần mềm & Trí tuệ Nhân tạo</span>
            <span className="font-mono">Botanical Sprout & Sunlit Canopy Design System</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
