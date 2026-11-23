import type { ReactNode } from 'react'
import { ArrowLeft, ChevronRight } from 'lucide-react'

export interface BreadcrumbItem {
  label: string
  onClick?: () => void
  isCurrent?: boolean
}

interface PageContextBarProps {
  backLabel?: string
  onBack?: () => void
  breadcrumbs?: BreadcrumbItem[]
  rightSlot?: ReactNode
  className?: string
}

export function PageContextBar({
  backLabel,
  onBack,
  breadcrumbs = [],
  rightSlot,
  className = '',
}: PageContextBarProps) {
  return (
    <div
      className={`w-full bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/40 px-4 py-3 flex flex-wrap items-center justify-between gap-3 ${className}`}
    >
      <div className="flex flex-wrap items-center gap-2.5 min-w-0">
        {backLabel && onBack && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container hover:bg-primary-container/60 text-xs font-semibold text-primary transition-colors cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>{backLabel}</span>
          </button>
        )}

        {backLabel && onBack && breadcrumbs.length > 0 && (
          <span className="text-outline-variant hidden sm:inline" aria-hidden="true">
            •
          </span>
        )}

        {breadcrumbs.length > 0 && (
          <nav
            aria-label="Điều hướng phân cấp"
            className="flex items-center gap-1.5 text-xs text-on-surface-variant flex-wrap"
          >
            {breadcrumbs.map((crumb, idx) => (
              <span key={`${crumb.label}-${idx}`} className="inline-flex items-center gap-1.5">
                {idx > 0 && (
                  <ChevronRight className="w-3.5 h-3.5 text-outline-variant shrink-0" aria-hidden="true" />
                )}
                {crumb.onClick && !crumb.isCurrent ? (
                  <button
                    type="button"
                    onClick={crumb.onClick}
                    className="hover:text-primary hover:underline font-medium cursor-pointer"
                  >
                    {crumb.label}
                  </button>
                ) : (
                  <span
                    className={
                      crumb.isCurrent ? 'font-semibold text-on-surface' : 'font-medium text-on-surface-variant'
                    }
                  >
                    {crumb.label}
                  </span>
                )}
              </span>
            ))}
          </nav>
        )}
      </div>

      {rightSlot && <div className="flex flex-wrap items-center gap-2 shrink-0">{rightSlot}</div>}
    </div>
  )
}
