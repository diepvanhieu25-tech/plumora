import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock,
  Compass,
  FileCheck2,
} from 'lucide-react'
import type { ConceptDetail } from '../../types'

interface LessonReaderProps {
  currentConcept: ConceptDetail
  onGoToQuiz: () => void
  onBackToRoadmap: () => void
}

export function LessonReader({
  currentConcept,
  onGoToQuiz,
  onBackToRoadmap,
}: LessonReaderProps) {
  const percent = Math.round(currentConcept.mastery_score * 100)

  return (
    <div className="space-y-6" data-testid="scr03-lesson-section">
      {/* Sub-header Navigation & Tab Bar (Sticky Bar - Stitch SCR-03) */}
      <div className="bg-white border-b border-[#D8E2D8] -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-2.5 sticky top-[57px] z-20 shadow-2xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Back button */}
          <button
            type="button"
            onClick={onBackToRoadmap}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#3F5247] hover:text-[#15803D] hover:bg-[#F6F8F5] py-1.5 px-2.5 rounded-lg transition-colors cursor-pointer"
            data-testid="back-to-roadmap-btn"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Quay về Bản đồ Lộ trình</span>
          </button>

          {/* Centered Segmented Control Tabs */}
          <div className="flex items-center bg-[#F6F8F5] p-1 rounded-xl border border-[#D8E2D8]">
            <button
              type="button"
              className="bg-[#15803D] text-white rounded-lg px-4 py-1.5 text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-xs transition-all cursor-default"
            >
              <BookOpen className="w-4 h-4" aria-hidden="true" />
              <span>1. Bài học Lý thuyết (Markdown)</span>
            </button>
            <button
              type="button"
              onClick={onGoToQuiz}
              className="text-[#3F5247] hover:text-[#14241B] hover:bg-white rounded-lg px-4 py-1.5 text-xs sm:text-sm font-medium flex items-center gap-2 transition-all cursor-pointer"
              data-testid="go-to-quiz-cta"
            >
              <FileCheck2 className="w-4 h-4 text-[#57534E]" aria-hidden="true" />
              <span>2. Làm bài Quiz kiểm tra (4 câu)</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#D97706]"></span>
            </button>
          </div>

          {/* Right Reading Time Info */}
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-[#3F5247] font-medium bg-[#F6F8F5] px-3 py-1.5 rounded-lg border border-[#D8E2D8]">
            <Clock className="w-3.5 h-3.5 text-[#57534E]" aria-hidden="true" />
            <span>
              Thời gian đọc: <strong>~5 phút</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Two-Column Main Content Container (Stitch SCR-03) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Markdown Reading Content (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          <article className="bg-white rounded-2xl border border-[#D8E2D8] shadow-sm p-6 sm:p-8">
            {/* Lesson Header Meta & Badges */}
            <header className="space-y-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold px-2.5 py-1 rounded-md bg-[#F6F8F5] text-[#3F5247] border border-[#D8E2D8]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#57534E]"></span>
                  Tầng {currentConcept.tier} • {currentConcept.slug}
                </span>

                <span className="font-mono text-xs font-semibold px-2.5 py-1 rounded-md bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0]">
                  Mastery: {percent}%
                </span>

                <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-md bg-[#FFFBEB] text-[#78350F] border border-[#FDE68A]">
                  <Compass className="w-3.5 h-3.5 text-[#D97706]" aria-hidden="true" />
                  <span>AI ĐỀ XUẤT TIẾP THEO (DQN POLICY)</span>
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#14241B] tracking-tight leading-snug">
                {currentConcept.title}
              </h1>
              <p className="text-sm text-[#3F5247] font-normal leading-relaxed">
                Khái niệm nền tảng xử lý dữ liệu tin cậy, toàn vẹn dữ liệu và tối ưu hiệu năng trong kiến trúc backend.
              </p>
            </header>

            <div className="border-t border-[#D8E2D8] my-6"></div>

            {/* Markdown Body */}
            <div
              className="prose max-w-none whitespace-pre-line text-sm leading-relaxed text-[#14241B] space-y-4"
              data-testid="lesson-markdown-body"
            >
              {currentConcept.lesson_markdown}
            </div>

            {/* Bottom Completion Banner & Primary Quiz CTA */}
            <div className="bg-[#F0FDF4] border border-[#86EFAC] rounded-xl p-5 sm:p-6 mt-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 shadow-xs">
              <div className="space-y-1.5 max-w-xl">
                <div className="flex items-center gap-2 text-[#15803D] font-bold text-base">
                  <CheckCircle2 className="w-5 h-5 text-[#16A34A] shrink-0" aria-hidden="true" />
                  <span>Bạn đã hoàn thành phần lý thuyết cốt lõi!</span>
                </div>
                <p className="text-xs sm:text-sm text-[#14532D] leading-relaxed">
                  Hãy hoàn thành bài kiểm tra trắc nghiệm 4 câu (đạt tối thiểu <strong>3/4 câu = 75%</strong>) để ghi nhận điểm thông thạo khái niệm này và mở khóa chặng tiếp theo trong lộ trình DAG.
                </p>
              </div>

              <button
                type="button"
                onClick={onGoToQuiz}
                className="w-full md:w-auto bg-[#15803D] hover:bg-[#166534] text-white font-bold px-6 py-3.5 rounded-xl shadow-md flex items-center justify-center gap-2.5 transition-all text-sm shrink-0 cursor-pointer active:scale-[0.98]"
                data-testid="start-quiz-btn"
              >
                <FileCheck2 className="w-5 h-5" aria-hidden="true" />
                <span>Chuyển sang làm bài Quiz (4 câu) →</span>
              </button>
            </div>
          </article>
        </div>

        {/* Right Column: Context Sidebar (4 cols - Stitch SCR-03) */}
        <aside className="lg:col-span-4 space-y-6">
          {/* Card 1: Điều kiện Tiên quyết (Prerequisites) */}
          <div className="bg-white rounded-xl border border-[#D8E2D8] p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-[#14241B] flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#15803D]" aria-hidden="true" />
                <span>Điều kiện Tiên quyết</span>
              </h3>
              <span className="text-xs font-mono text-[#57534E]">Tầng {currentConcept.tier}</span>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-[11px] font-semibold text-[#57534E] uppercase tracking-wider block mb-1.5">
                  Khái niệm tiền đề (Upstream):
                </span>
                {currentConcept.prerequisites.length > 0 ? (
                  currentConcept.prerequisites.map((p) => (
                    <div
                      key={p}
                      className="flex items-start gap-2.5 p-3 rounded-lg bg-[#F0FDF4] border border-[#16A34A]/30 text-xs mb-2"
                    >
                      <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" aria-hidden="true" />
                      <div>
                        <span className="font-mono font-bold text-[#14532D]">{p}</span>
                        <p className="text-[#3F5247] text-[11px]">Đạt chuẩn ≥ 75%</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-3 rounded-lg bg-[#F6F8F5] text-xs text-[#57534E] font-mono">
                    Khái niệm gốc (Root Node) • Không yêu cầu tiên quyết
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Card 2: Lý do DQN Khuyến nghị (Sunlit Apical Bud) */}
          <div className="bg-[#FFFBEB] rounded-xl border border-[#D97706] p-5 shadow-sm space-y-3.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#FDE68A] flex items-center justify-center text-[#78350F]">
                <Compass className="w-4 h-4" aria-hidden="true" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-[#78350F]">Khuyến nghị từ RL DQN</h3>
                <p className="text-[11px] text-[#92400E]">Q-Learning Deep Reinforcement Learning</p>
              </div>
            </div>

            <div className="bg-white/90 rounded-lg p-3 border border-[#FDE68A] font-mono text-[11px] space-y-1.5 text-[#14241B]">
              <div className="flex justify-between items-center py-0.5 border-b border-amber-100">
                <span className="text-[#57534E]">policy_source</span>
                <span className="font-bold text-[#78350F]">dqn</span>
              </div>
              <div className="flex justify-between items-center py-0.5 border-b border-amber-100">
                <span className="text-[#57534E]">state_source</span>
                <span className="font-medium">redis_cache</span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-[#57534E]">checkpoint</span>
                <span className="text-[#15803D] font-bold">SHA-256 Verified</span>
              </div>
            </div>

            <p className="text-xs text-[#78350F] leading-relaxed">
              Mô hình đánh giá việc hoàn thành khái niệm này sẽ giúp tối ưu hóa thời gian mở khóa các tầng tiếp theo trong lộ trình.
            </p>
          </div>

          {/* Card 3: Quy tắc Đánh giá Mastery (D-06) */}
          <div className="bg-white rounded-xl border border-[#D8E2D8] p-5 shadow-sm space-y-3">
            <h3 className="font-bold text-sm text-[#14241B] flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-[#15803D]" aria-hidden="true" />
              <span>Quy tắc Đánh giá Mastery (D-06)</span>
            </h3>
            <ul className="text-xs text-[#3F5247] space-y-2 leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#15803D] mt-1.5 shrink-0"></span>
                <span>
                  <strong>4 câu hỏi trắc nghiệm</strong> chọn 1 đáp án duy nhất (Single-choice A/B/C/D).
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#15803D] mt-1.5 shrink-0"></span>
                <span>
                  Ngưỡng đạt chuẩn: <strong>≥ 75%</strong> (đúng tối thiểu 3 trên 4 câu).
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#15803D] mt-1.5 shrink-0"></span>
                <span>
                  Không giới hạn số lần làm lại; hệ thống bảo lưu điểm số cao nhất{' '}
                  <code className="font-mono text-[11px] bg-[#F6F8F5] px-1 py-0.5 rounded">
                    max(old, score)
                  </code>
                  .
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#15803D] mt-1.5 shrink-0"></span>
                <span>Ghi nhận tức thì qua ACID Transaction và cập nhật Redis Cache.</span>
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}
