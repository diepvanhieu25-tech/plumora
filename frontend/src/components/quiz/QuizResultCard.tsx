import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  RotateCcw,
  Sparkles,
} from 'lucide-react'
import type { AttemptResult } from '../../types'
import { CONCEPT_TITLE_MAP } from '../../constants/concepts'

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
      {/* 1. Mastery Status Feedback Card */}
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
            ? 'Chúc mừng! Bạn đã hoàn thành xuất sắc bài kiểm tra với điểm số trên ngưỡng 75%. Trạng thái thông thạo đã được ghi nhận vào hệ thống.'
            : 'Đừng nản lòng! Bạn cần trả lời đúng tối thiểu 3 / 4 câu (75%) để đạt chuẩn thông thạo khái niệm này. Hãy xem lại bài đọc hoặc thử làm lại.'}
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

        {/* Monotonic Mastery */}
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center gap-1.5 font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-[#15803D]" aria-hidden="true" />
            <span>Bảo lưu Điểm số Cao nhất:</span>
          </div>
          <div className="bg-white/90 rounded-lg p-2.5 font-mono text-[11px] border border-black/5 flex items-center justify-between">
            <span className="text-[#57534E]">Trước: {masteryBefore}%</span>
            <span className="font-bold text-[#15803D]">→ Sau: {masteryAfter}%</span>
          </div>
        </div>

        {/* Newly Unlocked Concepts (if any) */}
        {attemptResult.newly_unlocked_slugs && attemptResult.newly_unlocked_slugs.length > 0 ? (
          <div className="bg-white rounded-xl p-3.5 border border-[#0D9488]/30 shadow-xs space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#0D9488]">
              <Sparkles className="w-3.5 h-3.5 text-[#0D9488]" aria-hidden="true" />
              <span>Khái niệm mới được mở khóa:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {attemptResult.newly_unlocked_slugs.map((slug) => (
                <span
                  key={slug}
                  className="text-xs font-bold px-2.5 py-1 rounded-md bg-[#F0FDFA] text-[#0F766E] border border-[#99F6E4]"
                >
                  {CONCEPT_TITLE_MAP[slug] || slug}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {/* Data Persistence Confirmation */}
        <div className="text-[11px] text-[#57534E] flex items-center justify-between pt-1 border-t border-black/5">
          <span>Trạng thái lưu trữ:</span>
          <span className="text-[#15803D] font-semibold">
            {attemptResult.idempotent_replay
              ? 'Phát lại bài nộp cũ (Bảo lưu nguyên trạng)'
              : 'Đã đồng bộ an toàn'}
          </span>
        </div>
      </div>

      {/* 2. Action Buttons */}
      <div className="space-y-3">
        {isPassed ? (
          <button
            type="button"
            onClick={onBackToRoadmap}
            className="w-full bg-[#15803D] hover:bg-[#166534] text-white font-bold py-3 px-4 rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all text-xs cursor-pointer active:scale-[0.98]"
          >
            <span>Quay về Lộ trình học tiếp</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        ) : null}

        <button
          type="button"
          onClick={onRetry}
          className="w-full bg-white hover:bg-[#F6F8F5] text-[#3F5247] border border-[#D8E2D8] font-semibold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors text-xs cursor-pointer shadow-2xs"
          data-testid="retry-quiz-btn"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Làm lại bài kiểm tra</span>
        </button>

        {onBackToLesson ? (
          <button
            type="button"
            onClick={onBackToLesson}
            className="w-full text-center text-xs text-[#57534E] hover:text-[#15803D] py-1 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Đọc lại lý thuyết bài học</span>
          </button>
        ) : null}
      </div>
    </div>
  )
}
