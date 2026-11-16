import { CheckCircle2, SlidersHorizontal } from 'lucide-react'

interface DemoPresetToolbarProps {
  isLoading: boolean
  onSelectPreset: (preset: { key: string; title: string }) => void
  currentUsername?: string
  masteredCount: number
}

const PRESETS = [
  { key: 'new_learner', title: '1. Mới bắt đầu (0/12)' },
  { key: 'foundation_ready', title: '2. Xong Nền tảng (4/12)' },
  { key: 'api_stage_ready', title: '3. Tầng API (7/12)' },
]

export function DemoPresetToolbar({
  isLoading,
  onSelectPreset,
  currentUsername = 'learner_foundation',
  masteredCount,
}: DemoPresetToolbarProps) {
  return (
    <section className="bg-white border-b border-[#D8E2D8] -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-2.5 text-xs text-[#14241B]">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {/* Left: Preset Switcher */}
        <div className="flex items-center flex-wrap gap-2">
          <div className="flex items-center gap-1.5 text-[#3F5247] font-semibold mr-1">
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#15803D]" aria-hidden="true" />
            <span>Hồ sơ mẫu (Demo Presets):</span>
          </div>

          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              disabled={isLoading}
              onClick={() => onSelectPreset(p)}
              className="px-2.5 py-1 rounded-md border border-[#D8E2D8] bg-[#F6F8F5] hover:bg-[#F0FDF4] hover:border-[#15803D] hover:text-[#15803D] font-medium transition-colors disabled:opacity-50 cursor-pointer"
              data-testid={`preset-btn-${p.key}`}
            >
              {p.title}
            </button>
          ))}
        </div>

        {/* Right: Snapshot Chip */}
        <div className="flex items-center gap-2 text-[#3F5247] font-mono text-[11px]">
          <span className="inline-flex items-center gap-1 bg-[#F6F8F5] px-2.5 py-1 rounded-md border border-[#D8E2D8]">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D]" aria-hidden="true" />
            <span>
              Hồ sơ: <strong className="text-[#14241B]">{currentUsername}</strong>
            </span>
          </span>
          <span className="hidden md:inline">•</span>
          <span className="hidden md:inline text-[#3F5247]">
            Trạng thái:{' '}
            <strong className="text-[#15803D] font-bold">
              {masteredCount}/12 Khái niệm hoàn thành
            </strong>
          </span>
        </div>
      </div>
    </section>
  )
}
