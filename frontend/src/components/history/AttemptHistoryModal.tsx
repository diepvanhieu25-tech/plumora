import { useEffect, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  History,
  Sparkles,
  Unlock,
  X,
} from 'lucide-react'
import { apiGetAttemptHistory } from '../../api'
import { CONCEPT_TITLE_MAP } from '../../constants/concepts'
import type { AttemptHistoryItem } from '../../types'
import { useFocusTrap } from '../../utils/useFocusTrap'

interface AttemptHistoryModalProps {
  isOpen: boolean
  onClose: () => void
}

export function AttemptHistoryModal({ isOpen, onClose }: AttemptHistoryModalProps) {
  const containerRef = useFocusTrap(isOpen, onClose)
  const [history, setHistory] = useState<AttemptHistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    let active = true

    async function fetchHistory() {
      setIsLoading(true)
      setErrorMessage(null)
      try {
        const data = await apiGetAttemptHistory(50)
        if (active) {
          setHistory(data.attempts)
        }
      } catch (err) {
        if (active) {
          setErrorMessage(
            err instanceof Error ? err.message : 'Không thể tải lịch sử làm bài',
          )
        }
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    fetchHistory()
    return () => {
      active = false
    }
  }, [isOpen])

  if (!isOpen) return null

  function formatDate(isoString: string): string {
    try {
      const d = new Date(isoString)
      return new Intl.DateTimeFormat('vi-VN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(d)
    } catch {
      return isoString
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="attempt-history-title"
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      data-testid="attempt-history-modal"
    >
      <div
        ref={containerRef}
        className="bg-white rounded-2xl max-w-2xl w-full p-6 border border-[#D8E2D8] space-y-4 shadow-2xl max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#D8E2D8] pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#F0FDF4] border border-[#16A34A] flex items-center justify-center text-[#15803D]">
              <History className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <h2 id="attempt-history-title" className="text-base sm:text-lg font-bold text-[#14241B]">
                Lịch sử làm bài kiểm tra (Quiz Attempts)
              </h2>
              <p className="text-xs text-[#57534E]">
                Toàn bộ lịch sử các lượt nộp bài trắc nghiệm và quá trình nâng cao độ thông thạo
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#57534E] hover:text-[#14241B] hover:bg-[#F6F8F5] transition-colors cursor-pointer"
            aria-label="Đóng cửa sổ lịch sử"
            data-testid="close-history-modal-btn"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto flex-1 pr-1 space-y-3">
          {isLoading ? (
            <div className="py-12 text-center text-[#57534E] text-xs font-medium space-y-2">
              <div className="w-6 h-6 border-2 border-[#15803D] border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p>Đang tải lịch sử các lượt làm bài từ hệ thống...</p>
            </div>
          ) : errorMessage ? (
            <div className="p-4 bg-[#FEF2F2] border border-[#EF4444] rounded-xl text-xs text-[#991B1B] flex items-center justify-between">
              <span>{errorMessage}</span>
              <button
                type="button"
                onClick={() => {
                  setIsLoading(true)
                  setErrorMessage(null)
                  apiGetAttemptHistory(50)
                    .then((res) => setHistory(res.attempts))
                    .catch((err) =>
                      setErrorMessage(
                        err instanceof Error ? err.message : 'Không thể tải lịch sử',
                      ),
                    )
                    .finally(() => setIsLoading(false))
                }}
                className="underline font-bold text-[#DC2626] ml-2 cursor-pointer"
              >
                Thử lại
              </button>
            </div>
          ) : history.length === 0 ? (
            <div className="py-12 text-center text-[#57534E] text-xs font-medium bg-[#F6F8F5] rounded-xl border border-[#D8E2D8] p-6 space-y-1">
              <History className="w-8 h-8 text-[#A8A29E] mx-auto mb-2 opacity-60" aria-hidden="true" />
              <p className="font-semibold text-[#14241B]">Chưa có lượt làm bài nào</p>
              <p className="text-[11px] text-[#78716C]">
                Hãy bắt đầu học và hoàn thành bài kiểm tra đầu tiên để ghi nhận điểm số tại đây!
              </p>
            </div>
          ) : (
            history.map((item) => {
              const scorePercent = Math.round(item.attempt_score * 100)
              const beforePercent = Math.round(item.mastery_before * 100)
              const afterPercent = Math.round(item.mastery_after * 100)
              const hasNewlyUnlocked =
                item.newly_unlocked_slugs && item.newly_unlocked_slugs.length > 0

              return (
                <div
                  key={item.attempt_id}
                  className={`p-4 rounded-xl border text-xs transition-all space-y-2.5 ${
                    item.passed
                      ? 'bg-[#F0FDF4]/70 border-[#BBF7D0]'
                      : 'bg-white border-[#D8E2D8]'
                  }`}
                  data-testid={`attempt-card-${item.attempt_id}`}
                >
                  {/* Top line: Concept Title, Tier, Status Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-[#E7E5E4] text-[#44403C] font-semibold">
                          Tầng {item.tier}
                        </span>
                        <span className="font-bold text-sm text-[#14241B]">
                          {item.concept_title}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-[#78716C]">
                        <Clock className="w-3 h-3 text-[#A8A29E]" aria-hidden="true" />
                        <span>{formatDate(item.created_at)}</span>
                        <span>•</span>
                        <span className="font-mono text-[10px]">v{item.state_version}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-full text-[11px] ${
                          item.passed
                            ? 'bg-[#DCFCE7] text-[#14532D] border border-[#86EFAC]'
                            : 'bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]'
                        }`}
                      >
                        {item.passed ? (
                          <CheckCircle2 className="w-3 h-3 text-[#16A34A]" aria-hidden="true" />
                        ) : (
                          <AlertCircle className="w-3 h-3 text-[#D97706]" aria-hidden="true" />
                        )}
                        <span>{item.passed ? 'ĐẠT (PASSED)' : 'CHƯA ĐẠT'}</span>
                      </span>
                    </div>
                  </div>

                  {/* Middle metrics: Score & Mastery update */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#D8E2D8]/60 text-[11px]">
                    <div className="flex items-center gap-3">
                      <span>
                        Điểm bài làm:{' '}
                        <strong
                          className={
                            item.passed ? 'text-[#15803D] font-bold' : 'text-[#D97706] font-bold'
                          }
                        >
                          {scorePercent}%
                        </strong>{' '}
                        ({item.correct_count}/4 câu)
                      </span>
                      <span>•</span>
                      <span>
                        Thông thạo: <span className="text-[#57534E]">{beforePercent}%</span> →{' '}
                        <strong className="text-[#15803D] font-bold">{afterPercent}%</strong>
                      </span>
                    </div>
                  </div>

                  {/* Newly unlocked concepts notice if any */}
                  {hasNewlyUnlocked && (
                    <div className="mt-2 p-2 bg-[#F0FDF4] rounded-lg border border-[#BBF7D0] text-[11px] text-[#14532D] flex items-start gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#16A34A] shrink-0 mt-0.5" aria-hidden="true" />
                      <div>
                        <span className="font-semibold">Mở khóa khái niệm mới: </span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {item.newly_unlocked_slugs.map((slug) => (
                            <span
                              key={slug}
                              className="inline-flex items-center gap-1 bg-white px-1.5 py-0.5 rounded border border-[#86EFAC] font-mono text-[10px] font-bold text-[#15803D]"
                            >
                              <Unlock className="w-2.5 h-2.5" aria-hidden="true" />
                              {CONCEPT_TITLE_MAP[slug] || slug}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Modal Footing */}
        <div className="pt-3 border-t border-[#D8E2D8] flex items-center justify-between text-xs text-[#57534E] shrink-0">
          <span>Tổng số lượt làm bài: <strong>{history.length}</strong></span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#15803D] hover:bg-[#166534] text-white rounded-lg font-bold transition-colors cursor-pointer text-xs"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}
