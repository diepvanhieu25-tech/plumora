import { BookOpen, CheckCircle2, Compass, Cpu, Database, ShieldCheck } from 'lucide-react'
import type { RecommendationPayload } from '../../types'

interface AiRecommendationBannerProps {
  recommendation: RecommendationPayload
  masteredCount: number
  onStartRecommended: (slug: string) => void
}

export function AiRecommendationBanner({
  recommendation,
  masteredCount,
  onStartRecommended,
}: AiRecommendationBannerProps) {
  if (recommendation.status === 'completed' || masteredCount === 12) {
    return (
      <div
        role="region"
        aria-live="polite"
        className="p-6 rounded-xl bg-[#F0FDF4] border-2 border-[#16A34A] text-[#14532D] flex flex-wrap items-center justify-between gap-4 shadow-xs"
        data-testid="scr07-completed-banner"
      >
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-7 h-7 text-[#16A34A] shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <h2 className="text-lg font-bold">
              HOÀN THÀNH KHÓA HỌC 12/12 KHÁI NIỆM BACKEND (MASTERED &gt;= 75%)
            </h2>
            <p className="text-sm text-[#3F5247]">
              Bạn đã chinh phục toàn bộ 4 tầng đồ thị tiên quyết DAG. Bạn có thể ôn tập lại bất kỳ bài nào hoặc chọn Preset khác để thử nghiệm.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      role="region"
      aria-live="polite"
      className="p-6 rounded-xl bg-[#FFFBEB] border-2 border-[#D97706] text-[#78350F] shadow-xs"
      data-testid="ai-recommendation-banner"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#78350F]">
            <Compass className="w-4 h-4 text-[#D97706]" aria-hidden="true" />
            <span>
              {recommendation.policy_source === 'fallback_rule'
                ? 'ĐỀ XUẤT DỰ PHÒNG THEO TẦNG DAG (FALLBACK RULE)'
                : 'KHUYẾN NGHỊ TỪ MÔ HÌNH HỌC TĂNG CƯỜNG (DQN POLICY)'}
            </span>
          </div>

          {recommendation.recommended_concept ? (
            <h2 className="text-xl font-bold text-[#14241B]">
              [Tầng {recommendation.recommended_concept.tier}] #
              {recommendation.recommended_concept.action_id}.{' '}
              {recommendation.recommended_concept.title}
            </h2>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-[#D97706] font-mono font-semibold text-[#14241B]">
              <Cpu className="w-3.5 h-3.5 text-[#15803D]" aria-hidden="true" />
              policy_source: {recommendation.policy_source}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-[#D8E2D8] font-mono text-[#3F5247]">
              <Database className="w-3.5 h-3.5 text-[#0D9488]" aria-hidden="true" />
              state_source: {recommendation.state_source} (v
              {recommendation.state_version})
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-[#D8E2D8] font-mono text-[#3F5247]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#15803D]" aria-hidden="true" />
              guardrail_applied: {String(recommendation.guardrail_applied)}
            </span>
            {recommendation.checkpoint_sha256 ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-[#D8E2D8] font-mono text-[#3F5247]">
                SHA-256: {recommendation.checkpoint_sha256.slice(0, 12)}...
              </span>
            ) : null}
          </div>
        </div>

        {recommendation.recommended_concept ? (
          <button
            type="button"
            onClick={() => onStartRecommended(recommendation.recommended_concept!.slug)}
            className="plumora-btn-primary"
            data-testid="start-recommended-lesson-btn"
          >
            <BookOpen className="w-4 h-4" aria-hidden="true" />
            <span>Bắt đầu học bài AI đề xuất</span>
          </button>
        ) : null}
      </div>
    </div>
  )
}
