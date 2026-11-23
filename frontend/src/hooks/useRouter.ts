import { useCallback, useEffect, useState } from 'react'
import { parseRoute, pathForView } from '../router'
import type { AssessmentSessionMode, ParsedRoute } from '../router'
import type { ActiveView } from '../types'

function readCurrentRoute(): ParsedRoute {
  if (typeof window === 'undefined') {
    return parseRoute('/', '')
  }
  return parseRoute(window.location.pathname || '/', window.location.search || '')
}

export function useRouter() {
  const [route, setRoute] = useState<ParsedRoute>(readCurrentRoute)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onPopState = () => {
      setRoute(readCurrentRoute())
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const pushPath = useCallback((nextPath: string) => {
    if (typeof window !== 'undefined') {
      const currentFull = `${window.location.pathname}${window.location.search}`
      if (currentFull !== nextPath) {
        window.history.pushState({}, '', nextPath)
      }
      setRoute(readCurrentRoute())
    } else {
      const [pathname, search = ''] = nextPath.split('?')
      setRoute(parseRoute(pathname, search ? `?${search}` : ''))
    }
  }, [])

  const navigate = useCallback(
    (
      view: ActiveView,
      params?: {
        domainSlug?: string
        conceptSlug?: string
        sessionMode?: AssessmentSessionMode
      },
    ) => {
      const nextPath = pathForView(view, {
        domainSlug: params?.domainSlug ?? route.domainSlug,
        conceptSlug: params?.conceptSlug ?? route.conceptSlug,
        sessionMode: params?.sessionMode ?? route.sessionMode,
      })
      pushPath(nextPath)
    },
    [pushPath, route.conceptSlug, route.domainSlug, route.sessionMode],
  )

  return {
    route,
    navigate,
    pushPath,
  }
}
