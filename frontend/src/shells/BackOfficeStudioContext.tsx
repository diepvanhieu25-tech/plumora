import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { apiGetDomains } from '../api/learnerV2Api'
import type { DomainListItem } from '../types/learnerV2'

export interface BackOfficeStudioContextValue {
  domains: DomainListItem[]
  loadingDomains: boolean
  refreshDomains: () => Promise<DomainListItem[]>
  selectedDomainSlug: string
  setSelectedDomainSlug: (slug: string) => void
  selectedConceptSlug: string
  setSelectedConceptSlug: (slug: string) => void
  selectedDepthTier: number
  setSelectedDepthTier: (tier: number) => void
  isDirty: boolean
  setIsDirty: (dirty: boolean) => void
  requestGuardedAction: (action: () => void) => void
  pendingNavigationPrompt: {
    open: boolean
    confirmDiscard: () => void
    cancel: () => void
  }
}

const BackOfficeStudioContext = createContext<BackOfficeStudioContextValue | null>(null)

export function BackOfficeStudioProvider({
  initialDomainSlug = 'backend',
  initialConceptSlug = 'net-internet',
  children,
}: {
  initialDomainSlug?: string
  initialConceptSlug?: string
  children: React.ReactNode
}) {
  const [domains, setDomains] = useState<DomainListItem[]>([])
  const [loadingDomains, setLoadingDomains] = useState(true)
  const [selectedDomainSlug, setSelectedDomainSlugState] = useState(initialDomainSlug)
  const [selectedConceptSlug, setSelectedConceptSlugState] = useState(initialConceptSlug)
  const [selectedDepthTier, setSelectedDepthTier] = useState(3)
  const [isDirty, setIsDirty] = useState(false)
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)

  const refreshDomains = useCallback(async (): Promise<DomainListItem[]> => {
    setLoadingDomains(true)
    try {
      const res = await apiGetDomains()
      setDomains(res.domains)
      return res.domains
    } catch {
      return []
    } finally {
      setLoadingDomains(false)
    }
  }, [])

  useEffect(() => {
    void refreshDomains()
  }, [refreshDomains])

  const setSelectedDomainSlug = useCallback((slug: string) => {
    setSelectedDomainSlugState(slug)
  }, [])

  const setSelectedConceptSlug = useCallback((slug: string) => {
    setSelectedConceptSlugState(slug)
  }, [])

  const requestGuardedAction = useCallback(
    (action: () => void) => {
      if (!isDirty) {
        action()
        return
      }
      setPendingAction(() => action)
    },
    [isDirty],
  )

  const confirmDiscard = useCallback(() => {
    const fn = pendingAction
    setIsDirty(false)
    setPendingAction(null)
    if (fn) fn()
  }, [pendingAction])

  const cancel = useCallback(() => {
    setPendingAction(null)
  }, [])

  return (
    <BackOfficeStudioContext.Provider
      value={{
        domains,
        loadingDomains,
        refreshDomains,
        selectedDomainSlug,
        setSelectedDomainSlug,
        selectedConceptSlug,
        setSelectedConceptSlug,
        selectedDepthTier,
        setSelectedDepthTier,
        isDirty,
        setIsDirty,
        requestGuardedAction,
        pendingNavigationPrompt: {
          open: pendingAction !== null,
          confirmDiscard,
          cancel,
        },
      }}
    >
      {children}
    </BackOfficeStudioContext.Provider>
  )
}

export function useBackOfficeStudio(): BackOfficeStudioContextValue {
  const ctx = useContext(BackOfficeStudioContext)
  if (!ctx) {
    throw new Error('useBackOfficeStudio must be used inside BackOfficeStudioProvider')
  }
  return ctx
}

/** Optional variant for pages rendered standalone in unit tests without BackOfficeStudioProvider. */
export function useOptionalBackOfficeStudio(): BackOfficeStudioContextValue | null {
  return useContext(BackOfficeStudioContext)
}
