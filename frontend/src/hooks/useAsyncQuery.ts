import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiDomainError } from '../api/httpClient'

export interface AsyncQueryResult<T> {
  data: T | null
  loading: boolean
  error: ApiDomainError | Error | null
  errorMessage: string | null
  refetch: () => void
}

export function useAsyncQuery<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: readonly unknown[],
  options: { enabled?: boolean; initialData?: T | null } = {},
): AsyncQueryResult<T> {
  const { enabled = true, initialData = null } = options
  const [data, setData] = useState<T | null>(initialData)
  const [loading, setLoading] = useState<boolean>(enabled && initialData === null)
  const [error, setError] = useState<ApiDomainError | Error | null>(null)
  const [reloadTick, setReloadTick] = useState(0)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const refetch = useCallback(() => {
    setReloadTick((t) => t + 1)
  }, [])

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }
    const controller = new AbortController()
    let active = true
    setLoading(true)
    setError(null)

    fetcherRef
      .current(controller.signal)
      .then((res) => {
        if (!active || controller.signal.aborted) return
        setData(res)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (!active || controller.signal.aborted) return
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err instanceof Error ? err : new Error('Đã xảy ra lỗi khi tải dữ liệu'))
        setLoading(false)
      })

    return () => {
      active = false
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, reloadTick, ...deps])

  return {
    data,
    loading,
    error,
    errorMessage: error ? error.message : null,
    refetch,
  }
}
