import { Activity, Server, ShieldCheck } from 'lucide-react'
import { AdminModelRegistryPage } from '../pages/AdminModelRegistryPage'
import { AdminOnlineRlPage } from '../pages/AdminOnlineRlPage'
import { AdminSystemHealthPage } from '../pages/AdminSystemHealthPage'
import type { ActiveView } from '../types'

interface AdminShellProps {
  activeView: ActiveView
  userRole?: string
  onNavigate: (view: ActiveView) => void
}

const ADMIN_TABS: Array<{ view: ActiveView; label: string; icon: typeof Activity; testId: string }> = [
  { view: 'admin_online_rl', label: 'Online RL Monitor', icon: Activity, testId: 'admin-tab-online-rl' },
  { view: 'admin_registry', label: 'Model Registry & Rollback', icon: ShieldCheck, testId: 'admin-tab-registry' },
  { view: 'admin_health', label: 'Sức khỏe Cụm Dịch vụ', icon: Server, testId: 'admin-tab-health' },
]

export function AdminShell({ activeView, userRole, onNavigate }: AdminShellProps) {
  if (userRole !== 'admin') {
    return null
  }
  const isAdminView =
    activeView === 'admin_online_rl' ||
    activeView === 'admin_registry' ||
    activeView === 'admin_health'

  if (!isAdminView) {
    return null
  }

  return (
    <div className="space-y-4">
      <nav
        aria-label="Điều hướng Cổng Quản trị"
        className="max-w-6xl mx-auto px-4 sm:px-6 pt-2 flex flex-wrap gap-2"
      >
        {ADMIN_TABS.map((tab) => {
          const Icon = tab.icon
          const active = activeView === tab.view
          return (
            <button
              key={tab.view}
              type="button"
              onClick={() => onNavigate(tab.view)}
              data-testid={tab.testId}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                active
                  ? 'bg-[#15803D] text-white border-[#15803D] shadow-2xs'
                  : 'bg-white text-[#14241B] border-[#D8E2D8] hover:bg-[#F0FDF4] hover:border-[#86EFAC]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </nav>

      {activeView === 'admin_online_rl' && <AdminOnlineRlPage onNavigate={onNavigate} />}
      {activeView === 'admin_registry' && <AdminModelRegistryPage onNavigate={onNavigate} />}
      {activeView === 'admin_health' && <AdminSystemHealthPage onNavigate={onNavigate} />}
    </div>
  )
}
