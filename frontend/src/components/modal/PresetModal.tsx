interface PresetModalProps {
  pendingPreset: { key: string; title: string } | null
  onCancel: () => void
  onConfirm: () => Promise<void>
}

export function PresetModal({
  pendingPreset,
  onCancel,
  onConfirm,
}: PresetModalProps) {
  if (!pendingPreset) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="scr05-modal-title"
      className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4"
      data-testid="scr05-preset-modal"
    >
      <div className="bg-white rounded-xl max-w-md w-full p-6 border border-[#D8E2D8] space-y-4 shadow-xl">
        <h2 id="scr05-modal-title" className="text-lg font-bold text-[#14241B]">
          Xác nhận áp dụng Hồ sơ mẫu (Demo Preset)
        </h2>
        <p className="text-xs text-[#3F5247]">
          Thao tác này sẽ đặt lại tiến độ 12 khái niệm của tài khoản hiện tại theo{' '}
          <strong>{pendingPreset.title}</strong> trong 1 giao dịch ACID trên PostgreSQL và đồng bộ sang Redis.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="plumora-btn-outline text-xs"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="plumora-btn-primary text-xs"
            data-testid="confirm-preset-btn"
          >
            Xác nhận áp dụng Preset
          </button>
        </div>
      </div>
    </div>
  )
}
