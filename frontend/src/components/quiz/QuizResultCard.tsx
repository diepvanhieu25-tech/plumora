import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
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
  onBackToLesson?: () => void
}

export function QuizResultCard({
  attemptResult,
  onRetry,
  onBackToRoadmap,
  onBackToLesson,
}: QuizResultCardProps) {
  if (!attemptResult) return null

  const attemptPercent = Math.round(attemptResult.attempt_score * 100)
  const masteryBefore = Math.round(attemptResult.mastery_before * 100)
  const masteryAfter = Math.round(attemptResult.mastery_after * 100)
  const isPassed = attemptResult.passed

  return (
    <div className="space-y-6 transition-all duration-300" data-testid="quiz-result-card">
      {/* 1. Mastery Status Feedback Card (Stitch SCR-04) */}
      <div
        role="region"
        aria-live="polite"
        className={`rounded-2xl p-5 sm:p-6 shadow-sm space-y-4 border-2 transition-all ${
          isPassed
            ? 'bg-[#F0FDF4] border-[#16A34A] text-[#14532D]'
            : 'bg-[#FFFBEB] border-[#D97706] text-[#78350F]'
        }`}
      >
        {/* Header Status */}
        <div className="flex items-center gap-3.5">
          <div
            className={`w-11 h-11 rounded-xl text-white flex items-center justify-center shrink-0 shadow-xs ${
              isPassed ? 'bg-[#16A34A]' : 'bg-[#D97706]'
            }`}
          >
            {isPassed ? (
              <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
            ) : (
              <AlertTriangle className="w-6 h-6" aria-hidden="true" />
            )}
          </div>
          <div>
            <span
              className={`text-[10px] font-mono uppercase tracking-wider font-bold px-2.5 py-0.5 rounded border inline-block ${
                isPassed
                  ? 'bg-white/90 text-[#16A34A] border-[#86EFAC]'
                  : 'bg-white/90 text-[#D97706] border-[#FDE68A]'
              }`}
            >
              {isPassed ? 'PASSED ≥ 75%' : 'CHƯA ĐẠT NGƯỠNG 75%'}
            </span>
            <h2 className="font-extrabold text-sm sm:text-base mt-1">
              {isPassed
                ? 'ĐẠT CHUẨN THÔNG THẠO KHÁI NIỆM'
                : 'CHƯA ĐẠT CHUẨN THÔNG THẠO (CẦN ≥ 75%)'}
            </h2>
          </div>
        </div>

        {/* Motivational Commentary */}
        <p className="text-xs sm:text-sm leading-relaxed">
          {isPassed
            ? 'Chúc mừng! Bạn đã hoàn thành xuất sắc bài kiểm tra với điểm số trên ngưỡng 75%. Trạng thái thông thạo đã được ghi nhận vào cơ sở dữ liệu.'
            : 'Đừng nản lòng! Bạn cần trả lời đúng tối thiểu 3 / 4 câu (75%) để đạt chuẩn thông thạo khái niệm này. Hãy xem lại kiến thức hoặc thử làm lại bài thi.'}
        </p>

        {/* Score Breakdown */}
        <div className="bg-white/90 rounded-xl p-4 border border-black/5 space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-[#57534E] font-medium">Điểm số lượt làm bài:</span>
            <span
              className={`text-2xl font-black ${
                isPassed ? 'text-[#15803D]' : 'text-[#D97706]'
              }`}
            >
              {attemptPercent}%
            </span>
          </div>

          <div className="flex items-center justify-between text-xs font-medium">
            <span className="text-[#57534E]">Số câu trả lời chính xác:</span>
            <span className="font-mono font-bold text-[#14241B]">
              {attemptResult.correct_count} / 4 câu đúng
            </span>
          </div>

          {/* Animated Progress Bar */}
          <div className="w-full bg-[#E2E8F0] h-2.5 rounded-full overflow-hidden mt-2">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${
                isPassed ? 'bg-[#16A34A]' : 'bg-[#D97706]'
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
          <div className="bg-white/90 rounded-lg p-2.5 font-mono text-[11px] border border-black/5 flex items-center justify-between">
            <span className="text-[#57534E]">Trước: {masteryBefore}%</span>
            <span className="font-bold text-[#15803D]">→ Sau: {masteryAfter}%</span>
          </div>
        </div>

        {/* Newly Unlocked Concepts (if any) */}
        {attemptResult.newly_unlocked_slugs && attemptResult.newly_unlocked_slugs.length > 0 ? (
          <div className="bg-white rounded-xl p-3.5 border border-[#0D9488]/30 shadow-xs space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider font-bold text-[#0D9488]">
              <Sparkles className="w-3.5 h-3.5 text-[#0D9488]" aria-hidden="true" />
              <span>Khái niệm mới được mở khóa trên DAG:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {attemptResult.newly_unlocked_slugs.map((slug) => (
                <span
                  key={slug}
                  className="font-mono text-xs font-bold px-2.5 py-1 rounded-md bg-[#F0FDFA] text-[#0F766E] border border-[#99F6E4]"
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

      {/* 2. Action Suggestions Card */}
      <div className="bg-white border border-[#D8E2D8] rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#FEF3C7] text-[#92400E] flex items-center justify-center shrink-0">
            <Compass className="w-5 h-5 text-[#D97706]" aria-hidden="true" />
          </div>
          <div>
            <span className="text-[10px] font-mono font-bold text-[#D97706] uppercase tracking-wider">
              Bước Tiếp Theo
            </span>
            <h3 className="font-bold text-sm text-[#14241B]">
              {isPassed ? 'Tiếp tục Lộ trình Học tập' : 'Lựa chọn Nâng cao Kết quả'}
            </h3>
          </div>
        </div>

        <p className="text-xs text-[#57534E] leading-relaxed">
          {isPassed
            ? 'Bạn đã đạt chuẩn thông thạo khái niệm này! Hãy nhận bài học khuyến nghị tiếp theo từ mô hình AI (DQN Policy).'
            : 'Bạn có thể làm lại bài kiểm tra ngay để cải thiện điểm số, hoặc đọc lại lý thuyết bài học để củng cố kiến thức.'}
        </p>

        <div className="space-y-2.5 pt-1">
          {isPassed ? (
            <>
              <button
                type="button"
                onClick={onBackToRoadmap}
                className="w-full py-3 px-4 bg-[#15803D] hover:bg-[#166534] text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98]"
                data-testid="back-to-roadmap-after-quiz"
              >
                <span>Nhận bài khuyến nghị tiếp theo từ AI</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={onRetry}
                className="w-full py-2.5 px-3 bg-white hover:bg-[#F6F8F5] border border-[#D8E2D8] text-[#14241B] text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#57534E]" aria-hidden="true" />
                <span>Làm lại Quiz để nâng cao điểm</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onRetry}
                className="w-full py-3 px-4 bg-[#15803D] hover:bg-[#166534] text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98]"
              >
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
                <span>Làm lại bài kiểm tra ngay</span>
              </button>

              {onBackToLesson ? (
                <button
                  type="button"
                  onClick={onBackToLesson}
                  className="w-full py-2.5 px-3 bg-white hover:bg-[#F6F8F5] border border-[#D8E2D8] text-[#14241B] text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5 text-[#15803D]" aria-hidden="true" />
                  <span>Ôn lại lý thuyết bài học</span>
                </button>
              ) : null}

              <button
                type="button"
                onClick={onBackToRoadmap}
                className="w-full py-2 px-3 text-[#57534E] hover:text-[#14241B] text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                data-testid="back-to-roadmap-after-quiz"
              >
                <span>Quay về Bản đồ Lộ trình</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
