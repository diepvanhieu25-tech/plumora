import type { ActiveView, LearnerUser, PortalKind } from './types'

export type AssessmentSessionMode = 'depth_probe' | 'spaced_review'

export interface ParsedRoute {
  portal: PortalKind
  view: ActiveView
  isLoginPath: boolean
  isRegisterPath: boolean
  domainSlug?: string
  conceptSlug?: string
  sessionMode?: AssessmentSessionMode
}

export function defaultPathForRole(role?: LearnerUser['role']): string {
  if (role === 'admin') return '/backoffice/mlops/online-rl'
  if (role === 'expert') return '/backoffice/studio/domains'
  return '/domains'
}

export function loginPathForPortal(portal: PortalKind): string {
  if (portal === 'admin' || portal === 'expert') return '/backoffice/login'
  return '/login'
}

export function parseRoute(pathname: string, search: string = ''): ParsedRoute {
  const clean = pathname.replace(/\/+$/, '') || '/'
  const params = new URLSearchParams(search)
  const modeParam = params.get('mode')
  const sessionMode: AssessmentSessionMode =
    modeParam === 'spaced_review' ? 'spaced_review' : 'depth_probe'
  const queryDomain = params.get('domain') || undefined

  // Back-Office Auth & Routes (Canonical /backoffice/* + legacy /admin/* & /expert/* aliases)
  if (clean === '/backoffice/login') {
    return { portal: 'expert', view: 'expert_domains', isLoginPath: true, isRegisterPath: false }
  }
  if (clean === '/admin/login') {
    return { portal: 'admin', view: 'admin_online_rl', isLoginPath: true, isRegisterPath: false }
  }
  if (clean === '/expert/login') {
    return { portal: 'expert', view: 'expert_domains', isLoginPath: true, isRegisterPath: false }
  }

  if (
    clean === '/backoffice/mlops/observability' ||
    clean === '/admin/observability'
  ) {
    return { portal: 'admin', view: 'admin_rl_observability', isLoginPath: false, isRegisterPath: false }
  }
  if (
    clean === '/backoffice/mlops/online-rl' ||
    clean === '/admin' ||
    clean === '/admin/online-rl'
  ) {
    return { portal: 'admin', view: 'admin_online_rl', isLoginPath: false, isRegisterPath: false }
  }
  if (
    clean === '/backoffice/mlops/model-registry' ||
    clean === '/admin/model-registry'
  ) {
    return { portal: 'admin', view: 'admin_registry', isLoginPath: false, isRegisterPath: false }
  }
  if (
    clean === '/backoffice/infra/system-health' ||
    clean === '/admin/system-health'
  ) {
    return { portal: 'admin', view: 'admin_health', isLoginPath: false, isRegisterPath: false }
  }
  if (clean.startsWith('/backoffice/mlops/') || clean.startsWith('/backoffice/infra/') || clean.startsWith('/admin/')) {
    return { portal: 'admin', view: 'admin_online_rl', isLoginPath: false, isRegisterPath: false }
  }

  const studioDomainMatch = clean.match(/^\/backoffice\/studio\/domains\/([^/]+)$/)
  if (studioDomainMatch) {
    return {
      portal: 'expert',
      view: 'expert_domains',
      isLoginPath: false,
      isRegisterPath: false,
      domainSlug: decodeURIComponent(studioDomainMatch[1]),
    }
  }
  if (
    clean === '/backoffice' ||
    clean === '/backoffice/studio/domains' ||
    clean === '/expert' ||
    clean === '/expert/domains'
  ) {
    return { portal: 'expert', view: 'expert_domains', isLoginPath: false, isRegisterPath: false }
  }
  if (clean === '/backoffice/studio/questions' || clean === '/expert/questions') {
    return { portal: 'expert', view: 'expert_questions', isLoginPath: false, isRegisterPath: false }
  }
  if (clean === '/backoffice/studio/code-challenges' || clean === '/expert/code-challenges') {
    return { portal: 'expert', view: 'expert_code', isLoginPath: false, isRegisterPath: false }
  }
  if (clean === '/backoffice/cohort' || clean === '/expert/cohort') {
    return { portal: 'expert', view: 'cohort_analytics', isLoginPath: false, isRegisterPath: false }
  }
  if (clean.startsWith('/backoffice/') || clean.startsWith('/expert/')) {
    return { portal: 'expert', view: 'expert_domains', isLoginPath: false, isRegisterPath: false }
  }

  // Canonical Learner Routes with Domain Context in URL
  const domainPlaybookMatch = clean.match(/^\/domains\/([^/]+)\/concepts\/([^/]+)\/playbook$/)
  if (domainPlaybookMatch) {
    return {
      portal: 'learner',
      view: 'playbook',
      isLoginPath: false,
      isRegisterPath: false,
      domainSlug: decodeURIComponent(domainPlaybookMatch[1]),
      conceptSlug: decodeURIComponent(domainPlaybookMatch[2]),
    }
  }

  const domainDepthMatch = clean.match(/^\/domains\/([^/]+)\/concepts\/([^/]+)\/depth-probe$/)
  if (domainDepthMatch) {
    return {
      portal: 'learner',
      view: 'depth_probe',
      isLoginPath: false,
      isRegisterPath: false,
      domainSlug: decodeURIComponent(domainDepthMatch[1]),
      conceptSlug: decodeURIComponent(domainDepthMatch[2]),
      sessionMode,
    }
  }

  const domainSandboxMatch = clean.match(/^\/domains\/([^/]+)\/concepts\/([^/]+)\/code-sandbox$/)
  if (domainSandboxMatch) {
    return {
      portal: 'learner',
      view: 'code_sandbox',
      isLoginPath: false,
      isRegisterPath: false,
      domainSlug: decodeURIComponent(domainSandboxMatch[1]),
      conceptSlug: decodeURIComponent(domainSandboxMatch[2]),
    }
  }

  const placementMatch = clean.match(/^\/domains\/([^/]+)\/placement$/)
  if (placementMatch) {
    return {
      portal: 'learner',
      view: 'placement',
      isLoginPath: false,
      isRegisterPath: false,
      domainSlug: decodeURIComponent(placementMatch[1]),
    }
  }

  const roadmapMatch = clean.match(/^\/domains\/([^/]+)\/roadmap$/)
  if (roadmapMatch) {
    return {
      portal: 'learner',
      view: 'domain_roadmap',
      isLoginPath: false,
      isRegisterPath: false,
      domainSlug: decodeURIComponent(roadmapMatch[1]),
    }
  }

  // Backward-compatible Learner Concept Aliases (/concepts/:slug/*)
  const playbookMatch = clean.match(/^\/concepts\/([^/]+)\/playbook$/)
  if (playbookMatch) {
    return {
      portal: 'learner',
      view: 'playbook',
      isLoginPath: false,
      isRegisterPath: false,
      domainSlug: queryDomain || 'backend',
      conceptSlug: decodeURIComponent(playbookMatch[1]),
    }
  }

  const depthMatch = clean.match(/^\/concepts\/([^/]+)\/depth-probe$/)
  if (depthMatch) {
    return {
      portal: 'learner',
      view: 'depth_probe',
      isLoginPath: false,
      isRegisterPath: false,
      domainSlug: queryDomain || 'backend',
      conceptSlug: decodeURIComponent(depthMatch[1]),
      sessionMode,
    }
  }

  const sandboxMatch = clean.match(/^\/concepts\/([^/]+)\/code-sandbox$/)
  if (sandboxMatch) {
    return {
      portal: 'learner',
      view: 'code_sandbox',
      isLoginPath: false,
      isRegisterPath: false,
      domainSlug: queryDomain || 'backend',
      conceptSlug: decodeURIComponent(sandboxMatch[1]),
    }
  }

  return {
    portal: 'learner',
    view: 'domains',
    isLoginPath: clean === '/login',
    isRegisterPath: clean === '/register',
  }
}

export function pathForView(
  view: ActiveView,
  params?: {
    domainSlug?: string
    conceptSlug?: string
    sessionMode?: AssessmentSessionMode
  },
): string {
  const domain = encodeURIComponent(params?.domainSlug || 'backend')
  const concept = encodeURIComponent(params?.conceptSlug || 'net-internet')
  switch (view) {
    case 'domains':
      return '/domains'
    case 'placement':
      return `/domains/${domain}/placement`
    case 'domain_roadmap':
      return `/domains/${domain}/roadmap`
    case 'playbook':
      return `/domains/${domain}/concepts/${concept}/playbook`
    case 'depth_probe': {
      const modeQuery =
        params?.sessionMode === 'spaced_review' ? '?mode=spaced_review' : '?mode=depth_probe'
      return `/domains/${domain}/concepts/${concept}/depth-probe${modeQuery}`
    }
    case 'code_sandbox':
      return `/domains/${domain}/concepts/${concept}/code-sandbox`
    case 'expert_domains':
      return params?.domainSlug
        ? `/backoffice/studio/domains/${domain}`
        : '/backoffice/studio/domains'
    case 'expert_questions':
      return '/backoffice/studio/questions'
    case 'expert_code':
      return '/backoffice/studio/code-challenges'
    case 'cohort_analytics':
      return '/backoffice/cohort'
    case 'admin_rl_observability':
      return '/backoffice/mlops/observability'
    case 'admin_online_rl':
      return '/backoffice/mlops/online-rl'
    case 'admin_registry':
      return '/backoffice/mlops/model-registry'
    case 'admin_health':
      return '/backoffice/infra/system-health'
  }
}
