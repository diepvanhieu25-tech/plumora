import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  MessageSquare,
  ShieldCheck,
} from 'lucide-react'
import type { DepthStepItem, TutorFeedbackOut } from '../../types'

export interface DepthProbeSidebarProps {
  stepItem: DepthStepItem | null
  isMcq: boolean
  completedTiers: Array<{ tier: number; score: number }>
  lastScore: number
  tutorFeedback: TutorFeedbackOut | null
  onOpenTutorDrawer: () => void
}

export function DepthProbeSidebar({
  stepItem,
  isMcq,
  completedTiers,
  lastScore,
  tutorFeedback,
  onOpenTutorDrawer,
}: DepthProbeSidebarProps) {
  return (
    <aside className="lg:col-span-4 flex flex-col gap-5">
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-outline-variant/50 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-surface-container">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" aria-hidden="true" />
            <h2 className="text-xs font-bold text-on-surface">
              Tiêu chí Đánh giá {stepItem ? `(Tầng ${stepItem.depth_tier})` : ''}
            </h2>
          </div>
          {stepItem?.rubric_summary && (
            <span className="text-[10px] font-bold text-primary bg-primary-container px-2 py-0.5 rounded-full">
              {stepItem.rubric_summary.length} tiêu chí
            </span>
          )}
        </div>

        {stepItem?.rubric_summary && stepItem.rubric_summary.length > 0 ? (
          <div className="space-y-2.5">
            {stepItem.rubric_summary.map((c, idx) => {
              const weightPct = Math.round(c.weight * 100)
              return (
                <div
                  key={`${c.name}-${idx}`}
                  className="p-3 rounded-xl bg-surface-container-low space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-on-surface">
                      {idx + 1}. {c.name}
                    </span>
                    <span className="text-[10px] font-mono font-semibold text-primary px-1.5 py-0.5 rounded bg-primary-container shrink-0">
                      {weightPct}%
                    </span>
                  </div>
                  <div className="w-full bg-surface-container rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-primary h-1.5 rounded-full"
                      style={{ width: `${Math.min(100, Math.max(15, weightPct))}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-xs text-on-surface-variant leading-relaxed">
            {isMcq
              ? 'Câu hỏi trắc nghiệm giúp kiểm tra nhanh nền tảng để mở khóa các câu hỏi tình huống chuyên sâu.'
              : 'Nhận xét chi tiết từng tiêu chí từ Gia sư AI sẽ hiển thị ngay sau khi bạn nộp bài.'}
          </p>
        )}

        <div className="p-3 rounded-xl bg-primary-container/30 border border-primary/20 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-on-surface-variant uppercase font-bold block">
              Điểm bước gần nhất
            </span>
            <span className="text-base font-extrabold text-primary font-mono">
              {completedTiers.length > 0 ? `${Math.round(lastScore * 100)} / 100` : '-- / 100'}
            </span>
          </div>
          <span className="text-[11px] font-semibold text-primary">Đạt &ge; 75</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-outline-variant/50 space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-surface-container">
          <Clock className="w-4 h-4 text-secondary" aria-hidden="true" />
          <h2 className="text-xs font-bold text-on-surface">Tiến trình Phiên này</h2>
        </div>

        {completedTiers.length === 0 ? (
          <p className="text-xs text-on-surface-variant">
            Chưa có bước nào hoàn tất trong phiên hiện tại.
          </p>
        ) : (
          <div className="space-y-2">
            {completedTiers.map((item, idx) => {
              const passedStep = item.score >= 0.75
              return (
                <div
                  key={`${item.tier}-${idx}`}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-surface-container-low text-xs"
                >
                  <span className="flex items-center gap-2 font-semibold text-on-surface">
                    {passedStep ? (
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-error shrink-0" aria-hidden="true" />
                    )}
                    <span>Tầng {item.tier}</span>
                  </span>
                  <span
                    className={`font-mono font-bold ${
                      passedStep ? 'text-primary' : 'text-error'
                    }`}
                  >
                    {Math.round(item.score * 100)}%
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {tutorFeedback && (
          <button
            type="button"
            onClick={onOpenTutorDrawer}
            className="w-full inline-flex items-center justify-between p-2.5 rounded-xl bg-ai-sunlit-bg border border-ai-sunlit-border/40 text-xs font-bold text-ai-sunlit-text cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-tertiary" aria-hidden="true" />
              <span>Mở lại Nhận xét Gia sư AI</span>
            </span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
    </aside>
  )
}
