import { useEffect } from 'react'
import { BookOpen, X } from 'lucide-react'
import { apiGetConceptPlaybook } from '../api'
import { useAsyncQuery } from '../hooks/useAsyncQuery'
import { MarkdownRenderer } from './ui/MarkdownRenderer'
import { StatusAlertBanner } from './ui/StatusAlertBanner'

interface PlaybookQuickDrawerProps {
  isOpen: boolean
  onClose: () => void
  domainSlug: string
  conceptSlug: string
}

export function PlaybookQuickDrawer({
  isOpen,
  onClose,
  domainSlug,
  conceptSlug,
}: PlaybookQuickDrawerProps) {
  const { data, loading, errorMessage, refetch } = useAsyncQuery(
    (signal) => apiGetConceptPlaybook(domainSlug, conceptSlug, signal),
    [domainSlug, conceptSlug],
    { enabled: isOpen && Boolean(domainSlug) && Boolean(conceptSlug) },
  )

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-inverse-surface/45 backdrop-blur-[1.5px]"
      role="dialog"
      aria-modal="true"
      aria-label="Tra cứu nhanh Bài học Lý thuyết"
      data-testid="playbook-quick-drawer"
    >
      <div className="w-full max-w-2xl bg-white text-on-surface h-full shadow-2xl border-l border-outline-variant flex flex-col">
        <div className="px-5 py-4 border-b border-surface-container bg-surface-container-low flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary-container text-on-primary-container flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-primary uppercase tracking-wider block">
                Tra cứu nhanh Lý thuyết
              </span>
              <h2 className="text-sm sm:text-base font-bold text-on-surface truncate">
                {data?.node.title ?? 'Đang tải bài học...'}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-lg text-outline hover:bg-white hover:text-on-surface cursor-pointer"
            aria-label="Đóng khung tra cứu lý thuyết"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="space-y-3">
              <div className="h-6 w-2/3 rounded bg-surface-container animate-pulse" />
              <div className="h-24 rounded-xl bg-surface-container animate-pulse" />
              <div className="h-32 rounded-xl bg-surface-container animate-pulse" />
            </div>
          )}

          {!loading && errorMessage && (
            <StatusAlertBanner variant="error" message={errorMessage} onRetry={refetch} />
          )}

          {!loading && !errorMessage && data && (
            <MarkdownRenderer
              markdown={
                data.node.lesson_markdown?.trim()
                  ? data.node.lesson_markdown
                  : `## ${data.node.title}\n\nNội dung bài học lý thuyết đang được cập nhật.`
              }
            />
          )}
        </div>

        <div className="px-5 py-3.5 border-t border-surface-container bg-surface-container-low flex items-center justify-between gap-3">
          <span className="text-xs text-on-surface-variant">
            Bài làm hiện tại của bạn vẫn được giữ nguyên.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-dim text-on-primary text-xs font-bold cursor-pointer transition-colors"
          >
            Quay lại tiếp tục làm bài
          </button>
        </div>
      </div>
    </div>
  )
}
