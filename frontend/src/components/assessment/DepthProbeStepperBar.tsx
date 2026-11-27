import {
  AlertTriangle,
  CheckCircle2,
  History,
  Layers,
  Lock,
  Target,
} from 'lucide-react'
import type { DepthStepItem, UpdatedCompetencyOut } from '../../types'

const TIER_META: Record<
  number,
  { short: string; desc: string; depthTarget: string }
> = {
  1: { short: 'Khái niệm', desc: 'Nhận diện định nghĩa & vai trò', depthTarget: '25%' },
  2: { short: 'Cơ chế', desc: 'Cách hệ thống hoạt động bên trong', depthTarget: '50%' },
  3: { short: 'Tình huống', desc: 'Chẩn đoán lỗi & xử lý thực tế', depthTarget: '75%' },
  4: { short: 'Đánh đổi', desc: 'Phân tích ràng buộc & lựa chọn thiết kế', depthTarget: '75%' },
  5: { short: 'Bản chất', desc: 'Truyền đạt lại theo tư duy Feynman', depthTarget: '100% (với Code)' },
}

export interface DepthProbeStepperBarProps {
  isSpacedReview: boolean
  sessionStatus: string
  stepItem: DepthStepItem | null
  completedTiers: Array<{ tier: number; score: number }>
  updatedComp: UpdatedCompetencyOut | null
}

export function DepthProbeStepperBar({
  isSpacedReview,
  sessionStatus,
  stepItem,
  completedTiers,
  updatedComp,
}: DepthProbeStepperBarProps) {
  if (isSpacedReview) {
    return (
      <div
        className="bg-ai-sunlit-bg p-5 rounded-2xl border border-ai-sunlit-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        data-testid="spaced-review-header"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-tertiary text-on-tertiary flex items-center justify-center shrink-0">
            <History className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-headline font-extrabold text-ai-sunlit-text">
              Trạm Ôn tập Củng cố Nhanh (1 Tình huống Trọng tâm)
            </h2>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Hoàn thành câu hỏi trọng tâm dưới đây để khôi phục độ bền ghi nhớ lên 100% và kéo dài chu kỳ ôn tập tiếp theo.
            </p>
          </div>
        </div>
        <span className="px-3 py-1 rounded-full bg-white border border-ai-sunlit-border/40 text-xs font-bold text-ai-sunlit-text shrink-0 self-start sm:self-auto">
          1 Bước • ~3 phút
        </span>
      </div>
    )
  }

  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-outline-variant/50 flex flex-col xl:flex-row xl:items-center justify-between gap-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 flex-1">
        {[1, 2, 3, 4, 5].map((t) => {
          const active = stepItem?.depth_tier === t
          const passed =
            sessionStatus === 'completed' ||
            (stepItem !== null && stepItem.depth_tier > t) ||
            completedTiers.some((c) => c.tier === t && c.score >= 0.75)
          const stoppedAtCeiling =
            !active && !passed && !stepItem && completedTiers.some((c) => c.tier === t)
          const info = TIER_META[t]

          return (
            <div
              key={t}
              className={`relative flex flex-col p-3 rounded-xl space-y-1 transition-all ${
                active
                  ? 'bg-ai-sunlit-bg border-2 border-ai-sunlit-border shadow-xs'
                  : passed
                    ? 'bg-primary-container/25 border border-primary/25'
                    : stoppedAtCeiling
                      ? 'bg-error-container/25 border border-error/40'
                      : 'bg-surface-container-low border border-outline-variant/30 opacity-80'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[11px] font-bold flex items-center gap-1.5 ${
                    active
                      ? 'text-tertiary'
                      : passed
                        ? 'text-primary'
                        : stoppedAtCeiling
                          ? 'text-error'
                          : 'text-on-surface-variant'
                  }`}
                >
                  <span>
                    Tầng {t} • {info.short}
                  </span>
                </span>
                {passed ? (
                  <CheckCircle2 className="w-4 h-4 text-primary" aria-hidden="true" />
                ) : stoppedAtCeiling ? (
                  <AlertTriangle className="w-4 h-4 text-error" aria-hidden="true" />
                ) : active ? (
                  <Target className="w-4 h-4 text-tertiary" aria-hidden="true" />
                ) : (
                  <Lock className="w-4 h-4 text-outline" aria-hidden="true" />
                )}
              </div>
              <p className="text-[11px] text-on-surface-variant truncate">{info.desc}</p>
              <span
                className={`text-[10px] font-bold self-start px-1.5 py-0.5 rounded ${
                  active
                    ? 'text-on-tertiary bg-tertiary'
                    : passed
                      ? 'text-primary bg-white'
                      : stoppedAtCeiling
                        ? 'text-error bg-error-container/40'
                        : 'text-outline bg-white/70'
                }`}
              >
                {active
                  ? 'ĐANG LÀM'
                  : passed
                    ? `ĐÃ QUA (${info.depthTarget})`
                    : stoppedAtCeiling
                      ? 'CHƯA ĐẠT'
                      : 'CHỜ MỞ'}
              </span>
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/50 shrink-0">
        <Layers className="w-5 h-5 text-primary shrink-0" aria-hidden="true" />
        <div>
          <span className="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold block">
            Mức hiểu hiện tại
          </span>
          <span className="text-xs font-extrabold text-primary">
            {updatedComp
              ? `${updatedComp.depth_label} (${Math.round(updatedComp.depth_level_norm * 100)}%)`
              : stepItem
                ? `Đang kiểm tra Tầng ${stepItem.depth_tier}`
                : 'Đang cập nhật'}
          </span>
        </div>
      </div>
    </div>
  )
}
