import { useEffect, useState } from 'react'
import { AlertTriangle, ShieldAlert, X } from 'lucide-react'

interface SafetyConfirmModalProps {
  isOpen: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'warning' | 'danger'
  requireReason?: boolean
  reasonLabel?: string
  reasonPlaceholder?: string
  minReasonLength?: number
  isSubmitting?: boolean
  onConfirm: (reason: string) => void
  onCancel: () => void
}

export function SafetyConfirmModal({
  isOpen,
  title,
  description,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy bỏ',
  variant = 'warning',
  requireReason = false,
  reasonLabel = 'Lý do thực hiện (lưu vào nhật ký kiểm toán)',
  reasonPlaceholder = 'Nhập lý do ngắn gọn...',
  minReasonLength = 5,
  isSubmitting = false,
  onConfirm,
  onCancel,
}: SafetyConfirmModalProps) {
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (!isOpen) {
      setReason('')
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onCancel()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, isSubmitting, onCancel])

  if (!isOpen) return null

  const canConfirm = !requireReason || reason.trim().length >= minReasonLength
  const isDanger = variant === 'danger'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-inverse-surface/50 backdrop-blur-[1.5px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="safety-confirm-title"
    >
      <div className="w-full max-w-md bg-white rounded-2xl border border-outline-variant shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-surface-container flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                isDanger
                  ? 'bg-error-container text-error'
                  : 'bg-ai-sunlit-bg text-tertiary border border-ai-sunlit-border/40'
              }`}
            >
              {isDanger ? (
                <ShieldAlert className="w-5 h-5" aria-hidden="true" />
              ) : (
                <AlertTriangle className="w-5 h-5" aria-hidden="true" />
              )}
            </div>
            <h2 id="safety-confirm-title" className="text-sm sm:text-base font-bold text-on-surface">
              {title}
            </h2>
          </div>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={onCancel}
            className="p-1.5 rounded-lg text-outline hover:bg-surface-container cursor-pointer"
            aria-label="Đóng hộp thoại"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">{description}</p>

          {requireReason && (
            <div className="space-y-1.5">
              <label htmlFor="safety-confirm-reason" className="block text-xs font-bold text-on-surface">
                {reasonLabel}
              </label>
              <textarea
                id="safety-confirm-reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={reasonPlaceholder}
                className="w-full rounded-xl border border-outline-variant bg-surface p-3 text-xs text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <p className="text-[11px] text-outline">
                Tối thiểu {minReasonLength} ký tự ({reason.trim().length}/{minReasonLength})
              </p>
            </div>
          )}
        </div>

        <div className="px-5 py-3.5 bg-surface-container-low border-t border-surface-container flex items-center justify-end gap-2.5">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onCancel}
            className="px-4 py-2 rounded-xl bg-white border border-outline-variant text-xs font-semibold text-on-surface hover:bg-surface-container cursor-pointer transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={!canConfirm || isSubmitting}
            onClick={() => onConfirm(reason.trim())}
            className={`px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm disabled:opacity-45 cursor-pointer transition-colors ${
              isDanger ? 'bg-error hover:bg-error-dim' : 'bg-tertiary hover:bg-tertiary-dim'
            }`}
          >
            {isSubmitting ? 'Đang xử lý...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
