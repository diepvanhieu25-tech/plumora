import { Activity, Code2, Compass, FileQuestion, GitBranch, LogOut, Server, ShieldCheck, Sprout } from 'lucide-react'
import { defaultViewForRole } from '../../types'
import type { ActiveView, LearnerUser, PortalKind } from '../../types'

interface HeaderProps {
  user: LearnerUser | null
  portal?: PortalKind
  activeView: ActiveView
  onNavigate: (view: ActiveView) => void
  onLogout: () => Promise<void>
}

export function Header({ user, portal = 'learner', activeView, onNavigate, onLogout }: HeaderProps) {
  if (!user) {
    const subtitle =
      portal === 'admin'
        ? 'Cổng Quản trị Hệ thống & Điều phối Mô hình'
        : portal === 'expert'
          ? 'Cổng Chuyên gia Nội dung & Thiết kế Lộ trình'
          : 'Nền tảng học tập thích ứng & đánh giá năng lực cá nhân hóa'

    const badge =
      portal === 'admin'
        ? 'Quản trị viên'
        : portal === 'expert'
          ? 'Chuyên gia'
          : 'Học tập Thích ứng'

    return (
      <header className="w-full bg-white border-b border-outline-variant/60 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-container border border-primary/40 flex items-center justify-center text-primary shrink-0">
              <Sprout className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base sm:text-lg text-primary tracking-tight">
                  Plumora — Học thích ứng Đa ngành
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-primary-container text-on-primary-container">
                  {badge}
                </span>
              </div>
              <p className="text-xs text-on-surface-variant font-medium hidden sm:block">
                {subtitle}
              </p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface border border-outline-variant/60 text-xs text-on-surface-variant">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span className="font-medium text-[11px]">Lộ trình Cá nhân hóa • Đánh giá 5 tầng</span>
          </div>
        </div>
      </header>
    )
  }

  const role = user.role ?? 'learner'
  const roleLabel =
    role === 'admin' ? 'Admin' : role === 'expert' ? 'Chuyên gia' : 'Học viên'

  const portalSubtitle =
    role === 'admin'
      ? 'Cổng Quản trị MLOps & Hạ tầng'
      : role === 'expert'
        ? 'Cổng Chuyên gia Học liệu & Lộ trình'
        : 'Không gian Học tập Thích ứng'

  return (
    <header className="w-full bg-white border-b border-outline-variant/60 sticky top-0 z-30 shadow-2xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onNavigate(defaultViewForRole(role))}
          className="flex items-center gap-2 sm:gap-3 text-left cursor-pointer group shrink-0 min-w-0"
          title="Quay về trang chính"
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-primary-container border border-primary/40 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors shrink-0">
            <Sprout className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="font-extrabold text-sm sm:text-lg text-primary tracking-tight">
                Plumora
              </span>
              <span className="bg-primary-container text-on-primary-container text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                {roleLabel}
              </span>
            </div>
            <p className="text-[11px] text-outline font-medium hidden sm:block">
              {portalSubtitle}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {role === 'learner' && (
            <button
              type="button"
              onClick={() => onNavigate('domains')}
              className={`inline-flex items-center justify-center gap-1.5 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 px-2.5 py-1.5 sm:px-3 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                activeView === 'domains' ||
                activeView === 'placement' ||
                activeView === 'domain_roadmap' ||
                activeView === 'playbook' ||
                activeView === 'depth_probe' ||
                activeView === 'code_sandbox'
                  ? 'text-on-primary-container bg-primary-container border-primary/40'
                  : 'text-primary bg-surface-container-low border-outline-variant hover:bg-primary-container/60'
              }`}
              data-testid="nav-multi-domain-btn"
              aria-label="Mở Trung tâm Chuyên ngành"
              title="Mở Trung tâm Chuyên ngành"
            >
              <Compass className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">Chuyên ngành</span>
            </button>
          )}

          {role === 'expert' && (
            <>
              <button
                type="button"
                onClick={() => onNavigate('expert_domains')}
                className={`inline-flex items-center justify-center gap-1.5 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 px-2.5 py-1.5 sm:px-3 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                  activeView === 'expert_domains'
                    ? 'text-on-primary-container bg-primary-container border-primary/40'
                    : 'text-on-surface-variant bg-white border-outline-variant hover:bg-surface-container-low'
                }`}
                data-testid="nav-expert-domains-btn"
              >
                <GitBranch className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="hidden sm:inline">Đồ thị DAG</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('expert_questions')}
                className={`inline-flex items-center justify-center gap-1.5 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 px-2.5 py-1.5 sm:px-3 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                  activeView === 'expert_questions'
                    ? 'text-on-primary-container bg-primary-container border-primary/40'
                    : 'text-on-surface-variant bg-white border-outline-variant hover:bg-surface-container-low'
                }`}
                data-testid="nav-expert-questions-btn"
              >
                <FileQuestion className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="hidden sm:inline">Đề 5 Tầng</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('expert_code')}
                className={`inline-flex items-center justify-center gap-1.5 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 px-2.5 py-1.5 sm:px-3 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                  activeView === 'expert_code'
                    ? 'text-on-primary-container bg-primary-container border-primary/40'
                    : 'text-on-surface-variant bg-white border-outline-variant hover:bg-surface-container-low'
                }`}
                data-testid="nav-expert-code-btn"
              >
                <Code2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="hidden sm:inline">Code Sandbox</span>
              </button>
            </>
          )}

          {role === 'admin' && (
            <>
              <button
                type="button"
                onClick={() => onNavigate('admin_online_rl')}
                className={`inline-flex items-center justify-center gap-1.5 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 px-2.5 py-1.5 sm:px-3 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                  activeView === 'admin_online_rl'
                    ? 'text-on-primary-container bg-primary-container border-primary/40'
                    : 'text-on-surface-variant bg-white border-outline-variant hover:bg-surface-container-low'
                }`}
                data-testid="nav-admin-online-rl-btn"
              >
                <Activity className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="hidden sm:inline">Online RL</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('admin_registry')}
                className={`inline-flex items-center justify-center gap-1.5 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 px-2.5 py-1.5 sm:px-3 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                  activeView === 'admin_registry'
                    ? 'text-on-primary-container bg-primary-container border-primary/40'
                    : 'text-on-surface-variant bg-white border-outline-variant hover:bg-surface-container-low'
                }`}
                data-testid="nav-admin-registry-btn"
              >
                <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="hidden sm:inline">Safety Gate</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('admin_health')}
                className={`inline-flex items-center justify-center gap-1.5 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 px-2.5 py-1.5 sm:px-3 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                  activeView === 'admin_health'
                    ? 'text-on-primary-container bg-primary-container border-primary/40'
                    : 'text-on-surface-variant bg-white border-outline-variant hover:bg-surface-container-low'
                }`}
                data-testid="nav-admin-health-btn"
              >
                <Server className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="hidden sm:inline">Microservices</span>
              </button>
            </>
          )}

          <div className="flex items-center gap-1.5 sm:gap-2 pl-1.5 sm:pl-2 border-l border-outline-variant/50">
            <div className="flex items-center gap-1.5 bg-surface-container-low px-2.5 py-1 rounded-full border border-outline-variant/60 max-w-[110px] sm:max-w-none">
              <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
              <span
                className="font-mono text-[11px] sm:text-xs font-bold text-on-surface truncate"
                data-testid="active-username"
              >
                {user.username}
              </span>
            </div>

            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] text-outline hover:text-error p-2.5 rounded-lg hover:bg-error-container/40 transition-colors cursor-pointer"
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
