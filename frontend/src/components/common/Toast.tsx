interface ToastProps {
  message: string | null
  onClose: () => void
}

export function Toast({ message, onClose }: ToastProps) {
  if (!message) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="max-w-7xl mx-auto mt-3 px-6"
    >
      <div className="bg-[#F0FDF4] border border-[#16A34A] text-[#14532D] px-4 py-2.5 rounded-lg text-xs font-medium flex items-center justify-between shadow-xs">
        <span>{message}</span>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-semibold underline text-[#15803D] hover:text-[#166534]"
        >
          Đóng
        </button>
      </div>
    </div>
  )
}
