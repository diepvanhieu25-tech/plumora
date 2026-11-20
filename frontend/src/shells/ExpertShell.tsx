import { ExpertCodeChallengesPage } from '../pages/ExpertCodeChallengesPage'
import { ExpertDomainsPage } from '../pages/ExpertDomainsPage'
import { ExpertQuestionsPage } from '../pages/ExpertQuestionsPage'
import type { ActiveView } from '../types'

interface ExpertShellProps {
  activeView: ActiveView
  userRole?: string
  onNavigate: (view: ActiveView) => void
}

export function ExpertShell({ activeView, userRole, onNavigate }: ExpertShellProps) {
  if (userRole !== 'expert' && userRole !== 'admin') {
    return null
  }
  if (activeView === 'expert_domains') {
    return <ExpertDomainsPage onNavigate={onNavigate} />
  }
  if (activeView === 'expert_questions') {
    return <ExpertQuestionsPage onNavigate={onNavigate} />
  }
  if (activeView === 'expert_code') {
    return <ExpertCodeChallengesPage onNavigate={onNavigate} />
  }
  return null
}
