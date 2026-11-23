import { useCallback, useEffect, useState } from 'react'

export function useDraftStorage(storageKey: string, initialValue: string = '') {
  const [value, setValue] = useState<string>(() => {
    if (typeof window === 'undefined' || !storageKey) return initialValue
    try {
      const saved = window.localStorage.getItem(storageKey)
      return saved !== null ? saved : initialValue
    } catch {
      return initialValue
    }
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !storageKey) return
    try {
      const saved = window.localStorage.getItem(storageKey)
      setValue(saved !== null ? saved : initialValue)
    } catch {
      setValue(initialValue)
    }
  }, [storageKey, initialValue])

  const updateValue = useCallback(
    (next: string) => {
      setValue(next)
      if (typeof window === 'undefined' || !storageKey) return
      try {
        window.localStorage.setItem(storageKey, next)
      } catch {
        // Ignore storage quota errors
      }
    },
    [storageKey],
  )

  const clearDraft = useCallback(() => {
    setValue(initialValue)
    if (typeof window === 'undefined' || !storageKey) return
    try {
      window.localStorage.removeItem(storageKey)
    } catch {
      // Ignore storage errors
    }
  }, [storageKey, initialValue])

  return [value, updateValue, clearDraft] as const
}
