import { AdminModelRegistryPage } from '../pages/AdminModelRegistryPage'
import { AdminOnlineRlPage } from '../pages/AdminOnlineRlPage'
import { AdminSystemHealthPage } from '../pages/AdminSystemHealthPage'
import type { ActiveView } from '../types'

interface AdminShellProps {
  activeView: ActiveView
  userRole?: string
  onNavigate: (view: ActiveView) => void
}

export function AdminShell({ activeView, userRole, onNavigate }: AdminShellProps) {
  if (userRole !== 'admin') {
    return null
  }
  if (activeView === 'admin_online_rl') {
    return <AdminOnlineRlPage onNavigate={onNavigate} />
  }
  if (activeView === 'admin_registry') {
    return <AdminModelRegistryPage />
  }
  if (activeView === 'admin_health') {
    return <AdminSystemHealthPage />
  }
  return null
}
