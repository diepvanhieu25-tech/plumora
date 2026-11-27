import {
  BookOpen,
  CheckCircle2,
  Code2,
  Compass,
  GitMerge,
  History,
  Lock,
  ShieldCheck,
} from 'lucide-react'
import type { DomainRoadmapNode } from '../../types'
import { DepthBadge, getDepthMeta } from '../ui/DepthBadge'
import { RetentionMeter } from '../ui/RetentionMeter'

interface MultiDomainKgNodeCardProps {
  node: DomainRoadmapNode
  isRecommended?: boolean
  onOpenPlaybook?: (node: DomainRoadmapNode) => void
  onStartDepthProbe: (slug: string) => void
  onStartCodeSandbox: (slug: string) => void
  onStartReview: (slug: string) => void
  onFocusPrerequisite?: (prereqSlug: string) => void
}

export function MultiDomainKgNodeCard({
  node,
  isRecommended = false,
  onOpenPlaybook,
  onStartDepthProbe,
  onStartCodeSandbox,
  onStartReview,
  onFocusPrerequisite,
}: MultiDomainKgNodeCardProps) {
  const depthMeta = getDepthMeta(node.depth_level_norm, node.is_eligible)
  const depthPct = Math.round(node.depth_level_norm * 100)
  const insufficientEvidence = node.depth_level_norm > 0 && node.confidence < 0.5
  const prereqItems =
    node.prerequisite_titles && node.prerequisite_titles.length > 0
      ? node.prerequisite_titles
      : node.prerequisites.map((slug) => ({ slug, title: slug }))

  return (
    <article
      id={`concept-card-${node.slug}`}
      data-testid={`kg-node-${node.slug}`}
      className={`relative rounded-2xl p-5 transition-all flex flex-col justify-between gap-4 overflow-hidden ${
        isRecommended
          ? 'bg-ai-sunlit-bg border-2 border-ai-sunlit-border shadow-md ring-4 ring-ai-sunlit-border/15'
          : node.needs_review
            ? 'bg-white border-2 border-tertiary shadow-sm'
            : node.is_eligible
              ? 'bg-white border border-outline-variant/60 shadow-sm hover:shadow-md'
              : 'bg-surface-container-low/80 border border-outline-variant/40 opacity-85'
      }`}
    >
      {node.needs_review && (
        <div className="absolute top-0 right-0 px-2.5 py-0.5 bg-tertiary text-on-tertiary font-bold text-[10px] uppercase tracking-wider rounded-bl-lg">
          Đến hạn ôn tập
        </div>
      )}

      <div className="space-y-3 relative z-10">
        {/* Top Metadata Badges */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {isRecommended && (
              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-tertiary text-on-tertiary shadow-2xs">
                <Compass className="w-3 h-3" aria-hidden="true" />
                <span>AI Đề xuất</span>
              </span>
            )}
            <DepthBadge depthNorm={node.depth_level_norm} isEligible={node.is_eligible} />
            {node.is_shared && (
              <span
                className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-shared-bg text-shared-text border border-shared-border"
                title="Kiến thức dùng chung và tự động đồng bộ tiến độ giữa các chuyên ngành"
              >
                <GitMerge className="w-3 h-3" aria-hidden="true" />
                <span>Liên thông</span>
              </span>
            )}
          </div>

          {!node.is_eligible ? (
            <div
              className="w-8 h-8 rounded-xl bg-surface-container text-outline flex items-center justify-center shrink-0"
              title="Cần hoàn thành các bài tiên quyết đạt mức Hiểu bản chất (75%)"
            >
              <Lock className="w-4 h-4" aria-hidden="true" />
            </div>
          ) : node.depth_level_norm >= 0.75 ? (
            <div
              className="w-8 h-8 rounded-full bg-primary-container text-primary flex items-center justify-center shrink-0"
              title="Đã đạt chuẩn mở khóa tầng kế tiếp"
            >
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
            </div>
          ) : null}
        </div>

        {/* Title */}
        <div className="space-y-1">
          <h3 className="font-headline font-bold text-sm sm:text-[15px] text-on-surface leading-snug">
            {node.title}
          </h3>
          {node.playbook_completed && node.depth_level_norm < 0.75 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
              <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
              <span>Đã đọc xong bài giảng lý thuyết</span>
            </span>
          )}
        </div>

        {insufficientEvidence && (
          <div className="px-2.5 py-1.5 rounded-lg bg-surface-container text-[11px] text-on-surface-variant font-medium">
            Chưa đủ bằng chứng đánh giá — Hãy hoàn thành thêm bước kiểm tra để xác lập mức hiểu.
          </div>
        )}

        {/* Double Progress Indicators (Depth + Real-Time Retention) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-surface-container-low/80 p-3 rounded-xl border border-outline-variant/30">
          <div className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-on-surface-variant font-medium">Mức độ nắm vững</span>
              <span className="font-mono font-bold text-primary">{depthPct}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-surface-container-highest overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${depthMeta.barClass}`}
                style={{ width: `${Math.max(4, depthPct)}%` }}
              />
            </div>
            <p className="text-[10px] text-outline">Mốc mở khóa bài sau: 75%</p>
          </div>

          <RetentionMeter
            retention={node.retention_ebbinghaus}
            needsReview={node.needs_review}
            active={node.depth_level_norm >= 0.5}
            nextReviewDueAt={node.next_review_due_at}
            showSchedule
          />

          {/* Prerequisites Row (Vietnamese Titles) */}
          <div className="sm:col-span-2 pt-2 border-t border-surface-container-high text-[11px] text-on-surface-variant">
            {prereqItems.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1">
                <span className="font-semibold text-outline shrink-0">Cần nắm trước:</span>
                {prereqItems.map((p, idx) => (
                  <span key={p.slug} className="inline-flex items-center">
                    {onFocusPrerequisite ? (
                      <button
                        type="button"
                        onClick={() => onFocusPrerequisite(p.slug)}
                        className="text-primary hover:underline font-medium cursor-pointer text-left"
                      >
                        {p.title}
                      </button>
                    ) : (
                      <span className="font-medium text-on-surface">{p.title}</span>
                    )}
                    {idx < prereqItems.length - 1 && <span className="mr-1">,</span>}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-outline font-medium">Chủ đề nền tảng gốc — Học ngay không cần điều kiện trước</span>
            )}
          </div>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="pt-2 border-t border-surface-container flex flex-col gap-2 relative z-10">
        {onOpenPlaybook && (
          <button
            type="button"
            disabled={!node.is_eligible}
            onClick={() => onOpenPlaybook(node)}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-surface-container-low text-primary border border-primary/25 hover:bg-primary-container/40 disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer transition-colors"
            data-testid={`open-playbook-${node.slug}`}
          >
            <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{node.playbook_completed ? 'Xem lại Bài giảng Lý thuyết' : 'Đọc Bài giảng Lý thuyết'}</span>
          </button>
        )}
          {node.is_eligible && !node.playbook_completed && node.depth_level_norm < 0.25 && (
            <p className="text-[11px] font-medium text-tertiary">
              Cần đọc và xác nhận hoàn thành Bài giảng Lý thuyết trước
            </p>
          )}
        <div className="flex flex-wrap gap-2">
          {node.needs_review && (
            <button
              type="button"
              onClick={() => onStartReview(node.slug)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-tertiary text-on-tertiary hover:bg-tertiary-dim shadow-sm cursor-pointer transition-colors"
            >
              <History className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Ôn tập ngay</span>
            </button>
          )}
          <button
            type="button"
            disabled={!node.is_eligible || (!node.playbook_completed && node.depth_level_norm < 0.25)}
            onClick={() => onStartDepthProbe(node.slug)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-primary text-on-primary hover:bg-primary-dim disabled:opacity-45 disabled:cursor-not-allowed shadow-sm cursor-pointer transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Kiểm tra 5 tầng</span>
          </button>
          {node.has_code_challenge && (
            <button
              type="button"
              disabled={!node.is_eligible || (!node.playbook_completed && node.depth_level_norm < 0.25)}
              onClick={() => onStartCodeSandbox(node.slug)}
              className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold bg-surface-container text-on-surface hover:bg-surface-container-high disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer transition-colors"
              title="Thực hành lập trình trực tiếp"
            >
              <Code2 className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
              <span>Thực hành Code</span>
            </button>
          )}
        </div>
      </div>
    </article>
  )
}
