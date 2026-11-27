import { useEffect } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
} from 'lucide-react'
import type { ToastNotification } from '../../types'

interface ToastProps {
  toast: ToastNotification | null
  onClose: () => void
}

const TOAST_STYLES = {
  success: {
    container: 'bg-[#F0FDF4] border-[#16A34A] text-[#14532D]',
    icon: CheckCircle2,
    iconColor: 'text-[#16A34A]',
    closeBtn: 'text-[#15803D] hover:text-[#166534]',
  },
  info: {
    container: 'bg-[#EFF6FF] border-[#3B82F6] text-[#1E40AF]',
    icon: Info,
    iconColor: 'text-[#3B82F6]',
    closeBtn: 'text-[#2563EB] hover:text-[#1D4ED8]',
  },
  warning: {
    container: 'bg-[#FFFBEB] border-[#F59E0B] text-[#92400E]',
    icon: AlertTriangle,
    iconColor: 'text-[#D97706]',
    closeBtn: 'text-[#B45309] hover:text-[#78350F]',
  },
  error: {
    container: 'bg-[#FEF2F2] border-[#EF4444] text-[#991B1B]',
    icon: AlertCircle,
    iconColor: 'text-[#DC2626]',
    closeBtn: 'text-[#DC2626] hover:text-[#991B1B]',
  },
}

export function Toast({ toast, onClose }: ToastProps) {
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => {
      onClose()
    }, 4500)
    return () => clearTimeout(timer)
  }, [toast, onClose])

  if (!toast) return null

  const type = toast.type || 'info'
  const style = TOAST_STYLES[type] || TOAST_STYLES.info
  const IconComponent = style.icon

  return (
    <div
      role="status"
      aria-live="polite"
      className="max-w-7xl mx-auto mt-3 px-4 sm:px-6 z-50"
      data-testid={`system-toast-${type}`}
    >
      <div
        className={`border px-4 py-3 rounded-xl text-xs sm:text-sm font-medium flex items-center justify-between shadow-sm transition-all animate-fadeIn ${style.container}`}
      >
        <div className="flex items-center gap-2.5">
          <IconComponent className={`w-4 h-4 shrink-0 ${style.iconColor}`} aria-hidden="true" />
          <span className="leading-snug">{toast.message}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className={`p-1 rounded-md transition-colors cursor-pointer shrink-0 ml-3 ${style.closeBtn}`}
          aria-label="Đóng thông báo"
          data-testid="toast-close-btn"
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
