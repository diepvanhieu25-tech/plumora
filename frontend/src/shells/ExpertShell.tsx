import { CohortAnalyticsPage } from '../pages/CohortAnalyticsPage'
import { ExpertCodeChallengesPage } from '../pages/ExpertCodeChallengesPage'
import { ExpertDomainsPage } from '../pages/ExpertDomainsPage'
import { ExpertQuestionsPage } from '../pages/ExpertQuestionsPage'
import type { ActiveView } from '../types/auth'
import type { BackOfficeView } from '../types/expert'

interface ExpertShellProps {
  activeView: ActiveView | BackOfficeView | string
  userRole?: string
  onNavigate: (view: ActiveView, params?: { domainSlug?: string; conceptSlug?: string }) => void
}

export function ExpertShell({ activeView, userRole, onNavigate }: ExpertShellProps) {
  if (userRole !== 'expert' && userRole !== 'admin') {
    return null
  }
  const forwardNav = (
    view: BackOfficeView,
    params?: { domainSlug?: string; conceptSlug?: string },
  ) => {
    onNavigate(view as ActiveView, params)
  }

  if (activeView === 'expert_domains') {
    return <ExpertDomainsPage onNavigate={forwardNav} />
  }
  if (activeView === 'expert_questions') {
    return <ExpertQuestionsPage onNavigate={forwardNav} />
  }
  if (activeView === 'expert_code') {
    return <ExpertCodeChallengesPage onNavigate={forwardNav} />
  }
  if (activeView === 'expert_cohort') {
    return <CohortAnalyticsPage onNavigate={forwardNav} />
  }
  return null
}
