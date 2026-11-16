import { ArrowRight, Award, Compass, Cpu, Database, ShieldCheck } from 'lucide-react'
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
  if (masteredCount >= 12 || recommendation.status === 'completed') {
    return (
      <div
        className="bg-[#F0FDF4] border-2 border-[#16A34A] rounded-xl p-6 shadow-sm"
        data-testid="ai-recommendation-banner"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#16A34A] text-white flex items-center justify-center">
            <Award className="w-6 h-6" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#14532D]">
              Chúc mừng! Bạn đã hoàn thành trọn vẹn 12/12 khái niệm Backend!
            </h2>
            <p className="text-xs text-[#166534] mt-0.5 font-medium">
              Mô hình DQN xác nhận trạng thái hội tụ hoàn hảo. Toàn bộ lộ trình đã đạt chuẩn thông thạo ≥ 75%.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const concept = recommendation.recommended_concept
  if (!concept) return null

  return (
    <section
      className="bg-[#FFFBEB] border-2 border-[#D97706] rounded-xl p-6 shadow-sm relative overflow-hidden"
      data-testid="ai-recommendation-banner"
      aria-label="Khung Khuyến nghị Bài học Tiếp theo từ AI DQN"
    >
      {/* Subtle Sunlit Radial Accent */}
      <div className="absolute -right-16 -top-16 w-64 h-64 bg-[#FDE68A]/30 rounded-full blur-2xl pointer-events-none"></div>

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-3 max-w-3xl">
          {/* Top Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FEF3C7] text-[#92400E] text-xs font-bold tracking-wide uppercase border border-[#FDE68A]">
            <Compass className="w-4 h-4 text-[#D97706] shrink-0" aria-hidden="true" />
            <span>KHUYẾN NGHỊ TỪ MÔ HÌNH HỌC TĂNG CƯỜNG (DQN POLICY)</span>
          </div>

          {/* Concept Headline */}
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#451A03] flex flex-wrap items-center gap-2">
              <span>
                [Tầng {concept.tier}] #{concept.action_id}. {concept.title}
              </span>
              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-[#FDE68A] text-[#78350F] border border-[#FCD34D]">
                {concept.slug}
              </span>
            </h2>
            <p className="text-sm text-[#78350F] mt-1 font-medium leading-relaxed">
              Dựa trên tiến độ hiện tại, mô hình DQN xác định đây là khái niệm tối ưu nhất để học tiếp nhằm mở khóa các tầng tiếp theo của lộ trình.
            </p>
          </div>

          {/* Clean Provenance Metadata Chips */}
          <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-xs text-[#78350F]">
            <span className="bg-white px-2.5 py-1 rounded-md border border-[#FCD34D] flex items-center gap-1">
              <Cpu className="w-3.5 h-3.5 text-[#D97706]" aria-hidden="true" />
              <span>policy_source: {recommendation.policy_source}</span>
            </span>
            <span className="bg-white px-2.5 py-1 rounded-md border border-[#FCD34D] flex items-center gap-1">
              <Database className="w-3.5 h-3.5 text-[#0D9488]" aria-hidden="true" />
              <span>state_source: {recommendation.state_source}</span>
            </span>
            {recommendation.checkpoint_sha256 ? (
              <span className="bg-white px-2.5 py-1 rounded-md border border-[#FCD34D] flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#15803D]" aria-hidden="true" />
                <span>SHA-256: {recommendation.checkpoint_sha256.slice(0, 12)}...</span>
              </span>
            ) : null}
            <span className="bg-white px-2.5 py-1 rounded-md border border-[#FCD34D] font-bold text-[#15803D]">
              Ưu tiên: Tối ưu
            </span>
          </div>
        </div>

        {/* Primary CTA Button */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={() => onStartRecommended(concept.slug)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-[#15803D] hover:bg-[#166534] text-white font-bold text-sm rounded-xl shadow-md transition-all cursor-pointer active:scale-[0.98]"
            data-testid="start-recommended-lesson-btn"
          >
            <span>Bắt đầu học bài này</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  )
}
