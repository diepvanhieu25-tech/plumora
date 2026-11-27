import { ArrowRight, BookOpen, Check, Compass, Sparkles } from 'lucide-react'
import type { DomainRoadmapNode, V2RecommendationResponse } from '../../types'
import { formatNextReviewCountdown } from '../ui/RetentionMeter'

const MODE_META: Record<
  string,
  { title: string; desc: string; ctaLabel: string }
> = {
  Learn_New: {
    title: 'Đọc Bài giảng Lý thuyết',
    desc: 'Tìm hiểu mô hình tư duy, ví dụ thực tế và hoàn thành bài giảng trước khi kiểm tra đào sâu.',
    ctaLabel: 'Bắt đầu Học Lý thuyết',
  },
  Deep_Probe: {
    title: 'Kiểm tra Đào sâu 5 Tầng',
    desc: 'Củng cố hiểu biết bản chất, phân tích đánh đổi kiến trúc và xử lý tình huống thực tế.',
    ctaLabel: 'Vào Kiểm tra Đào sâu 5 Tầng',
  },
  Code_Practice: {
    title: 'Thực hành Lập trình Trực tiếp',
    desc: 'Đọc hiểu, sửa lỗi mã nguồn thực tế và vượt qua bộ kiểm thử tự động.',
    ctaLabel: 'Mở Phòng Thực hành Code',
  },
  Spaced_Review: {
    title: 'Ôn tập Củng cố Trí nhớ',
    desc: 'Ôn lại nhanh kiến thức đến hạn để khôi phục độ nhớ và kéo dài chu kỳ bền vững.',
    ctaLabel: 'Ôn tập Nhanh Ngay',
  },
}

export interface RoadmapRecommendationBannerProps {
  domainSlug: string
  rec: V2RecommendationResponse
  recommendedNode: DomainRoadmapNode | null
  onCtaRecommended: () => void
  onOpenPlaybook: (domainSlug: string, node: DomainRoadmapNode) => void
}

export function RoadmapRecommendationBanner({
  domainSlug,
  rec,
  recommendedNode,
  onCtaRecommended,
  onOpenPlaybook,
}: RoadmapRecommendationBannerProps) {
  if (!rec.recommended_action) return null
  const recMode = rec.recommended_action.learning_mode ?? 'Learn_New'
  const recModeMeta = MODE_META[recMode] ?? MODE_META.Learn_New

  return (
    <div
      role="region"
      aria-live="polite"
      aria-label="Gợi ý bước học tiếp theo"
      className="rounded-3xl p-6 sm:p-7 bg-ai-sunlit-bg shadow-sm border-2 border-ai-sunlit-border"
      data-testid="gnn-ppo-banner"
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-tertiary text-on-tertiary text-xs font-bold">
            <Compass className="w-4 h-4" aria-hidden="true" />
            <span>Gợi ý Bước học Tối ưu Tiếp theo</span>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 border border-ai-sunlit-border/40 text-xs font-bold text-ai-sunlit-text">
            <Sparkles className="w-3.5 h-3.5 text-tertiary" aria-hidden="true" />
            <span>{recModeMeta.title}</span>
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          <div className="lg:col-span-8 space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-primary-container text-on-primary-container text-xs font-bold">
                Tầng {rec.recommended_action.tier}
              </span>
              {recommendedNode && recommendedNode.depth_level_norm >= 0.5 && (
                <span className="text-xs font-medium text-on-surface-variant">
                  {formatNextReviewCountdown(
                    recommendedNode.next_review_due_at,
                    recommendedNode.needs_review,
                  )}
                </span>
              )}
            </div>

            <h2 className="font-headline font-extrabold text-xl sm:text-2xl text-on-surface leading-tight">
              {rec.recommended_action.title}
            </h2>

            <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed max-w-2xl">
              {rec.recommended_action.reason_vi}
            </p>

            {rec.decision_factors && rec.decision_factors.length > 0 && (
              <ul className="space-y-1 pt-1" data-testid="rl-decision-factors">
                {rec.decision_factors.map((factor, fIdx) => (
                  <li
                    key={fIdx}
                    className="text-xs text-ai-sunlit-text font-medium flex items-start gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{factor}</span>
                  </li>
                ))}
              </ul>
            )}

            <p className="text-xs text-on-surface-variant font-medium flex items-center gap-1.5 pt-0.5">
              <span>{recModeMeta.desc}</span>
            </p>
          </div>

          <div className="lg:col-span-4 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onCtaRecommended}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-primary text-on-primary hover:bg-primary-dim font-headline font-bold text-sm shadow-sm transition-colors cursor-pointer"
            >
              <span>{recModeMeta.ctaLabel}</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>

            {recommendedNode && recMode !== 'Learn_New' && (
              <button
                type="button"
                onClick={() => onOpenPlaybook(domainSlug, recommendedNode)}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-outline-variant text-on-surface hover:border-primary hover:text-primary font-bold text-xs transition-colors cursor-pointer"
              >
                <BookOpen className="w-4 h-4" aria-hidden="true" />
                <span>Xem lại Bài giảng Lý thuyết</span>
              </button>
            )}
          </div>
        </div>

        {/* 3-Step Adaptive RL Planned Path (D-39) */}
        {rec.planned_next_steps && rec.planned_next_steps.length > 1 && (
          <div
            className="pt-4 border-t border-ai-sunlit-border/40 space-y-2.5"
            data-testid="rl-planned-path"
          >
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-ai-sunlit-text">
              Chuỗi {rec.planned_next_steps.length} chặng RL thích ứng đề xuất tiếp theo
            </span>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {rec.planned_next_steps.map((step) => (
                <div
                  key={`${step.step_order}-${step.concept_slug}`}
                  className={`p-3 rounded-xl border text-xs space-y-1 ${
                    step.step_order === 1
                      ? 'bg-white border-primary/50 shadow-xs'
                      : 'bg-white/75 border-ai-sunlit-border/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-extrabold text-[11px] text-primary">
                      Chặng {step.step_order}
                    </span>
                    <span className="text-[10px] font-mono text-on-surface-variant">
                      ~{step.estimated_minutes} phút
                    </span>
                  </div>
                  <p className="font-bold text-on-surface truncate" title={step.title}>
                    {step.title}
                  </p>
                  <p className="text-[11px] text-on-surface-variant leading-snug">
                    {step.goal_summary}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
