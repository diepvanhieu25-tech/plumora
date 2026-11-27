import { Clock, History } from 'lucide-react'

export function formatNextReviewCountdown(
  nextReviewDueAt?: string | null,
  needsReview: boolean = false,
): string {
  if (needsReview) return 'Đến hạn ôn tập ngay'
  if (!nextReviewDueAt) return 'Chưa có lịch ôn tập'

  const dueMs = new Date(nextReviewDueAt).getTime()
  if (Number.isNaN(dueMs)) return 'Chưa có lịch ôn tập'

  const diffMs = dueMs - Date.now()
  if (diffMs <= 0) return 'Đến hạn ôn tập ngay'

  const diffHours = Math.ceil(diffMs / (1000 * 60 * 60))
  if (diffHours < 24) {
    return `Ôn lại sau ~${diffHours} giờ`
  }
  const diffDays = Math.ceil(diffHours / 24)
  return `Ôn lại sau ${diffDays} ngày`
}

interface RetentionMeterProps {
  retention: number
  needsReview: boolean
  active: boolean
  nextReviewDueAt?: string | null
  showSchedule?: boolean
  className?: string
}

export function RetentionMeter({
  retention,
  needsReview,
  active,
  nextReviewDueAt,
  showSchedule = false,
  className = '',
}: RetentionMeterProps) {
  const retentionPct = Math.round(retention * 100)
  const scheduleText = active
    ? formatNextReviewCountdown(nextReviewDueAt, needsReview)
    : 'Bắt đầu theo dõi khi đạt mức 50%'

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex items-center justify-between text-[11px]">
        <span
          className={`inline-flex items-center gap-1 font-medium ${
            needsReview ? 'text-tertiary font-bold' : 'text-on-surface-variant'
          }`}
        >
          {needsReview ? (
            <History className="w-3 h-3 text-tertiary" aria-hidden="true" />
          ) : (
            <Clock className="w-3 h-3 text-secondary" aria-hidden="true" />
          )}
          <span>Độ bền ghi nhớ</span>
        </span>
        <span
          className={`font-mono font-bold ${
            !active
              ? 'text-outline'
              : needsReview
                ? 'text-tertiary'
                : 'text-secondary'
          }`}
        >
          {active ? `${retentionPct}%` : '—'}
        </span>
      </div>

      <div className="w-full h-1.5 rounded-full bg-surface-container-highest overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            needsReview ? 'bg-tertiary' : 'bg-secondary'
          }`}
          style={{ width: `${active ? Math.max(4, retentionPct) : 0}%` }}
        />
      </div>

      {showSchedule && (
        <p
          className={`text-[10px] font-medium ${
            needsReview ? 'text-tertiary font-semibold' : 'text-outline'
          }`}
        >
          {scheduleText}
        </p>
      )}
    </div>
  )
}
