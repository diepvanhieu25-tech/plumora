import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Compass,
  GitMerge,
  History,
} from 'lucide-react'
import { apiGetDomainRoadmap, apiGetV2Recommendation } from '../../api'
import { MultiDomainKgNodeCard } from '../../components/learner/MultiDomainKgNodeCard'
import { RoadmapRecommendationBanner } from '../../components/learner/RoadmapRecommendationBanner'
import { PageContextBar } from '../../components/ui/PageContextBar'
import { StatusAlertBanner } from '../../components/ui/StatusAlertBanner'
import { useAsyncQuery } from '../../hooks/useAsyncQuery'
import type { DomainRoadmapNode, DomainRoadmapResponse, V2RecommendationResponse } from '../../types'

interface MultiDomainRoadmapPageProps {
  domainSlug: string
  onBackToHub: () => void
  onOpenPlaybook: (domainSlug: string, node: DomainRoadmapNode) => void
  onStartDepthProbe: (domainSlug: string, conceptSlug: string) => void
  onStartCodeSandbox: (domainSlug: string, conceptSlug: string) => void
  onStartReview: (domainSlug: string, conceptSlug: string) => void
}

const TIER_TITLES: Record<number, { title: string; subtitle: string }> = {
  1: { title: 'Tầng 1: Nền tảng Cốt lõi', subtitle: 'Kiến thức nền để bắt đầu' },
  2: { title: 'Tầng 2: Giao thức & Dữ liệu', subtitle: 'Cơ chế vận hành & lưu trữ' },
  3: { title: 'Tầng 3: Kiến trúc & Tích hợp', subtitle: 'Thiết kế hệ thống & tối ưu' },
  4: { title: 'Tầng 4: Bảo mật & Vận hành', subtitle: 'An toàn & độ tin cậy thực tế' },
}

export function MultiDomainRoadmapPage({
  domainSlug,
  onBackToHub,
  onOpenPlaybook,
  onStartDepthProbe,
  onStartCodeSandbox,
  onStartReview,
}: MultiDomainRoadmapPageProps) {
  const [filterMode, setFilterMode] = useState<'all' | 'recommended' | 'review' | 'shared'>('all')

  const { data, loading, errorMessage, refetch } = useAsyncQuery<{
    roadmap: DomainRoadmapResponse
    rec: V2RecommendationResponse
  }>(
    async (signal) => {
      const [roadmap, rec] = await Promise.all([
        apiGetDomainRoadmap(domainSlug, signal),
        apiGetV2Recommendation(domainSlug, signal),
      ])
      return { roadmap, rec }
    },
    [domainSlug],
  )

  const roadmap = data?.roadmap ?? null
  const rec = data?.rec ?? null

  const recommendedSlug = rec?.recommended_action?.concept_slug
  const recommendedNode = useMemo(
    () => roadmap?.nodes.find((n) => n.slug === recommendedSlug) ?? null,
    [roadmap, recommendedSlug],
  )

  const summaryCounts = useMemo(() => {
    const nodes = roadmap?.nodes ?? []
    return {
      mastery: nodes.filter((n) => n.depth_level_norm >= 1.0).length,
      deep: nodes.filter((n) => n.depth_level_norm >= 0.75 && n.depth_level_norm < 1.0).length,
      applied: nodes.filter((n) => n.depth_level_norm >= 0.5 && n.depth_level_norm < 0.75).length,
      locked: nodes.filter((n) => !n.is_eligible).length,
      shared: nodes.filter((n) => n.is_shared).length,
      reviewNodes: nodes.filter((n) => n.needs_review),
    }
  }, [roadmap])

  const filteredNodes = useMemo(() => {
    if (!roadmap) return []
    if (filterMode === 'recommended') {
      return roadmap.nodes.filter((n) => n.slug === recommendedSlug)
    }
    if (filterMode === 'review') return roadmap.nodes.filter((n) => n.needs_review)
    if (filterMode === 'shared') return roadmap.nodes.filter((n) => n.is_shared)
    return roadmap.nodes
  }, [roadmap, filterMode, recommendedSlug])

  const groupedByTier = useMemo(() => {
    const map = new Map<number, DomainRoadmapNode[]>()
    for (const node of filteredNodes) {
      const list = map.get(node.tier) ?? []
      list.push(node)
      map.set(node.tier, list)
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0])
  }, [filteredNodes])

  function handleCtaRecommended() {
    if (!rec?.recommended_action) return
    const { concept_slug, learning_mode } = rec.recommended_action
    if (learning_mode === 'Learn_New') {
      if (recommendedNode) {
        onOpenPlaybook(domainSlug, recommendedNode)
      } else {
        onStartDepthProbe(domainSlug, concept_slug)
      }
      return
    }
    if (learning_mode === 'Code_Practice') {
      if (recommendedNode && !recommendedNode.has_code_challenge) {
        onStartDepthProbe(domainSlug, concept_slug)
      } else {
        onStartCodeSandbox(domainSlug, concept_slug)
      }
      return
    }
    if (learning_mode === 'Spaced_Review') {
      onStartReview(domainSlug, concept_slug)
      return
    }
    onStartDepthProbe(domainSlug, concept_slug)
  }

  function handleFocusPrerequisite(prereqSlug: string) {
    setFilterMode('all')
    setTimeout(() => {
      const el = document.getElementById(`concept-card-${prereqSlug}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)
  }

  return (
    <section className="w-full pb-8 space-y-6" data-testid="scr11-multi-domain-roadmap">
      <PageContextBar
        backLabel="Đổi chuyên ngành"
        onBack={onBackToHub}
        breadcrumbs={[
          { label: 'Chuyên ngành', onClick: onBackToHub },
          { label: roadmap?.domain_title ?? domainSlug, isCurrent: true },
        ]}
        rightSlot={
          summaryCounts.reviewNodes.length > 0 ? (
            <button
              type="button"
              onClick={() => onStartReview(domainSlug, summaryCounts.reviewNodes[0].slug)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-ai-sunlit-bg border border-ai-sunlit-border/50 text-ai-sunlit-text text-xs font-bold hover:bg-tertiary-container transition-colors cursor-pointer"
            >
              <History className="w-4 h-4 text-tertiary" aria-hidden="true" />
              <span>Ôn tập đến hạn</span>
              <span className="w-5 h-5 rounded-full bg-tertiary text-on-tertiary flex items-center justify-center text-[10px] font-mono">
                {summaryCounts.reviewNodes.length}
              </span>
            </button>
          ) : undefined
        }
      />

      {/* Domain Progress Summary Strip */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-outline-variant/50 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-headline font-extrabold text-xl sm:text-2xl text-on-surface">
            Lộ trình {roadmap?.domain_title ?? domainSlug}
          </h1>
          <p className="text-xs text-on-surface-variant">
            Hoàn thành từng chủ đề đạt mốc Hiểu bản chất (75%) để mở khóa các chủ đề chuyên sâu hơn.
          </p>
        </div>

        {roadmap && (
          <div className="flex flex-wrap items-center gap-3 text-xs text-on-surface-variant">
            <span className="inline-flex items-center gap-1.5 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-primary" />
              {summaryCounts.mastery} Làm chủ
            </span>
            <span className="inline-flex items-center gap-1.5 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-primary-fixed-dim" />
              {summaryCounts.deep} Hiểu sâu
            </span>
            <span className="inline-flex items-center gap-1.5 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-secondary" />
              {summaryCounts.applied} Áp dụng
            </span>
            <span className="inline-flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-outline-variant" />
              {summaryCounts.locked} Chưa mở
            </span>
            {summaryCounts.shared > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-shared-bg text-shared-text border border-shared-border text-[11px] font-bold">
                {summaryCounts.shared} Chủ đề liên thông
              </span>
            )}
          </div>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="space-y-4">
          <div className="h-44 rounded-3xl bg-white border border-outline-variant/40 animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-56 rounded-2xl bg-white border border-outline-variant/40 animate-pulse"
              />
            ))}
          </div>
        </div>
      )}

      {/* Error State */}
      {!loading && errorMessage && (
        <StatusAlertBanner variant="error" message={errorMessage} onRetry={refetch} />
      )}

      {!loading && !errorMessage && roadmap && (
        <>
          {/* Real-Time Ebbinghaus Spaced Repetition Alert */}
          {summaryCounts.reviewNodes.length > 0 && (
            <div
              role="status"
              aria-live="polite"
              className="rounded-2xl p-4 bg-ai-sunlit-bg border border-ai-sunlit-border/60 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-tertiary text-on-tertiary flex items-center justify-center shrink-0 mt-0.5">
                  <AlertTriangle className="w-5 h-5" aria-hidden="true" />
                </div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-headline font-bold text-sm text-ai-sunlit-text">
                      Đến hạn Ôn tập Củng cố Trí nhớ
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-tertiary/15 text-tertiary text-[10px] font-bold">
                      {summaryCounts.reviewNodes.length} chủ đề
                    </span>
                  </div>
                  <p className="text-xs text-on-surface leading-relaxed max-w-3xl">
                    Chủ đề{' '}
                    <strong className="text-ai-sunlit-text">
                      {summaryCounts.reviewNodes[0].title}
                    </strong>{' '}
                    có độ bền ghi nhớ còn{' '}
                    <strong className="font-mono">
                      {Math.round(summaryCounts.reviewNodes[0].retention_ebbinghaus * 100)}%
                    </strong>
                    . Hãy dành 3 phút ôn tập nhanh để củng cố kiến thức trước khi học tiếp.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onStartReview(domainSlug, summaryCounts.reviewNodes[0].slug)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-tertiary text-on-tertiary hover:bg-tertiary-dim text-xs font-bold shadow-sm transition-colors shrink-0 cursor-pointer"
              >
                <span>Ôn tập ngay</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          )}

          {/* Sunlit Amber AI Learning Recommendation Banner */}
          {rec && (
            <RoadmapRecommendationBanner
              domainSlug={domainSlug}
              rec={rec}
              recommendedNode={recommendedNode}
              onCtaRecommended={handleCtaRecommended}
              onOpenPlaybook={onOpenPlaybook}
            />
          )}

          {/* Completed Domain Banner */}
          {rec?.status === 'completed' && (
            <div className="rounded-2xl border border-primary/35 bg-primary-container/40 p-5 flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-primary shrink-0" aria-hidden="true" />
              <div>
                <h2 className="text-sm font-headline font-extrabold text-on-primary-container">
                  Chúc mừng! Bạn đã hoàn thành Lộ trình {roadmap.domain_title}
                </h2>
                <p className="text-xs text-on-surface-variant">
                  Tất cả các chủ đề đều đã đạt chuẩn Hiểu bản chất trở lên và đang trong vùng ghi nhớ tốt.
                </p>
              </div>
            </div>
          )}

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl shadow-sm border border-outline-variant/50">
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              Danh sách Chủ đề ({filteredNodes.length} / {roadmap.nodes.length})
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                  filterMode === 'all'
                    ? 'bg-primary text-on-primary shadow-xs'
                    : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
                }`}
              >
                Tất cả ({roadmap.nodes.length})
              </button>
              {recommendedSlug && (
                <button
                  type="button"
                  onClick={() => setFilterMode('recommended')}
                  className={`inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                    filterMode === 'recommended'
                      ? 'bg-tertiary text-on-tertiary shadow-xs'
                      : 'bg-ai-sunlit-bg text-ai-sunlit-text border border-ai-sunlit-border/40 hover:bg-tertiary-container'
                  }`}
                >
                  <Compass className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>AI Đề xuất (1)</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setFilterMode('review')}
                className={`inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                  filterMode === 'review'
                    ? 'bg-tertiary text-on-tertiary shadow-xs'
                    : 'bg-surface-container-low text-tertiary hover:bg-surface-container'
                }`}
              >
                <History className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Cần ôn tập ({summaryCounts.reviewNodes.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('shared')}
                className={`inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                  filterMode === 'shared'
                    ? 'bg-shared-text text-white shadow-xs'
                    : 'bg-shared-bg text-shared-text border border-shared-border/50 hover:opacity-90'
                }`}
              >
                <GitMerge className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Liên thông ({summaryCounts.shared})</span>
              </button>
            </div>
          </div>

          {/* Empty Filter State */}
          {groupedByTier.length === 0 && (
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-outline-variant/50 text-center space-y-2.5">
              <p className="text-sm font-bold text-on-surface">
                Không có chủ đề nào phù hợp với bộ lọc hiện tại.
              </p>
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className="px-4 py-2 rounded-xl bg-surface-container text-xs font-bold text-primary cursor-pointer"
              >
                Hiển thị tất cả chủ đề
              </button>
            </div>
          )}

          {/* 4-Tier Knowledge Graph */}
          <div className="space-y-6 pt-1">
            {groupedByTier.map(([tier, tierNodes], idx) => {
              const tierInfo = TIER_TITLES[tier] ?? {
                title: `Tầng ${tier}`,
                subtitle: 'Chuyên sâu',
              }
              const reviewInTier = tierNodes.filter((n) => n.needs_review).length
              const lockedInTier = tierNodes.filter((n) => !n.is_eligible).length
              return (
                <div key={tier} className="space-y-3">
                  {idx > 0 && (
                    <div className="flex items-center justify-center -my-1 opacity-55" aria-hidden="true">
                      <svg className="w-56 h-7 text-outline-variant" fill="none" viewBox="0 0 256 32">
                        <path
                          d="M64 0V16C64 24 96 32 128 32C160 32 192 24 192 16V0"
                          stroke="currentColor"
                          strokeDasharray="4 4"
                          strokeWidth="1.5"
                        />
                        <path
                          d="M128 16V32M124 28L128 32L132 28"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        />
                      </svg>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-xs ${
                          tier === 1
                            ? 'bg-primary-container text-on-primary-container'
                            : 'bg-surface-container-high text-on-surface'
                        }`}
                      >
                        T{tier}
                      </span>
                      <h2 className="font-headline font-extrabold text-sm sm:text-base text-on-surface">
                        {tierInfo.title}
                      </h2>
                      <span className="text-xs text-on-surface-variant font-medium">
                        • {tierInfo.subtitle} ({tierNodes.length} chủ đề)
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      {reviewInTier > 0 && (
                        <span className="text-tertiary font-semibold inline-flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-tertiary" />
                          {reviewInTier} chủ đề cần ôn tập
                        </span>
                      )}
                      {lockedInTier === 0 && reviewInTier === 0 && (
                        <span className="hidden sm:inline-flex items-center gap-1 text-primary font-semibold">
                          <Check className="w-3.5 h-3.5" aria-hidden="true" />
                          Đã mở khóa toàn bộ
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {tierNodes.map((node) => (
                      <MultiDomainKgNodeCard
                        key={node.slug}
                        node={node}
                        isRecommended={node.slug === recommendedSlug}
                        onOpenPlaybook={(n) => onOpenPlaybook(domainSlug, n)}
                        onStartDepthProbe={(slug) => onStartDepthProbe(domainSlug, slug)}
                        onStartCodeSandbox={(slug) => onStartCodeSandbox(domainSlug, slug)}
                        onStartReview={(slug) => onStartReview(domainSlug, slug)}
                        onFocusPrerequisite={handleFocusPrerequisite}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </section>
  )
}
