import { AdminModelRegistryPage } from '../pages/AdminModelRegistryPage'
import { AdminOnlineRlPage } from '../pages/AdminOnlineRlPage'
import { AdminSystemHealthPage } from '../pages/AdminSystemHealthPage'
import type { ActiveView } from '../types/auth'
import type { BackOfficeView } from '../types/expert'

interface AdminShellProps {
  activeView: ActiveView | BackOfficeView | string
  userRole?: string
  onNavigate: (view: ActiveView, params?: { domainSlug?: string; conceptSlug?: string }) => void
}

export function AdminShell({ activeView, userRole, onNavigate }: AdminShellProps) {
  if (userRole !== 'admin') {
    return null
  }
  const forwardNav = (
    view: BackOfficeView,
    params?: { domainSlug?: string; conceptSlug?: string },
  ) => {
    onNavigate(view as ActiveView, params)
  }

  if (activeView === 'admin_online_rl') {
    return <AdminOnlineRlPage onNavigate={forwardNav} />
  }
  if (activeView === 'admin_registry') {
    return <AdminModelRegistryPage />
  }
  if (activeView === 'admin_health') {
    return <AdminSystemHealthPage />
  }
  return null
}
