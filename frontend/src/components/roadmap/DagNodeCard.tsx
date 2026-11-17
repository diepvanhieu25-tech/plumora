import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Compass,
  FileCheck2,
  Lock,
} from 'lucide-react'
import type { DagNode } from '../../types'
import { CONCEPT_TITLE_MAP } from '../../constants/concepts'

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

  const prereqDisplay =
    node.prerequisites.length > 0
      ? node.prerequisites
          .map((p) => CONCEPT_TITLE_MAP[p] || p)
          .join(', ')
      : 'Gốc (Root — Không cần tiên quyết)'

  // 1. AI Recommended State
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
                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-[#FDE68A] text-[#78350F]">
                  Khái niệm #{node.action_id + 1}
                </span>
                <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-[#FEF3C7] text-[#78350F] border border-[#FDE68A]">
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
            Khái niệm trọng tâm tiếp theo do mô hình DQN đề xuất dựa trên tiến độ học tập hiện tại.
          </p>

          <div className="mt-3 text-xs text-[#78350F] space-y-1 bg-white/70 p-2.5 rounded-lg border border-[#FDE68A]">
            <div>
              <span className="font-medium text-[#92400E]">Tiên quyết: </span>
              <strong className="text-[#15803D]">{prereqDisplay}</strong>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-[#FDE68A] flex items-center justify-between">
          <span className="text-xs text-[#78350F] font-medium">
            Phù hợp để tiếp tục mở khóa theo đồ thị DAG
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

  // 2. Mastered State
  if (node.status === 'mastered') {
    return (
      <div
        className="bg-[#F0FDF4] border border-[#16A34A] rounded-xl p-5 shadow-xs hover:shadow-md transition-shadow relative flex flex-col justify-between"
        data-testid={`dag-node-${node.slug}`}
      >
        <div>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-[#DCFCE7] text-[#14532D]">
                  Khái niệm #{node.action_id + 1}
                </span>
                <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-[#F0FDF4] text-[#14532D] border border-[#BBF7D0]">
                  {node.slug}
                </span>
              </div>
              <h3 className="font-bold text-base text-[#14532D]">{node.title}</h3>
            </div>
            <div className="flex items-center gap-1 bg-[#DCFCE7] text-[#14532D] text-xs font-bold px-2.5 py-1 rounded-full border border-[#86EFAC]">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" aria-hidden="true" />
              <span>{percent}%</span>
            </div>
          </div>

          {/* Progress Bar with 75% tick mark */}
          <div className="mt-4 space-y-1">
            <div className="flex justify-between text-xs text-[#166534]">
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

  // 3. Unlocked State
  if (node.status === 'unlocked') {
    return (
      <div
        className="bg-[#F0FDFA] border border-[#0D9488] rounded-xl p-5 shadow-xs hover:shadow-md transition-shadow relative flex flex-col justify-between"
        data-testid={`dag-node-${node.slug}`}
      >
        <div>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-[#CCFBF1] text-[#134E4A]">
                  Khái niệm #{node.action_id + 1}
                </span>
                <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-[#F0FDFA] text-[#134E4A] border border-[#99F6E4]">
                  {node.slug}
                </span>
              </div>
              <h3 className="font-bold text-base text-[#134E4A]">{node.title}</h3>
            </div>
            <div className="flex items-center gap-1 bg-[#CCFBF1] text-[#134E4A] text-xs font-bold px-2.5 py-1 rounded-full border border-[#5EEAD4]">
              <span>ĐÃ MỞ KHÓA {percent}%</span>
            </div>
          </div>

          <div className="mt-4 space-y-1">
            <div className="flex justify-between text-xs text-[#0F766E]">
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

          <div className="mt-3 text-xs text-[#0F766E] bg-white/70 p-2 rounded-lg border border-[#99F6E4]">
            <span className="font-medium text-[#134E4A]">Tiên quyết: </span>
            <span>{prereqDisplay}</span>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-[#99F6E4] flex items-center justify-between">
          <span className="text-xs text-[#0F766E]">Đã đủ điều kiện học</span>
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

  // 4. Locked State
  return (
    <div
      className="bg-[#F6F8F5] border border-[#D8E2D8] rounded-xl p-5 shadow-xs opacity-90 flex flex-col justify-between"
      data-testid={`dag-node-${node.slug}`}
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs font-medium px-2 py-0.5 rounded bg-[#E7E5E4] text-[#57534E]">
                Khái niệm #{node.action_id + 1}
              </span>
              <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-white text-[#57534E] border border-[#D8E2D8]">
                {node.slug}
              </span>
            </div>
            <h3 className="font-bold text-base text-[#57534E]">{node.title}</h3>
          </div>
          <div className="flex items-center gap-1 bg-[#E7E5E4] text-[#57534E] text-xs font-semibold px-2.5 py-1 rounded-full border border-[#D6D3D1]">
            <Lock className="w-3.5 h-3.5" aria-hidden="true" />
            <span>ĐANG KHÓA</span>
          </div>
        </div>

        <div className="mt-4 text-xs text-[#57534E] bg-white p-2.5 rounded-lg border border-[#D8E2D8] flex items-start gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#A8A29E] mt-1 shrink-0"></span>
          <div>
            <span className="font-medium text-[#78716C]">Cần đạt ≥ 75% ở: </span>
            <strong className="text-[#14241B]">{prereqDisplay}</strong>
          </div>
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
