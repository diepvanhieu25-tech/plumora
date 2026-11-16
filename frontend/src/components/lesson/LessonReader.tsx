import { FileCheck2 } from 'lucide-react'
import type { ConceptDetail } from '../../types'

interface LessonReaderProps {
  currentConcept: ConceptDetail
  onGoToQuiz: () => void
}

export function LessonReader({
  currentConcept,
  onGoToQuiz,
}: LessonReaderProps) {
  return (
    <section
      aria-label="SCR-03 Bài học Lý thuyết Markdown"
      className="plumora-card space-y-4"
      data-testid="scr03-lesson-section"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D8E2D8] pb-3">
        <div>
          <div className="text-xs font-mono text-[#3F5247]">
            Bản đồ lộ trình / Tầng {currentConcept.tier} / [{currentConcept.action_id}]{' '}
            {currentConcept.slug}
          </div>
          <h2 className="text-xl font-bold text-[#14241B]">
            {currentConcept.title}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1 rounded-md bg-[#F0FDF4] border border-[#16A34A] text-[#14532D]">
            Mastery hiện tại: {Math.round(currentConcept.mastery_score * 100)}%
          </span>
          <button
            type="button"
            onClick={onGoToQuiz}
            className="plumora-btn-primary text-xs"
            data-testid="go-to-quiz-cta"
          >
            <FileCheck2 className="w-4 h-4" aria-hidden="true" />
            <span>Làm bài Quiz kiểm tra (4 câu)</span>
          </button>
        </div>
      </div>

      <div
        className="prose max-w-[68ch] whitespace-pre-line text-sm leading-relaxed text-[#14241B] font-normal"
        data-testid="lesson-markdown-body"
      >
        {currentConcept.lesson_markdown}
      </div>
    </section>
  )
}
