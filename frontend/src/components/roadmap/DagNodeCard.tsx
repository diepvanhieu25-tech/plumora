import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Compass,
  FileCheck2,
  Lock,
} from 'lucide-react'
import type { DagNode } from '../../types'

interface DagNodeCardProps {
  node: DagNode
  isRecommended: boolean
  onOpenConcept: (slug: string, targetScreen: 'scr03_lesson' | 'scr04_quiz') => void
}

export function DagNodeCard({
  node,
  isRecommended,
  onOpenConcept,
}: DagNodeCardProps) {
  const percent = Math.round(node.mastery_score * 100)

  // 1. AI Recommended State (Stitch SCR-02 Sunlit Amber Card)
  if (isRecommended && node.status !== 'mastered') {
    return (
      <div
        className="bg-[#FFFBEB] border-2 border-[#D97706] rounded-xl p-5 shadow-md relative ring-4 ring-[#D97706]/20 transition-all flex flex-col justify-between"
        data-testid={`dag-node-${node.slug}`}
      >
        <div>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#FDE68A] text-[#78350F]">
                  {node.slug}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#D97706] text-white text-xs font-bold uppercase tracking-wider">
                  <Compass className="w-3 h-3" aria-hidden="true" />
                  <span>AI ĐỀ XUẤT</span>
                </span>
              </div>
              <h3 className="font-bold text-base text-[#451A03]">{node.title}</h3>
            </div>
            <span className="text-xs font-mono font-bold text-[#78350F] bg-[#FDE68A] px-2 py-0.5 rounded">
              {percent}%
            </span>
          </div>

          <p className="text-xs text-[#78350F] mt-2 font-medium">
            Khái niệm trọng tâm tiếp theo do DQN khuyến nghị dựa trên tiến độ học tập hiện tại.
          </p>

          <div className="mt-3 flex items-center justify-between text-xs font-mono text-[#78350F]">
            <span>
              Tiên quyết:{' '}
              <strong className="text-[#15803D]">
                {node.prerequisites.length > 0 ? node.prerequisites.join(', ') : 'Gốc (Root)'}
              </strong>
            </span>
            <span className="text-[#D97706] font-bold">Ưu tiên: Tối ưu</span>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-[#FDE68A] flex items-center justify-between">
          <span className="text-xs text-[#78350F] font-medium">
            Khuyên học tiếp để mở khóa tầng tiếp theo
          </span>
          <button
            type="button"
            onClick={() => onOpenConcept(node.slug, 'scr03_lesson')}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#15803D] hover:bg-[#166534] text-white font-bold text-xs rounded-lg transition-colors shadow-xs cursor-pointer"
            data-testid={`open-lesson-${node.slug}`}
          >
            <span>Học ngay</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    )
  }

  // 2. Mastered State (Stitch SCR-02 Green Card)
  if (node.status === 'mastered') {
    return (
      <div
        className="bg-[#F0FDF4] border border-[#16A34A] rounded-xl p-5 shadow-xs hover:shadow-md transition-shadow relative flex flex-col justify-between"
        data-testid={`dag-node-${node.slug}`}
      >
        <div>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-[#DCFCE7] text-[#14532D]">
                {node.slug}
              </span>
              <h3 className="font-bold text-base text-[#14532D]">{node.title}</h3>
            </div>
            <div className="flex items-center gap-1 bg-[#DCFCE7] text-[#14532D] text-xs font-bold px-2.5 py-1 rounded-full border border-[#86EFAC]">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" aria-hidden="true" />
              <span>{percent}%</span>
            </div>
          </div>

          {/* Progress Bar with 75% tick mark */}
          <div className="mt-4 space-y-1">
            <div className="flex justify-between text-xs font-mono text-[#166534]">
              <span>Độ thông thạo: {percent}%</span>
              <span className="font-semibold text-[#15803D]">Đạt chuẩn ≥ 75%</span>
            </div>
            <div className="w-full h-2 bg-[#DCFCE7] rounded-full overflow-hidden relative">
              <div
                className="absolute left-[75%] top-0 bottom-0 w-0.5 bg-[#15803D] z-10"
                title="Ngưỡng đạt 75%"
              ></div>
              <div
                className="bg-[#15803D] h-full rounded-full transition-all"
                style={{ width: `${percent}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-[#BBF7D0] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenConcept(node.slug, 'scr03_lesson')}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#14532D] hover:bg-[#DCFCE7] rounded-md transition-colors cursor-pointer"
            data-testid={`open-lesson-${node.slug}`}
          >
            <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Đọc lại</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenConcept(node.slug, 'scr04_quiz')}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-[#15803D] hover:bg-[#166534] rounded-md transition-colors cursor-pointer"
          >
            <FileCheck2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Làm lại Quiz</span>
          </button>
        </div>
      </div>
    )
  }

  // 3. Unlocked State (Stitch SCR-02 Teal Card)
  if (node.status === 'unlocked') {
    return (
      <div
        className="bg-[#F0FDFA] border border-[#0D9488] rounded-xl p-5 shadow-xs hover:shadow-md transition-shadow relative flex flex-col justify-between"
        data-testid={`dag-node-${node.slug}`}
      >
        <div>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-[#CCFBF1] text-[#134E4A]">
                {node.slug}
              </span>
              <h3 className="font-bold text-base text-[#134E4A]">{node.title}</h3>
            </div>
            <div className="flex items-center gap-1 bg-[#CCFBF1] text-[#134E4A] text-xs font-bold px-2.5 py-1 rounded-full border border-[#5EEAD4]">
              <span>ĐÃ MỞ KHÓA {percent}%</span>
            </div>
          </div>

          <div className="mt-4 space-y-1">
            <div className="flex justify-between text-xs font-mono text-[#0F766E]">
              <span>Độ thông thạo: {percent}%</span>
              <span>Chuẩn ≥ 75%</span>
            </div>
            <div className="w-full h-2 bg-[#CCFBF1] rounded-full overflow-hidden relative">
              <div
                className="absolute left-[75%] top-0 bottom-0 w-0.5 bg-[#0D9488] z-10"
                title="Ngưỡng đạt 75%"
              ></div>
              <div
                className="bg-[#0D9488] h-full rounded-full transition-all"
                style={{ width: `${percent}%` }}
              ></div>
            </div>
          </div>

          <div className="mt-3 text-xs font-mono text-[#0F766E]">
            <span>
              Tiên quyết:{' '}
              <strong className="text-[#134E4A]">
                {node.prerequisites.length > 0 ? node.prerequisites.join(', ') : 'Gốc (Root)'}
              </strong>
            </span>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-[#99F6E4] flex items-center justify-between">
          <span className="text-xs text-[#0F766E]">Sẵn sàng học</span>
          <button
            type="button"
            onClick={() => onOpenConcept(node.slug, 'scr03_lesson')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0D9488] hover:bg-[#0F766E] text-white font-bold text-xs rounded-lg transition-colors shadow-xs cursor-pointer"
            data-testid={`open-lesson-${node.slug}`}
          >
            <span>Bắt đầu học</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    )
  }

  // 4. Locked State (Stitch SCR-02 Muted Card)
  return (
    <div
      className="bg-[#F6F8F5] border border-[#D8E2D8] rounded-xl p-5 shadow-xs opacity-90 flex flex-col justify-between"
      data-testid={`dag-node-${node.slug}`}
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <span className="font-mono text-xs font-medium px-2 py-0.5 rounded bg-[#E7E5E4] text-[#57534E]">
              {node.slug}
            </span>
            <h3 className="font-bold text-base text-[#57534E]">{node.title}</h3>
          </div>
          <div className="flex items-center gap-1 bg-[#E7E5E4] text-[#57534E] text-xs font-semibold px-2.5 py-1 rounded-full border border-[#D6D3D1]">
            <Lock className="w-3.5 h-3.5" aria-hidden="true" />
            <span>ĐANG KHÓA</span>
          </div>
        </div>

        <div className="mt-4 text-xs font-mono text-[#57534E] bg-white p-2.5 rounded-lg border border-[#D8E2D8] flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#A8A29E]"></span>
          <span>
            Cần đạt ≥ 75% ở:{' '}
            <strong className="text-[#14241B]">
              {node.prerequisites.join(', ')}
            </strong>
          </span>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-[#D8E2D8] flex items-center justify-between">
        <span className="text-[11px] text-[#78716C]">Chưa đủ điều kiện tiên quyết</span>
        <button
          type="button"
          onClick={() => onOpenConcept(node.slug, 'scr03_lesson')}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#57534E] hover:text-[#14241B] hover:bg-[#E7E5E4] rounded-md transition-colors cursor-pointer"
          data-testid={`open-lesson-${node.slug}`}
        >
          <span>Xem điều kiện</span>
        </button>
      </div>
    </div>
  )
}
