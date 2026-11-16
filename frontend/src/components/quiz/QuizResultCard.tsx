import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Compass,
  RotateCcw,
  Sparkles,
} from 'lucide-react'
import type { AttemptResult } from '../../types'

interface QuizResultCardProps {
  attemptResult: AttemptResult | null
  onRetry: () => void
  onBackToRoadmap: () => void
}

export function QuizResultCard({
  attemptResult,
  onRetry,
  onBackToRoadmap,
}: QuizResultCardProps) {
  if (!attemptResult) return null

  const attemptPercent = Math.round(attemptResult.attempt_score * 100)
  const masteryBefore = Math.round(attemptResult.mastery_before * 100)
  const masteryAfter = Math.round(attemptResult.mastery_after * 100)

  return (
    <div className="space-y-6" data-testid="quiz-result-card">
      {/* 1. Mastery Status Feedback Card (Stitch SCR-04) */}
      <div
        role="region"
        aria-live="polite"
        className={`rounded-xl p-5 shadow-sm space-y-4 border-2 ${
          attemptResult.passed
            ? 'bg-[#F0FDF4] border-[#16A34A] text-[#14532D]'
            : 'bg-[#FFF1F2] border-[#FDA4AF] text-[#9F1239]'
        }`}
      >
        {/* Header Status */}
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-full text-white flex items-center justify-center shrink-0 ${
              attemptResult.passed ? 'bg-[#16A34A]' : 'bg-[#E11D48]'
            }`}
          >
            {attemptResult.passed ? (
              <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
            ) : (
              <AlertTriangle className="w-6 h-6" aria-hidden="true" />
            )}
          </div>
          <div>
            <span
              className={`text-[10px] font-mono uppercase tracking-wider font-bold px-2 py-0.5 rounded border ${
                attemptResult.passed
                  ? 'bg-white/80 text-[#16A34A] border-[#86EFAC]'
                  : 'bg-white/80 text-[#E11D48] border-[#FECDD3]'
              }`}
            >
              {attemptResult.passed ? 'PASSED ≥ 75%' : 'CHƯA ĐẠT NGƯỠNG 75%'}
            </span>
            <h2 className="font-bold text-sm mt-0.5">
              {attemptResult.passed
                ? 'ĐẠT CHUẨN THÔNG THẠO KHÁI NIỆM'
                : 'CHƯA ĐẠT CHUẨN THÔNG THẠO (CẦN ≥ 75%)'}
            </h2>
          </div>
        </div>

        {/* Score Breakdown */}
        <div className="bg-white/80 rounded-lg p-3.5 border border-black/5">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-[#57534E]">Điểm số lượt làm bài:</span>
            <span className="text-xl font-extrabold">{attemptPercent}%</span>
          </div>
          <div className="flex items-center justify-between text-xs mt-1 font-medium">
            <span>Số câu trả lời chính xác:</span>
            <span className="font-mono font-bold">
              {attemptResult.correct_count} / 4 câu đúng
            </span>
          </div>
          <div className="w-full bg-[#E2E8F0] h-2 rounded-full overflow-hidden mt-2.5">
            <div
              className={`h-full rounded-full transition-all ${
                attemptResult.passed ? 'bg-[#16A34A]' : 'bg-[#E11D48]'
              }`}
              style={{ width: `${attemptPercent}%` }}
            ></div>
          </div>
        </div>

        {/* Monotonic Mastery (D-06) */}
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center gap-1.5 font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-[#15803D]" aria-hidden="true" />
            <span>Quy tắc Bảo lưu Tiến trình cao nhất (D-06):</span>
          </div>
          <div className="bg-white/80 rounded-lg p-2.5 font-mono text-[11px] border border-black/5 flex items-center justify-between">
            <span>Trước: {masteryBefore}%</span>
            <span className="font-bold text-[#15803D]">→ Sau: {masteryAfter}%</span>
          </div>
        </div>

        {/* Newly Unlocked Concepts (if any) */}
        {attemptResult.newly_unlocked_slugs && attemptResult.newly_unlocked_slugs.length > 0 ? (
          <div className="bg-white rounded-lg p-3 border border-[#0D9488]/30 shadow-xs">
            <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-[#0D9488] block mb-1">
              Khái niệm mới được mở khóa trên DAG:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {attemptResult.newly_unlocked_slugs.map((slug) => (
                <span
                  key={slug}
                  className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#F0FDFA] text-[#0F766E] border border-[#99F6E4]"
                >
                  {slug}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {/* Data Persistence Confirmation */}
        <div className="text-[11px] text-[#57534E] flex items-center justify-between pt-1 border-t border-black/5">
          <span>Trạng thái lưu trữ:</span>
          <span className="font-mono text-[#15803D] font-semibold">
            Đã đồng bộ an toàn (Lũy đẳng bảo vệ)
          </span>
        </div>
      </div>

      {/* 2. Next Action / Next AI Recommendation Card (Stitch SCR-04 Sunlit Amber) */}
      <div className="bg-[#FFFBEB] border-2 border-[#D97706] rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#FDE68A] text-[#78350F] flex items-center justify-center shrink-0">
            <Compass className="w-5 h-5 text-[#D97706]" aria-hidden="true" />
          </div>
          <div>
            <span className="text-[10px] font-mono font-bold text-[#D97706] uppercase tracking-wider">
              Khuyến Nghị Tiếp Theo
            </span>
            <h3 className="font-bold text-sm text-[#78350F]">Tiếp tục Lộ trình Học</h3>
          </div>
        </div>

        <p className="text-xs text-[#78350F] leading-relaxed">
          {attemptResult.passed
            ? 'Bạn đã đạt chuẩn thông thạo khái niệm này! Hãy nhận bài học khuyến nghị tiếp theo từ mô hình AI.'
            : 'Bạn có thể làm lại bài kiểm tra với đề mới để nâng cao điểm thông thạo, hoặc quay lại lộ trình học.'}
        </p>

        <div className="space-y-2">
          <button
            type="button"
            onClick={onBackToRoadmap}
            className="w-full py-2.5 px-4 bg-[#15803D] hover:bg-[#166534] text-white text-xs font-bold rounded-lg shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
            data-testid="back-to-roadmap-after-quiz"
          >
            <span>Nhận bài khuyến nghị tiếp theo từ AI</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={onRetry}
            className="w-full py-2 px-3 bg-white hover:bg-[#F6F8F5] border border-[#D8E2D8] text-[#14241B] text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#57534E]" aria-hidden="true" />
            <span>Làm lại Quiz để nâng cao điểm</span>
          </button>
        </div>
      </div>
    </div>
  )
}
