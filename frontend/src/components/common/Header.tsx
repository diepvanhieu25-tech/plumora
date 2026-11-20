import { Activity, Code2, Compass, FileQuestion, GitBranch, LogOut, Server, ShieldCheck } from 'lucide-react'
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
      <header className="w-full bg-white border-b border-[#D8E2D8] shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
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
                  Plumora — Học thích ứng Đa ngành
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-[#F0FDF4] text-[#14532D] border border-[#BBF7D0]">
                  {badge}
                </span>
              </div>
              <p
                className="text-xs text-[#3F5247] font-medium hidden sm:block"
                data-testid="env01-scaffold-ready"
              >
                {subtitle}
              </p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#F6F8F5] border border-[#D8E2D8] text-xs text-[#3F5247]">
            <span className="w-2 h-2 rounded-full bg-[#16A34A]" />
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
      ? 'Cổng Quản trị Online RL & Cụm Microservices'
      : role === 'expert'
        ? 'Cổng Chuyên gia Knowledge Graph & Rubric'
        : 'Học thích ứng Đa lĩnh vực & Đánh giá 5 tầng'

  return (
    <header className="w-full bg-white border-b border-[#D8E2D8] sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onNavigate(defaultViewForRole(role))}
          className="flex items-center gap-2 sm:gap-3 text-left cursor-pointer group shrink-0 min-w-0"
          title="Quay về trang chính"
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#F0FDF4] border border-[#16A34A] flex items-center justify-center group-hover:border-[#15803D] group-hover:shadow-xs transition-all duration-150 shadow-2xs overflow-hidden p-0.5 sm:p-1 shrink-0">
            <img
              src="/Logo_Secondary.webp"
              alt="Plumora Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="font-extrabold text-sm sm:text-lg text-[#15803D] tracking-tight">
                Plumora
              </span>
              <span className="bg-[#F0FDF4] text-[#14532D] text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full border border-[#BBF7D0] whitespace-nowrap">
                {roleLabel}
              </span>
            </div>
            <p className="text-[11px] text-[#57534E] font-medium hidden sm:block">
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
                  ? 'text-[#14532D] bg-[#DCFCE7] border-[#16A34A]'
                  : 'text-[#15803D] bg-[#F0FDF4] border-[#86EFAC] hover:bg-[#DCFCE7]'
              }`}
              data-testid="nav-multi-domain-btn"
              aria-label="Mở Trung tâm Đa lĩnh vực"
              title="Mở Trung tâm Đa lĩnh vực"
            >
              <Compass className="w-4 h-4 text-[#15803D] shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">Đa lĩnh vực</span>
            </button>
          )}

          {role === 'expert' && (
            <>
              <button
                type="button"
                onClick={() => onNavigate('expert_domains')}
                className={`inline-flex items-center justify-center gap-1.5 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 px-2.5 py-1.5 sm:px-3 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                  activeView === 'expert_domains'
                    ? 'text-[#14532D] bg-[#DCFCE7] border-[#16A34A]'
                    : 'text-[#3F5247] bg-white border-[#D8E2D8] hover:bg-[#F0FDF4]'
                }`}
                data-testid="nav-expert-domains-btn"
                aria-label="Quản lý Đồ thị DAG"
                title="Quản lý Đồ thị DAG"
              >
                <GitBranch className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="hidden sm:inline">Đồ thị DAG</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('expert_questions')}
                className={`inline-flex items-center justify-center gap-1.5 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 px-2.5 py-1.5 sm:px-3 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                  activeView === 'expert_questions'
                    ? 'text-[#14532D] bg-[#DCFCE7] border-[#16A34A]'
                    : 'text-[#3F5247] bg-white border-[#D8E2D8] hover:bg-[#F0FDF4]'
                }`}
                data-testid="nav-expert-questions-btn"
                aria-label="Biên soạn Đề 5 Tầng"
                title="Biên soạn Đề 5 Tầng"
              >
                <FileQuestion className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="hidden sm:inline">Đề 5 Tầng</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('expert_code')}
                className={`inline-flex items-center justify-center gap-1.5 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 px-2.5 py-1.5 sm:px-3 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                  activeView === 'expert_code'
                    ? 'text-[#14532D] bg-[#DCFCE7] border-[#16A34A]'
                    : 'text-[#3F5247] bg-white border-[#D8E2D8] hover:bg-[#F0FDF4]'
                }`}
                data-testid="nav-expert-code-btn"
                aria-label="Quản lý bài tập Code Sandbox"
                title="Quản lý bài tập Code Sandbox"
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
                    ? 'text-[#14532D] bg-[#DCFCE7] border-[#16A34A]'
                    : 'text-[#3F5247] bg-white border-[#D8E2D8] hover:bg-[#F0FDF4]'
                }`}
                data-testid="nav-admin-online-rl-btn"
                aria-label="Bảng điều khiển Online RL"
                title="Bảng điều khiển Online RL"
              >
                <Activity className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="hidden sm:inline">Online RL</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('admin_registry')}
                className={`inline-flex items-center justify-center gap-1.5 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 px-2.5 py-1.5 sm:px-3 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                  activeView === 'admin_registry'
                    ? 'text-[#14532D] bg-[#DCFCE7] border-[#16A34A]'
                    : 'text-[#3F5247] bg-white border-[#D8E2D8] hover:bg-[#F0FDF4]'
                }`}
                data-testid="nav-admin-registry-btn"
                aria-label="Kho mô hình và Safety Gate"
                title="Kho mô hình và Safety Gate"
              >
                <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="hidden sm:inline">Safety Gate</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('admin_health')}
                className={`inline-flex items-center justify-center gap-1.5 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 px-2.5 py-1.5 sm:px-3 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                  activeView === 'admin_health'
                    ? 'text-[#14532D] bg-[#DCFCE7] border-[#16A34A]'
                    : 'text-[#3F5247] bg-white border-[#D8E2D8] hover:bg-[#F0FDF4]'
                }`}
                data-testid="nav-admin-health-btn"
                aria-label="Giám sát Cụm Microservices"
                title="Giám sát Cụm Microservices"
              >
                <Server className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="hidden sm:inline">Microservices</span>
              </button>
            </>
          )}

          <div className="flex items-center gap-1.5 sm:gap-2 pl-1.5 sm:pl-2 border-l border-[#D8E2D8]">
            <div className="flex items-center gap-1.5 bg-[#F6F8F5] px-2 py-1 rounded-full border border-[#D8E2D8] max-w-[110px] sm:max-w-none">
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
              className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] text-[#57534E] hover:text-[#9F1239] p-2.5 rounded-lg hover:bg-[#FFF1F2] transition-colors cursor-pointer"
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
