import type { ReactNode } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, Info, RefreshCw } from 'lucide-react'

export type AlertVariant = 'error' | 'warning' | 'info' | 'success'

interface StatusAlertBannerProps {
  variant?: AlertVariant
  title?: string
  message: string
  onRetry?: () => void
  retryLabel?: string
  actionSlot?: ReactNode
  className?: string
  'data-testid'?: string
}

const VARIANT_STYLES: Record<
  AlertVariant,
  { container: string; iconColor: string; Icon: typeof AlertCircle }
> = {
  error: {
    container: 'bg-error-container/35 border-error/35 text-error',
    iconColor: 'text-error',
    Icon: AlertCircle,
  },
  warning: {
    container: 'bg-ai-sunlit-bg border-ai-sunlit-border/50 text-ai-sunlit-text',
    iconColor: 'text-tertiary',
    Icon: AlertTriangle,
  },
  info: {
    container: 'bg-shared-bg border-shared-border text-shared-text',
    iconColor: 'text-shared-text',
    Icon: Info,
  },
  success: {
    container: 'bg-primary-container/60 border-primary/35 text-on-primary-container',
    iconColor: 'text-primary',
    Icon: CheckCircle2,
  },
}

export function StatusAlertBanner({
  variant = 'error',
  title,
  message,
  onRetry,
  retryLabel = 'Thử lại',
  actionSlot,
  className = '',
  'data-testid': testId,
}: StatusAlertBannerProps) {
  const style = VARIANT_STYLES[variant]
  const Icon = style.Icon
  const isAlert = variant === 'error' || variant === 'warning'

  return (
    <div
      role={isAlert ? 'alert' : 'status'}
      aria-live={isAlert ? 'assertive' : 'polite'}
      data-testid={testId}
      className={`rounded-xl border p-4 flex flex-wrap items-center justify-between gap-3 ${style.container} ${className}`}
    >
      <div className="flex items-start gap-2.5 min-w-0 flex-1">
        <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${style.iconColor}`} aria-hidden="true" />
        <div className="text-xs sm:text-sm leading-relaxed space-y-0.5">
          {title && <p className="font-bold">{title}</p>}
          <p className="font-medium">{message}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {actionSlot}
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-current/25 text-xs font-bold hover:opacity-90 cursor-pointer transition-opacity"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{retryLabel}</span>
          </button>
        )}
      </div>
    </div>
  )
}
