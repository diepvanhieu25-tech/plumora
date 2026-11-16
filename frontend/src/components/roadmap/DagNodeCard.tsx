import { BookOpen, CheckCircle2, CircleDot, Compass, FileCheck2, Lock } from 'lucide-react'
import type { DagNode } from '../../types'

interface DagNodeCardProps {
  node: DagNode
  isRecommended: boolean
  onOpenLesson: (slug: string) => void
  onOpenQuiz: (slug: string) => void
}

export function DagNodeCard({
  node,
  isRecommended,
  onOpenLesson,
  onOpenQuiz,
}: DagNodeCardProps) {
  const pct = Math.round(node.mastery_score * 100)

  let cardStyle = 'bg-white border border-[#D8E2D8] text-[#14241B]'
  if (isRecommended) {
    cardStyle = 'bg-[#FFFBEB] border-2 border-[#D97706] text-[#14241B]'
  } else if (node.status === 'mastered') {
    cardStyle = 'bg-[#F0FDF4] border border-[#16A34A] text-[#14241B]'
  } else if (node.status === 'unlocked') {
    cardStyle = 'bg-[#F0FDFA] border border-[#0D9488] text-[#14241B]'
  } else if (node.status === 'locked') {
    cardStyle = 'bg-[#F5F5F4] border border-[#D6D3D1] text-[#57534E]'
  }

  return (
    <article
      className={`rounded-xl p-4 flex flex-col justify-between gap-3 shadow-xs ${cardStyle}`}
      data-testid={`dag-node-${node.slug}`}
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-white/80 border border-[#D8E2D8]">
            {node.slug}
          </span>

          {isRecommended ? (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-[#78350F]">
              <Compass className="w-3.5 h-3.5 text-[#D97706]" aria-hidden="true" />
              AI Khuyến nghị
            </span>
          ) : node.status === 'mastered' ? (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-[#14532D]">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" aria-hidden="true" />
              Đã thông thạo
            </span>
          ) : node.status === 'unlocked' ? (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-[#134E4A]">
              <CircleDot className="w-3.5 h-3.5 text-[#0D9488]" aria-hidden="true" />
              Đã mở khóa
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#57534E]">
              <Lock className="w-3.5 h-3.5" aria-hidden="true" />
              Đang khóa
            </span>
          )}
        </div>

        <h4 className="font-bold text-sm leading-snug">
          {node.title}
        </h4>

        {/* Progress bar with 75% threshold marker */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span>Mastery: {pct}%</span>
            <span>Mốc đạt: 75%</span>
          </div>
          <div className="w-full h-2 bg-stone-200 rounded-full overflow-hidden">
            <div
              className={`h-full ${
                node.status === 'mastered'
                  ? 'bg-[#16A34A]'
                  : 'bg-[#0D9488]'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <p className="text-xs text-[#3F5247]">
          Tiên quyết:{' '}
          {node.prerequisites.length > 0
            ? node.prerequisites.join(', ')
            : 'Không có (Root node)'}
        </p>
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-black/5">
        <button
          type="button"
          onClick={() => onOpenLesson(node.slug)}
          className="plumora-btn-outline text-xs flex-1"
          data-testid={`open-lesson-${node.slug}`}
        >
          <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
          <span>
            {node.status === 'locked' ? 'Xem điều kiện' : 'Đọc bài'}
          </span>
        </button>
        {node.status !== 'locked' ? (
          <button
            type="button"
            onClick={() => onOpenQuiz(node.slug)}
            className="plumora-btn-primary text-xs flex-1"
            data-testid={`open-quiz-${node.slug}`}
          >
            <FileCheck2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Làm Quiz</span>
          </button>
        ) : null}
      </div>
    </article>
  )
}
