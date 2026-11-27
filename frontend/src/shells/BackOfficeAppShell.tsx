import {
  Activity,
  AlertTriangle,
  BarChart3,
  Code2,
  FileQuestion,
  GitBranch,
  LogOut,
  Server,
  ShieldCheck,
  Sprout,
} from 'lucide-react'
import { AdminModelRegistryPage } from '../pages/admin/AdminModelRegistryPage'
import { AdminOnlineRlPage } from '../pages/admin/AdminOnlineRlPage'
import { AdminRlObservabilityPage } from '../pages/admin/AdminRlObservabilityPage'
import { AdminSystemHealthPage } from '../pages/admin/AdminSystemHealthPage'
import { CohortAnalyticsPage } from '../pages/expert/CohortAnalyticsPage'
import { ExpertCodeChallengesPage } from '../pages/expert/ExpertCodeChallengesPage'
import { ExpertDomainsPage } from '../pages/expert/ExpertDomainsPage'
import { ExpertQuestionsPage } from '../pages/expert/ExpertQuestionsPage'
import type { LearnerUser } from '../types/auth'
import type { BackOfficeView } from '../types/expert'
import { BackOfficeStudioProvider, useBackOfficeStudio } from './BackOfficeStudioContext'

export interface BackOfficeAppShellProps {
  user: LearnerUser
  activeView: string
  initialDomainSlug?: string
  initialConceptSlug?: string
  onNavigate: (view: BackOfficeView, params?: { domainSlug?: string; conceptSlug?: string }) => void
  onLogout: () => Promise<void>
}

interface NavItemDef {
  view: BackOfficeView
  label: string
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>
  testId: string
}

const STUDIO_NAV_ITEMS: NavItemDef[] = [
  {
    view: 'expert_domains',
    label: 'Đồ thị & Bài giảng',
    icon: GitBranch,
    testId: 'bo-nav-domains',
  },
  {
    view: 'expert_questions',
    label: 'Ngân hàng Câu hỏi 5 Tầng',
    icon: FileQuestion,
    testId: 'bo-nav-questions',
  },
  {
    view: 'expert_code',
    label: 'Bài tập Code Sandbox',
    icon: Code2,
    testId: 'bo-nav-code',
  },
]

const COHORT_NAV_ITEMS: NavItemDef[] = [
  {
    view: 'expert_cohort',
    label: 'Phân tích Đoàn hệ & Độ nhớ',
    icon: BarChart3,
    testId: 'bo-nav-cohort',
  },
]

const MLOPS_NAV_ITEMS: NavItemDef[] = [
  {
    view: 'admin_rl_observability',
    label: 'Giám sát RL Production',
    icon: BarChart3,
    testId: 'bo-nav-rl-observability',
  },
  {
    view: 'admin_online_rl',
    label: 'Online RL & Policy Inspector',
    icon: Activity,
    testId: 'bo-nav-online-rl',
  },
  {
    view: 'admin_registry',
    label: 'Safety Gate & Model Registry',
    icon: ShieldCheck,
    testId: 'bo-nav-registry',
  },
  {
    view: 'admin_health',
    label: 'Hạ tầng & Outbox / DLQ',
    icon: Server,
    testId: 'bo-nav-health',
  },
]

function normalizeBackOfficeView(rawView: string, role: string): BackOfficeView {
  if (
    rawView === 'expert_domains' ||
    rawView === 'expert_questions' ||
    rawView === 'expert_code' ||
    rawView === 'expert_cohort' ||
    rawView === 'admin_rl_observability' ||
    rawView === 'admin_online_rl' ||
    rawView === 'admin_registry' ||
    rawView === 'admin_health'
  ) {
    return rawView
  }
  if (rawView === 'cohort' || rawView === 'cohort_analytics' || rawView === 'backoffice_cohort') {
    return 'expert_cohort'
  }
  return role === 'admin' ? 'admin_online_rl' : 'expert_domains'
}

function BackOfficeShellInner({
  user,
  activeView,
  onNavigate,
  onLogout,
}: Omit<BackOfficeAppShellProps, 'initialDomainSlug' | 'initialConceptSlug'>) {
  const role = user.role ?? 'expert'
  const isAdmin = role === 'admin'
  const currentView = normalizeBackOfficeView(activeView, role)
  const studio = useBackOfficeStudio()

  function handleGuardedNavigate(
    targetView: BackOfficeView,
    params?: { domainSlug?: string; conceptSlug?: string },
  ) {
    if (params?.domainSlug) studio.setSelectedDomainSlug(params.domainSlug)
    if (params?.conceptSlug) studio.setSelectedConceptSlug(params.conceptSlug)
    studio.requestGuardedAction(() => {
      onNavigate(targetView, {
        domainSlug: params?.domainSlug ?? studio.selectedDomainSlug,
        conceptSlug: params?.conceptSlug ?? studio.selectedConceptSlug,
      })
    })
  }

  function renderNavGroup(title: string, items: NavItemDef[]) {
    return (
      <div className="space-y-1">
        <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-[#57534E]">
          {title}
        </div>
        {items.map((item) => {
          const Icon = item.icon
          const active = currentView === item.view
          return (
            <button
              key={item.view}
              type="button"
              data-testid={item.testId}
              onClick={() => handleGuardedNavigate(item.view)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer text-left ${
                active
                  ? 'bg-[#DCFCE7] text-[#14532D] border border-[#86EFAC]'
                  : 'text-[#3F5247] hover:bg-[#F6F8F5] hover:text-[#14241B]'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{item.label}</span>
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div
      className="min-h-screen bg-[#F6F8F5] text-[#14241B] flex flex-col lg:flex-row"
      data-testid="backoffice-app-shell"
    >
      {/* 240px Fixed Left Vertical Sidebar */}
      <aside className="w-full lg:w-[240px] lg:min-h-screen bg-white border-b lg:border-b-0 lg:border-r border-[#D8E2D8] flex flex-col justify-between shrink-0">
        <div className="p-4 space-y-6">
          {/* Brand & Role Header */}
          <div className="flex items-center gap-2.5 pb-4 border-b border-[#E7EFE7]">
            <div className="w-9 h-9 rounded-xl bg-[#F0FDF4] border border-[#16A34A] flex items-center justify-center text-[#15803D] shrink-0">
              <Sprout className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="font-extrabold text-sm text-[#15803D] truncate">Plumora Back-Office</div>
              <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F0FDF4] text-[#14532D] border border-[#BBF7D0]">
                {isAdmin ? 'Quản trị viên (Admin)' : 'Chuyên gia (Expert)'}
              </span>
            </div>
          </div>

          {/* RBAC Grouped Navigation: Admin prioritizes MLOps & RL Observability first (D-40) */}
          <nav aria-label="Điều hướng Back-Office" className="space-y-5">
            {isAdmin && renderNavGroup('Giám sát & MLOps RL', MLOPS_NAV_ITEMS)}
            {isAdmin && renderNavGroup('Giám sát Học viên', COHORT_NAV_ITEMS)}
            {renderNavGroup('Content Studio', STUDIO_NAV_ITEMS)}
            {!isAdmin && renderNavGroup('Giám sát Học viên', COHORT_NAV_ITEMS)}
          </nav>
        </div>

        {/* Bottom User & Logout Footer */}
        <div className="p-4 border-t border-[#E7EFE7] flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div
              className="text-xs font-bold text-[#14241B] truncate"
              data-testid="active-username"
            >
              {user.username}
            </div>
            <div className="text-[11px] text-[#57534E] truncate">{user.display_name}</div>
          </div>
          <button
            type="button"
            onClick={() => void onLogout()}
            data-testid="logout-btn"
            aria-label="Đăng xuất khỏi Back-Office"
            title="Đăng xuất"
            className="p-2 rounded-lg text-[#57534E] hover:text-[#9F1239] hover:bg-[#FFF1F2] transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </aside>

      {/* Main Content Area with Top Context & Dirty-State Bar */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-xs border-b border-[#D8E2D8] px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-[#57534E]">Ngữ cảnh Studio:</span>
            <span className="px-2.5 py-0.5 rounded-md bg-[#F6F8F5] border border-[#D8E2D8] font-mono font-bold text-[#14241B]">
              {studio.selectedDomainSlug}
            </span>
            <span className="text-[#57534E]">/</span>
            <span className="px-2.5 py-0.5 rounded-md bg-[#F0FDF4] border border-[#BBF7D0] font-mono font-bold text-[#15803D]">
              {studio.selectedConceptSlug}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {studio.isDirty && (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FFFBEB] border border-[#F59E0B] text-[11px] font-bold text-[#92400E]"
                data-testid="bo-dirty-indicator"
              >
                <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Có thay đổi chưa xuất bản</span>
              </span>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-[1680px] w-full mx-auto">
          {currentView === 'expert_domains' && (
            <ExpertDomainsPage onNavigate={handleGuardedNavigate} />
          )}
          {currentView === 'expert_questions' && (
            <ExpertQuestionsPage onNavigate={handleGuardedNavigate} />
          )}
          {currentView === 'expert_code' && (
            <ExpertCodeChallengesPage onNavigate={handleGuardedNavigate} />
          )}
          {currentView === 'expert_cohort' && (
            <CohortAnalyticsPage onNavigate={handleGuardedNavigate} />
          )}
          {isAdmin && currentView === 'admin_rl_observability' && (
            <AdminRlObservabilityPage onNavigate={handleGuardedNavigate} />
          )}
          {isAdmin && currentView === 'admin_online_rl' && (
            <AdminOnlineRlPage onNavigate={handleGuardedNavigate} />
          )}
          {isAdmin && currentView === 'admin_registry' && <AdminModelRegistryPage />}
          {isAdmin && currentView === 'admin_health' && <AdminSystemHealthPage />}
        </main>
      </div>

      {/* Unsaved Changes Confirmation Modal */}
      {studio.pendingNavigationPrompt.open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="dirty-guard-title"
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white max-w-md w-full rounded-2xl border border-[#D8E2D8] p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FFFBEB] border border-[#F59E0B] flex items-center justify-center text-[#D97706]">
                <AlertTriangle className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <h3 id="dirty-guard-title" className="text-sm font-extrabold text-[#14241B]">
                  Bạn có thay đổi chưa được lưu
                </h3>
                <p className="text-xs text-[#57534E]">
                  Nếu rời khỏi trang hiện tại, các chỉnh sửa chưa xuất bản sẽ bị hủy bỏ.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={studio.pendingNavigationPrompt.cancel}
                className="px-4 py-2 rounded-lg bg-[#F6F8F5] border border-[#D8E2D8] text-xs font-semibold text-[#14241B] cursor-pointer"
              >
                Ở lại chỉnh sửa
              </button>
              <button
                type="button"
                onClick={studio.pendingNavigationPrompt.confirmDiscard}
                className="px-4 py-2 rounded-lg bg-[#9F1239] hover:bg-[#881337] text-xs font-bold text-white cursor-pointer"
              >
                Hủy thay đổi &amp; Chuyển trang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function BackOfficeAppShell(props: BackOfficeAppShellProps) {
  return (
    <BackOfficeStudioProvider
      initialDomainSlug={props.initialDomainSlug}
      initialConceptSlug={props.initialConceptSlug}
    >
      <BackOfficeShellInner
        user={props.user}
        activeView={props.activeView}
        onNavigate={props.onNavigate}
        onLogout={props.onLogout}
      />
    </BackOfficeStudioProvider>
  )
}
