import type { ActiveView, LearnerUser, PortalKind } from './types'

export interface ParsedRoute {
  portal: PortalKind
  view: ActiveView
  isLoginPath: boolean
  isRegisterPath: boolean
  domainSlug?: string
  conceptSlug?: string
}

export function defaultPathForRole(role?: LearnerUser['role']): string {
  if (role === 'admin') return '/admin/online-rl'
  if (role === 'expert') return '/expert/domains'
  return '/domains'
}

export function loginPathForPortal(portal: PortalKind): string {
  if (portal === 'admin') return '/admin/login'
  if (portal === 'expert') return '/expert/login'
  return '/login'
}

export function parseRoute(pathname: string): ParsedRoute {
  const clean = pathname.replace(/\/+$/, '') || '/'

  if (clean === '/admin/login') {
    return { portal: 'admin', view: 'admin_online_rl', isLoginPath: true, isRegisterPath: false }
  }
  if (clean === '/admin' || clean === '/admin/online-rl') {
    return { portal: 'admin', view: 'admin_online_rl', isLoginPath: false, isRegisterPath: false }
  }
  if (clean === '/admin/model-registry') {
    return { portal: 'admin', view: 'admin_registry', isLoginPath: false, isRegisterPath: false }
  }
  if (clean === '/admin/system-health') {
    return { portal: 'admin', view: 'admin_health', isLoginPath: false, isRegisterPath: false }
  }
  if (clean.startsWith('/admin/')) {
    return { portal: 'admin', view: 'admin_online_rl', isLoginPath: false, isRegisterPath: false }
  }

  if (clean === '/expert/login') {
    return { portal: 'expert', view: 'expert_domains', isLoginPath: true, isRegisterPath: false }
  }
  if (clean === '/expert' || clean === '/expert/domains') {
    return { portal: 'expert', view: 'expert_domains', isLoginPath: false, isRegisterPath: false }
  }
  if (clean === '/expert/questions') {
    return { portal: 'expert', view: 'expert_questions', isLoginPath: false, isRegisterPath: false }
  }
  if (clean === '/expert/code-challenges') {
    return { portal: 'expert', view: 'expert_code', isLoginPath: false, isRegisterPath: false }
  }
  if (clean.startsWith('/expert/')) {
    return { portal: 'expert', view: 'expert_domains', isLoginPath: false, isRegisterPath: false }
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

  const depthMatch = clean.match(/^\/concepts\/([^/]+)\/depth-probe$/)
  if (depthMatch) {
    return {
      portal: 'learner',
      view: 'depth_probe',
      isLoginPath: false,
      isRegisterPath: false,
      conceptSlug: decodeURIComponent(depthMatch[1]),
    }
  }

  const sandboxMatch = clean.match(/^\/concepts\/([^/]+)\/code-sandbox$/)
  if (sandboxMatch) {
    return {
      portal: 'learner',
      view: 'code_sandbox',
      isLoginPath: false,
      isRegisterPath: false,
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
  params?: { domainSlug?: string; conceptSlug?: string },
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
    case 'depth_probe':
      return `/concepts/${concept}/depth-probe`
    case 'code_sandbox':
      return `/concepts/${concept}/code-sandbox`
    case 'expert_domains':
      return '/expert/domains'
    case 'expert_questions':
      return '/expert/questions'
    case 'expert_code':
      return '/expert/code-challenges'
    case 'admin_online_rl':
      return '/admin/online-rl'
    case 'admin_registry':
      return '/admin/model-registry'
    case 'admin_health':
      return '/admin/system-health'
  }
}
