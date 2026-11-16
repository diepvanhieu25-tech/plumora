import { AlertTriangle, CheckCircle2, Compass } from 'lucide-react'
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

  return (
    <div
      role="region"
      aria-live="polite"
      className={`p-5 rounded-xl border-2 space-y-3 mt-4 ${
        attemptResult.passed
          ? 'bg-[#F0FDF4] border-[#16A34A] text-[#14532D]'
          : 'bg-[#FFF1F2] border-[#FDA4AF] text-[#9F1239]'
      }`}
      data-testid="quiz-result-card"
    >
      <div className="flex items-center gap-2">
        {attemptResult.passed ? (
          <CheckCircle2 className="w-5 h-5 text-[#16A34A]" aria-hidden="true" />
        ) : (
          <AlertTriangle className="w-5 h-5 text-[#9F1239]" aria-hidden="true" />
        )}
        <h3 className="text-base font-bold">
          {attemptResult.passed
            ? `ĐẠT CHUẨN THÔNG THẠO (PASSED: ${Math.round(attemptResult.attempt_score * 100)}% — ${attemptResult.correct_count}/4 câu đúng)`
            : `CHƯA ĐẠT NGƯỠNG 75% (ĐIỂM LƯỢT NÀY: ${Math.round(attemptResult.attempt_score * 100)}% — ${attemptResult.correct_count}/4 câu đúng)`}
        </h3>
      </div>

      <p className="text-xs font-mono">
        Điểm thông thạo bảo lưu (max):{' '}
        {Math.round(attemptResult.mastery_before * 100)}% -&gt;{' '}
        <strong>{Math.round(attemptResult.mastery_after * 100)}%</strong> |
        PostgreSQL COMMITTED (state_version = {attemptResult.state_version}) |
        Idempotent Replay: {String(attemptResult.idempotent_replay)}
      </p>

      <div className="flex flex-wrap gap-3 pt-1">
        <button
          type="button"
          onClick={onRetry}
          className="plumora-btn-outline text-xs"
        >
          Làm lại Quiz với submission_id mới
        </button>
        <button
          type="button"
          onClick={onBackToRoadmap}
          className="plumora-btn-primary text-xs"
          data-testid="back-to-roadmap-after-quiz"
        >
          <Compass className="w-4 h-4" aria-hidden="true" />
          <span>Nhận bài khuyến nghị tiếp theo từ AI</span>
        </button>
      </div>
    </div>
  )
}
