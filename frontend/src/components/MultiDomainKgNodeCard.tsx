import {
  Award,
  CheckCircle2,
  Code2,
  GitMerge,
  History,
  Layers,
  Lock,
  ShieldCheck,
  Sparkles,
  Wrench,
} from 'lucide-react'
import type { DomainRoadmapNode } from '../types'

interface MultiDomainKgNodeCardProps {
  node: DomainRoadmapNode
  isRecommended?: boolean
  onStartDepthProbe: (slug: string) => void
  onStartCodeSandbox: (slug: string) => void
  onStartReview: (slug: string) => void
}

function getDepthBadge(depthNorm: number) {
  if (depthNorm >= 1.0) {
    return {
      label: 'Mastery 100%',
      bg: 'bg-primary-container text-on-primary-container',
      bar: 'bg-primary',
      Icon: Award,
    }
  }
  if (depthNorm >= 0.75) {
    return {
      label: 'Deep 75%',
      bg: 'bg-primary-fixed-dim/40 text-on-primary-fixed-variant',
      bar: 'bg-primary',
      Icon: ShieldCheck,
    }
  }
  if (depthNorm >= 0.5) {
    return {
      label: 'Applied 50%',
      bg: 'bg-secondary-container/50 text-on-secondary-container',
      bar: 'bg-secondary',
      Icon: Wrench,
    }
  }
  if (depthNorm >= 0.25) {
    return {
      label: 'Surface 25%',
      bg: 'bg-surface-container text-on-surface-variant',
      bar: 'bg-outline',
      Icon: Layers,
    }
  }
  return {
    label: 'Chưa kiểm chứng (0%)',
    bg: 'bg-surface-container text-on-surface-variant',
    bar: 'bg-outline-variant',
    Icon: Layers,
  }
}

export function MultiDomainKgNodeCard({
  node,
  isRecommended = false,
  onStartDepthProbe,
  onStartCodeSandbox,
  onStartReview,
}: MultiDomainKgNodeCardProps) {
  const badge = getDepthBadge(node.depth_level_norm)
  const BadgeIcon = badge.Icon
  const depthPct = Math.round(node.depth_level_norm * 100)
  const retentionPct = Math.round(node.retention_ebbinghaus * 100)
  const insufficientEvidence = node.depth_level_norm > 0 && node.confidence < 0.5

  return (
    <article
      data-testid={`kg-node-${node.slug}`}
      className={`relative rounded-2xl p-5 transition-all flex flex-col justify-between gap-4 overflow-hidden ${
        isRecommended
          ? 'bg-surface-container-lowest shadow-lg ring-2 ring-primary'
          : node.needs_review
            ? 'bg-surface-container-lowest shadow-md ring-2 ring-tertiary-fixed'
            : node.is_eligible
              ? 'bg-surface-container-lowest shadow-sm hover:shadow-md'
              : 'bg-surface-container-low/60 opacity-80'
      }`}
    >
      {isRecommended && (
        <div className="absolute -top-10 -right-10 w-24 h-24 bg-primary-container/40 rounded-full blur-xl pointer-events-none" />
      )}

      {node.needs_review && (
        <div className="absolute top-0 right-0 px-2.5 py-0.5 bg-tertiary text-on-tertiary font-label font-bold text-[10px] uppercase tracking-wider rounded-bl-lg">
          Cần ôn tập
        </div>
      )}

      <div className="space-y-3 relative z-10">
        {/* Top Metadata Badges */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {node.is_shared && (
              <span
                className="inline-flex items-center gap-1 text-[11px] font-label font-bold px-2 py-0.5 rounded-full bg-secondary-container/40 text-secondary"
                title="Khái niệm liên thông đa lĩnh vực"
              >
                <GitMerge className="w-3 h-3" aria-hidden="true" />
                Liên thông
              </span>
            )}
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-label font-extrabold px-2 py-0.5 rounded-full ${badge.bg}`}
            >
              <BadgeIcon className="w-3 h-3" aria-hidden="true" />
              {badge.label}
            </span>
            {isRecommended && (
              <span className="inline-flex items-center gap-1 text-[10px] font-label font-extrabold px-2 py-0.5 rounded-full bg-primary-container text-on-primary-container">
                <Sparkles className="w-3 h-3" aria-hidden="true" />
                GNN-PPO
              </span>
            )}
          </div>

          {!node.is_eligible ? (
            <div className="w-8 h-8 rounded-xl bg-surface-container text-outline flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4" aria-hidden="true" />
            </div>
          ) : node.depth_level_norm >= 0.75 ? (
            <div className="w-8 h-8 rounded-full bg-primary-container text-primary flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
            </div>
          ) : null}
        </div>

        {/* Code Slug & Title */}
        <div>
          <div className="flex items-center gap-2">
            <code
              className={`font-mono text-xs font-bold ${
                node.needs_review
                  ? 'text-tertiary'
                  : node.is_eligible
                    ? 'text-primary'
                    : 'text-outline'
              }`}
            >
              {node.slug}
            </code>
            <span className="text-[10px] font-mono text-on-surface-variant">
              Conf: {Math.round(node.confidence * 100)}%
            </span>
          </div>
          <h3 className="font-headline font-bold text-sm text-on-surface leading-snug mt-0.5">
            {node.title}
          </h3>
        </div>

        {insufficientEvidence && (
          <div className="px-2.5 py-1.5 rounded-lg bg-surface-container text-[11px] text-on-surface-variant font-medium">
            Bằng chứng chưa đủ (conf &lt; 50%) — Cần làm tiếp để xác lập mức hiểu
          </div>
        )}

        {/* Double Progress Indicators (Depth + Ebbinghaus R(t)) */}
        <div className="grid grid-cols-2 gap-3 bg-surface-container-low/70 p-3 rounded-xl">
          <div>
            <div className="flex justify-between text-[11px] font-label mb-1">
              <span className="text-on-surface-variant font-medium">Độ sâu nắm vững</span>
              <span className="font-mono font-bold text-primary">{depthPct}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-surface-container-highest overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${badge.bar}`}
                style={{ width: `${Math.max(4, depthPct)}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[11px] font-label mb-1">
              <span
                className={`font-medium ${
                  node.needs_review ? 'text-tertiary font-bold' : 'text-on-surface-variant'
                }`}
              >
                Trí nhớ R(t)
              </span>
              <span
                className={`font-mono font-bold ${
                  node.needs_review ? 'text-tertiary' : 'text-secondary'
                }`}
              >
                {node.depth_level_norm >= 0.5 ? `${retentionPct}%` : '—'}
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-surface-container-highest overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  node.needs_review ? 'bg-tertiary' : 'bg-secondary'
                }`}
                style={{
                  width: `${node.depth_level_norm >= 0.5 ? Math.max(4, retentionPct) : 0}%`,
                }}
              />
            </div>
          </div>

          <div className="col-span-2 flex items-center justify-between text-[10px] font-mono text-outline pt-1.5 border-t border-surface-container-high">
            <span>Độ ổn định S: {node.stability_s.toFixed(1)} ngày</span>
            {node.prerequisites.length > 0 ? (
              <span className="truncate max-w-[140px]" title={node.prerequisites.join(', ')}>
                Cần: {node.prerequisites.join(', ')}
              </span>
            ) : (
              <span>Root Node</span>
            )}
          </div>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="pt-2 border-t border-surface-container flex flex-wrap gap-2 relative z-10">
        {node.needs_review && (
          <button
            type="button"
            onClick={() => onStartReview(node.slug)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-label font-bold bg-tertiary text-on-tertiary hover:bg-tertiary-dim shadow-sm cursor-pointer transition-colors"
          >
            <History className="w-3.5 h-3.5" aria-hidden="true" />
            Ôn tập ngay
          </button>
        )}
        <button
          type="button"
          disabled={!node.is_eligible}
          onClick={() => onStartDepthProbe(node.slug)}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-headline font-bold bg-primary text-on-primary hover:bg-primary-dim disabled:opacity-45 disabled:cursor-not-allowed shadow-sm cursor-pointer transition-colors"
        >
          <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
          Đào sâu 5 tầng
        </button>
        <button
          type="button"
          disabled={!node.is_eligible}
          onClick={() => onStartCodeSandbox(node.slug)}
          className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-label font-semibold bg-surface-container text-on-surface hover:bg-surface-container-high disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer transition-colors"
          title="Thực hành Code Sandbox"
        >
          <Code2 className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
          Code
        </button>
      </div>
    </article>
  )
}
