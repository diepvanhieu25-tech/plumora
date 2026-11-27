import { Activity, ArrowRight, Clock, GitMerge } from 'lucide-react'
import type { DomainListItem } from '../../types'

function getDomainVisualTheme(slug: string): {
  gradient: string
  subtitle: string
} {
  if (slug === 'backend') {
    return {
      gradient: 'from-[#14532d] via-[#15803d] to-[#0f3d21]',
      subtitle: 'Backend Engineering',
    }
  }
  if (slug === 'frontend') {
    return {
      gradient: 'from-[#134e4a] via-[#0d9488] to-[#0f3d39]',
      subtitle: 'Frontend Engineering',
    }
  }
  if (slug === 'devops') {
    return {
      gradient: 'from-[#1e3a2f] via-[#2c5241] to-[#11201a]',
      subtitle: 'DevOps & Hệ thống',
    }
  }
  return {
    gradient: 'from-[#164e35] via-[#15803d] to-[#0d261a]',
    subtitle: 'Chuyên ngành Kỹ thuật',
  }
}

export interface DomainHubCardProps {
  domain: DomainListItem
  onSelectDomainRoadmap: (domainSlug: string) => void
  onStartPlacement: (domainSlug: string) => void
}

export function DomainHubCard({
  domain: d,
  onSelectDomainRoadmap,
  onStartPlacement,
}: DomainHubCardProps) {
  const s = d.user_summary
  const learnedCount = s.surface_count + s.applied_count + s.deep_count + s.mastery_count
  const deepAndMastery = s.deep_count + s.mastery_count
  const deepPct = d.total_nodes > 0 ? Math.round((deepAndMastery / d.total_nodes) * 100) : 0
  const masteryW = d.total_nodes > 0 ? (s.mastery_count / d.total_nodes) * 100 : 0
  const deepW = d.total_nodes > 0 ? (s.deep_count / d.total_nodes) * 100 : 0
  const appliedW = d.total_nodes > 0 ? (s.applied_count / d.total_nodes) * 100 : 0
  const theme = getDomainVisualTheme(d.slug)

  return (
    <article
      data-testid={`domain-card-${d.slug}`}
      className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between overflow-hidden border border-outline-variant/60"
    >
      <div>
        <div
          className={`relative h-40 w-full bg-gradient-to-br ${theme.gradient} overflow-hidden p-4 flex flex-col justify-between`}
        >
          <div className="flex items-center justify-between gap-2 relative z-10">
            {learnedCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/95 text-on-primary-container text-[11px] font-bold">
                <span className="w-2 h-2 rounded-full bg-primary" />
                Đang theo học
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/90 text-on-surface text-[11px] font-bold">
                Lộ trình mới
              </span>
            )}
            <span className="px-2.5 py-0.5 rounded-full bg-black/30 backdrop-blur-xs text-[11px] font-semibold text-white">
              {d.total_nodes} chủ đề
            </span>
          </div>

          <div className="relative z-10 text-white">
            <h2 className="font-headline font-extrabold text-lg leading-tight">{d.title}</h2>
            <p className="text-xs text-white/80 mt-0.5">{theme.subtitle}</p>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-on-surface-variant leading-relaxed">{d.description}</p>

          {/* Progress Section */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-on-surface">Hoàn thành vững chắc</span>
              <span className="font-mono font-bold text-primary">
                {deepAndMastery}/{d.total_nodes} ({deepPct}%)
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-surface-container-high overflow-hidden flex">
              {masteryW > 0 && (
                <div className="h-full bg-primary" style={{ width: `${masteryW}%` }} />
              )}
              {deepW > 0 && (
                <div className="h-full bg-primary-fixed-dim" style={{ width: `${deepW}%` }} />
              )}
              {appliedW > 0 && (
                <div className="h-full bg-secondary" style={{ width: `${appliedW}%` }} />
              )}
            </div>
            <div className="flex items-center justify-between text-[11px] text-on-surface-variant">
              <span>{s.mastery_count} Làm chủ</span>
              <span>{s.deep_count} Hiểu sâu</span>
              <span>{s.applied_count} Áp dụng</span>
            </div>
          </div>

          {d.shared_nodes_count > 0 && (
            <div className="p-2.5 rounded-xl bg-shared-bg/70 border border-shared-border/50 text-xs text-shared-text flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 font-semibold">
                <GitMerge className="w-3.5 h-3.5" aria-hidden="true" />
                Chủ đề liên thông
              </span>
              <span className="font-bold">{d.shared_nodes_count} chủ đề</span>
            </div>
          )}

          {learnedCount === 0 && (
            <div className="p-2.5 rounded-xl bg-surface-container-low text-[11px] font-medium text-on-surface-variant">
              Chưa có tiến độ — Bạn có thể học từ Tầng 1 hoặc làm bài định vị nhanh để mở khóa phần đã biết.
            </div>
          )}

          {s.needs_review_count > 0 && (
            <div className="p-2.5 rounded-xl bg-ai-sunlit-bg border border-ai-sunlit-border/40 text-xs font-semibold text-ai-sunlit-text flex items-center gap-2">
              <Clock className="w-4 h-4 text-tertiary shrink-0" aria-hidden="true" />
              <span>{s.needs_review_count} chủ đề đến hạn ôn tập</span>
            </div>
          )}
        </div>
      </div>

      <div className="p-5 pt-0 space-y-2">
        <button
          type="button"
          onClick={() => onSelectDomainRoadmap(d.slug)}
          className="w-full py-2.5 px-4 rounded-xl bg-primary hover:bg-primary-dim text-on-primary text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer"
        >
          <span>{learnedCount > 0 ? 'Tiếp tục Lộ trình' : 'Bắt đầu từ Tầng 1'}</span>
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onStartPlacement(d.slug)}
          className="w-full py-2 px-3 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Activity className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
          <span>
            {s.placement_completed
              ? 'Làm lại Bài Định vị Đầu vào'
              : 'Kiểm tra Định vị Đầu vào (5 phút)'}
          </span>
        </button>
      </div>
    </article>
  )
}
