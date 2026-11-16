import { SlidersHorizontal } from 'lucide-react'

interface DemoPresetToolbarProps {
  isLoading: boolean
  onSelectPreset: (preset: { key: string; title: string }) => void
}

export function DemoPresetToolbar({
  isLoading,
  onSelectPreset,
}: DemoPresetToolbarProps) {
  return (
    <div className="plumora-card flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="w-4 h-4 text-[#15803D]" aria-hidden="true" />
        <span className="text-xs font-bold uppercase tracking-wider text-[#3F5247]">
          Đặt lại Hồ sơ mẫu (POST /api/v1/me/preset):
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isLoading}
          onClick={() =>
            onSelectPreset({
              key: 'new_learner',
              title: '1. Mới bắt đầu (0/12 Node)',
            })
          }
          className="plumora-btn-outline text-xs"
          data-testid="preset-btn-new_learner"
        >
          1. Mới bắt đầu (0/12)
        </button>
        <button
          type="button"
          disabled={isLoading}
          onClick={() =>
            onSelectPreset({
              key: 'foundation_ready',
              title: '2. Xong Nền tảng (4/12 Node)',
            })
          }
          className="plumora-btn-outline text-xs"
          data-testid="preset-btn-foundation_ready"
        >
          2. Xong Nền tảng (4/12)
        </button>
        <button
          type="button"
          disabled={isLoading}
          onClick={() =>
            onSelectPreset({
              key: 'api_stage_ready',
              title: '3. Tầng API (7/12 Node)',
            })
          }
          className="plumora-btn-outline text-xs"
          data-testid="preset-btn-api_stage_ready"
        >
          3. Tầng API (7/12)
        </button>
      </div>
    </div>
  )
}
