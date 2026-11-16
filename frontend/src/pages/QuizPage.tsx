import {
  ArrowLeft,
  BookOpen,
  FileCheck2,
  HelpCircle,
  ShieldCheck,
} from 'lucide-react'
import { McqQuizForm } from '../components/quiz/McqQuizForm'
import { QuizResultCard } from '../components/quiz/QuizResultCard'
import type { AttemptResult, ConceptDetail } from '../types'

interface QuizPageProps {
  currentConcept: ConceptDetail
  submissionId: string
  selectedAnswers: Record<string, 'A' | 'B' | 'C' | 'D'>
  onSelectAnswer: (questionId: string, optionKey: 'A' | 'B' | 'C' | 'D') => void
  onSubmit: (e: React.FormEvent) => Promise<void>
  isLoading: boolean
  quizError: string | null
  attemptResult: AttemptResult | null
  onRetry: () => void
  onBackToRoadmap: () => void
  onBackToLesson: () => void
}

export function QuizPage({
  currentConcept,
  submissionId,
  selectedAnswers,
  onSelectAnswer,
  onSubmit,
  isLoading,
  quizError,
  attemptResult,
  onRetry,
  onBackToRoadmap,
  onBackToLesson,
}: QuizPageProps) {
  return (
    <div className="space-y-6">
      {/* Sub-header Navigation & Tab Bar (Sticky Bar - Stitch SCR-04) */}
      <div className="bg-white border-b border-[#D8E2D8] -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-2.5 sticky top-[57px] z-20 shadow-2xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Return Button */}
          <button
            type="button"
            onClick={onBackToRoadmap}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#3F5247] hover:text-[#15803D] hover:bg-[#F6F8F5] py-1.5 px-2.5 rounded-lg transition-colors cursor-pointer"
            data-testid="back-to-roadmap-btn"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Quay về Bản đồ Lộ trình</span>
          </button>

          {/* Segmented Control Tabs */}
          <div className="flex items-center bg-[#F6F8F5] p-1 rounded-xl border border-[#D8E2D8]">
            <button
              type="button"
              onClick={onBackToLesson}
              className="text-[#3F5247] hover:text-[#14241B] hover:bg-white rounded-lg px-4 py-1.5 text-xs sm:text-sm font-medium flex items-center gap-2 transition-all cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-[#57534E]" aria-hidden="true" />
              <span>1. Bài học Lý thuyết (Markdown)</span>
            </button>
            <button
              type="button"
              className="bg-[#15803D] text-white rounded-lg px-4 py-1.5 text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-xs transition-all cursor-default"
            >
              <FileCheck2 className="w-4 h-4" aria-hidden="true" />
              <span>2. Làm bài Quiz kiểm tra</span>
            </button>
          </div>

          {/* Breadcrumb Info */}
          <div className="hidden lg:flex items-center gap-2 text-xs font-mono text-[#57534E]">
            <span className="font-bold text-[#14241B]">[{currentConcept.slug}]</span>
            <span>•</span>
            <span>Ngưỡng đạt: ≥ 75%</span>
          </div>
        </div>
      </div>

      {/* Two-Column Main Workspace (Stitch SCR-04) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column (8 cols): 4-Question MCQ Form */}
        <div className="lg:col-span-8">
          <McqQuizForm
            currentConcept={currentConcept}
            submissionId={submissionId}
            selectedAnswers={selectedAnswers}
            onSelectAnswer={onSelectAnswer}
            onSubmit={onSubmit}
            isLoading={isLoading}
            quizError={quizError}
            isSubmitted={!!attemptResult}
          />
        </div>

        {/* Right Column (4 cols): Instructions or Quiz Results */}
        <aside className="lg:col-span-4 space-y-6">
          {attemptResult ? (
            <QuizResultCard
              attemptResult={attemptResult}
              onRetry={onRetry}
              onBackToRoadmap={onBackToRoadmap}
              onBackToLesson={onBackToLesson}
            />
          ) : (
            <>
              {/* Instructions Card */}
              <div className="bg-white rounded-xl border border-[#D8E2D8] p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-[#15803D] font-bold text-sm">
                  <HelpCircle className="w-4 h-4 text-[#15803D]" aria-hidden="true" />
                  <span>Hướng dẫn Làm bài Kiểm tra</span>
                </div>
                <ul className="text-xs text-[#3F5247] space-y-2.5 leading-relaxed">
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#15803D] mt-1.5 shrink-0"></span>
                    <span>
                      Đề gồm <strong>4 câu hỏi trắc nghiệm</strong> kiểm tra kiến thức trọng tâm của bài đọc.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#15803D] mt-1.5 shrink-0"></span>
                    <span>
                      Cần trả lời đúng tối thiểu <strong>3 / 4 câu (75%)</strong> để được công nhận thông thạo khái niệm.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#15803D] mt-1.5 shrink-0"></span>
                    <span>
                      Nút <strong>Nộp bài kiểm tra</strong> sẽ tự động mở khóa khi bạn đã chọn đủ cả 4 câu hỏi.
                    </span>
                  </li>
                </ul>
              </div>

              {/* Idempotency Protection Badge */}
              <div className="bg-[#F0FDF4] rounded-xl border border-[#BBF7D0] p-4 text-xs text-[#14532D] space-y-2 shadow-2xs">
                <div className="flex items-center gap-1.5 font-bold">
                  <ShieldCheck className="w-4 h-4 text-[#15803D]" aria-hidden="true" />
                  <span>Bảo vệ Lũy đẳng Giao dịch</span>
                </div>
                <p className="text-[11px] leading-relaxed text-[#166534]">
                  Mỗi lượt làm bài gắn liền với một <code>submission_id</code> độc nhất, chống trùng lặp dữ liệu và bảo toàn điểm cao nhất đã đạt được.
                </p>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  )
}
