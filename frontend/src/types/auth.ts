export type PortalKind = 'learner' | 'expert' | 'admin'

export interface LearnerUser {
  id: string
  username: string
  display_name: string
  role?: 'learner' | 'expert' | 'admin'
  state_version: number
}

export type ActiveView =
  | 'domains'
  | 'placement'
  | 'domain_roadmap'
  | 'playbook'
  | 'depth_probe'
  | 'code_sandbox'
  | 'expert_domains'
  | 'expert_questions'
  | 'expert_code'
  | 'cohort_analytics'
  | 'admin_online_rl'
  | 'admin_registry'
  | 'admin_health'

export type ToastType = 'success' | 'info' | 'warning' | 'error'

export interface ToastNotification {
  message: string
  type: ToastType
}

export function defaultViewForRole(role?: LearnerUser['role']): ActiveView {
  if (role === 'admin') return 'admin_online_rl'
  if (role === 'expert') return 'expert_domains'
  return 'domains'
}
