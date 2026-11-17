import {
  AlertTriangle,
  Award,
  Compass,
  Cpu,
  Database,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import type { RecommendationPayload } from '../../types'

interface AiRecommendationBannerProps {
  recommendation: RecommendationPayload | null
  masteredCount: number
  errorMessage?: string | null
  onRetry?: () => void
  onStartRecommended: (slug: string) => void
}

export function AiRecommendationBanner({
  recommendation,
  masteredCount,
  errorMessage,
  onRetry,
  onStartRecommended,
}: AiRecommendationBannerProps) {
  // 1. Error state (F1: No fake DQN fallback when API fails)
  if (errorMessage) {
    return (
      <div
        className="bg-[#FEF2F2] border-2 border-[#EF4444] rounded-xl p-5 sm:p-6 shadow-sm"
        data-testid="ai-recommendation-banner"
        role="alert"
      >
        <div data-testid="roadmap-api-error-banner" className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#FEE2E2] text-[#DC2626] flex items-center justify-center shrink-0">
              <AlertTriangle className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#991B1B]">
                Không thể tải dữ liệu lộ trình hoặc khuyến nghị AI
              </h2>
              <p className="text-xs text-[#B91C1C] mt-0.5 font-medium">
                {errorMessage}. Vui lòng kiểm tra kết nối mạng và thử lại.
              </p>
            </div>
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              data-testid="retry-roadmap-btn"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Thử lại</span>
            </button>
          )}
        </div>
      </div>
    )
  }

  // 2. Loading / Empty state
  if (!recommendation) {
    return (
      <div
        className="bg-white border border-[#D8E2D8] rounded-xl p-6 text-center text-[#57534E] text-xs font-medium shadow-2xs"
        data-testid="ai-recommendation-banner"
      >
        Đang đồng bộ dữ liệu lộ trình và phân tích khuyến nghị bài học phù hợp...
      </div>
    )
  }

  // 3. Completed State
  if (masteredCount >= 12 || recommendation.status === 'completed') {
    return (
      <div
        className="bg-[#F0FDF4] border-2 border-[#16A34A] rounded-xl p-6 shadow-sm"
        data-testid="ai-recommendation-banner"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#16A34A] text-white flex items-center justify-center shrink-0">
            <Award className="w-6 h-6" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#14532D]">
              Chúc mừng! Bạn đã hoàn thành trọn vẹn 12/12 khái niệm Backend!
            </h2>
            <p className="text-xs text-[#166534] mt-0.5 font-medium">
              Hệ thống xác nhận trạng thái hoàn tất lộ trình. Toàn bộ các khái niệm đã đạt chuẩn thông thạo ≥ 75%.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const concept = recommendation.recommended_concept
  if (!concept) {
    return (
      <div
        className="bg-[#F8FAF7] border border-[#D8E2D8] rounded-xl p-5 text-xs text-[#57534E]"
        data-testid="ai-recommendation-banner"
      >
        Chưa có khái niệm phù hợp để đề xuất tiếp theo.
      </div>
    )
  }

  // 4. Active Recommendation Banner
  const isFallback = recommendation.policy_source === 'fallback_rule'
  const isMaskedQ = recommendation.policy_source === 'dqn_masked_q'

  let badgeTitle = 'KHUYẾN NGHỊ TỪ MÔ HÌNH HỌC TĂNG CƯỜNG (DQN POLICY)'
  let explanationText =
    'Dựa trên tiến độ học tập và đồ thị tiên quyết DAG, mô hình DQN đề xuất đây là khái niệm tiếp theo phù hợp để mở khóa các tầng kiến thức mới.'
  let modelDisplayName = 'Học tăng cường DQN'

  if (isFallback) {
    badgeTitle = 'KHUYẾN NGHỊ THEO QUY TẮC ĐỒ THỊ (TOPO FALLBACK)'
    explanationText =
      'Dựa trên đồ thị tiên quyết DAG, quy tắc thứ tự tô-pô đề xuất đây là khái niệm phù hợp để học tiếp theo.'
    modelDisplayName = 'Quy tắc thứ tự Topo'
  } else if (isMaskedQ) {
    badgeTitle = 'KHUYẾN NGHỊ TỪ MÔ HÌNH DQN (MASKED Q)'
    explanationText =
      'Dựa trên tiến độ học tập và đồ thị tiên quyết DAG, mô hình DQN (lọc hành động hợp lệ) đề xuất đây là khái niệm tiếp theo phù hợp để mở khóa kiến thức mới.'
    modelDisplayName = 'DQN (Lọc hành động hợp lệ)'
  }

  return (
    <section
      className="bg-[#FFFBEB] border-2 border-[#D97706] rounded-xl p-5 sm:p-6 shadow-sm relative"
      data-testid="ai-recommendation-banner"
      aria-label="Khung Khuyến nghị Bài học Tiếp theo"
    >
      {/* Subtle Sunlit Radial Accent isolated in its own clipping container */}
      <div className="hidden sm:block absolute inset-0 overflow-hidden pointer-events-none rounded-xl" aria-hidden="true">
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-[#FDE68A]/30 rounded-full blur-2xl"></div>
      </div>

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-3 max-w-3xl">
          {/* Top Badge */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FEF3C7] text-[#92400E] text-xs font-bold tracking-wide uppercase border border-[#FDE68A]">
              <Compass className="w-4 h-4 text-[#D97706] shrink-0" aria-hidden="true" />
              <span>{badgeTitle}</span>
            </div>
            {recommendation.degraded && (
              <span className="bg-[#FEF2F2] text-[#B91C1C] border border-[#FCA5A5] px-2.5 py-0.5 rounded-full text-xs font-bold">
                Chế độ dự phòng
              </span>
            )}
          </div>

          {/* Concept Headline */}
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#451A03] flex flex-wrap items-center gap-2">
              <span>
                [Tầng {concept.tier}] {concept.title}
              </span>
            </h2>
            <p className="text-sm text-[#78350F] mt-1 font-medium leading-relaxed">
              {explanationText}
            </p>
          </div>

          {/* Clean Provenance Chips */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-[#78350F]">
            <span className="bg-white px-2.5 py-1 rounded-md border border-[#FCD34D] flex items-center gap-1 font-medium">
              <Cpu className="w-3.5 h-3.5 text-[#D97706] shrink-0" aria-hidden="true" />
              <span>Mô hình: {modelDisplayName}</span>
            </span>
            <span className="bg-white px-2.5 py-1 rounded-md border border-[#FCD34D] flex items-center gap-1 font-medium">
              <Database className="w-3.5 h-3.5 text-[#0D9488] shrink-0" aria-hidden="true" />
              <span>
                Bộ đệm:{' '}
                {recommendation.state_source === 'redis_cache'
                  ? 'Redis Cache'
                  : 'PostgreSQL'}
              </span>
            </span>
            {recommendation.checkpoint_sha256 ? (
              <span
                className="bg-white px-2.5 py-1 rounded-md border border-[#FCD34D] flex items-center gap-1 font-mono text-[11px] max-w-full"
                title={`Mã băm Checkpoint SHA-256 đầy đủ: ${recommendation.checkpoint_sha256}`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-[#15803D] shrink-0" aria-hidden="true" />
                <span className="truncate max-w-[180px] sm:max-w-xs">
                  Checkpoint: {recommendation.checkpoint_sha256.slice(0, 12)}…
                </span>
              </span>
            ) : null}
            <span className="bg-white px-2.5 py-1 rounded-md border border-[#FCD34D] font-bold text-[#15803D]">
              Trạng thái: Sẵn sàng học
            </span>
          </div>
        </div>

        {/* Start Recommended Lesson CTA */}
        <div className="shrink-0 flex flex-col items-start lg:items-end gap-2">
          <button
            type="button"
            onClick={() => onStartRecommended(concept.slug)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#D97706] hover:bg-[#B45309] text-white font-bold rounded-xl shadow-md transition-all text-sm cursor-pointer active:scale-[0.98]"
            data-testid="start-recommended-lesson-btn"
          >
            <span>Bắt đầu bài học đề xuất</span>
            <Compass className="w-4 h-4" aria-hidden="true" />
          </button>
          <span className="text-[11px] text-[#78350F] font-medium">
            Mở khóa tiếp: Tầng {concept.tier} → Tầng {Math.min(concept.tier + 1, 4)}
          </span>
        </div>
      </div>
    </section>
  )
}
