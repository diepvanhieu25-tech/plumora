import { useMemo, useState } from 'react'
import {
  Clock,
  Compass,
  GitMerge,
  Layers,
  Play,
  Search,
  SlidersHorizontal,
} from 'lucide-react'
import { apiGetDomains } from '../../api'
import { DomainHubCard } from '../../components/learner/DomainHubCard'
import { PageContextBar } from '../../components/ui/PageContextBar'
import { StatusAlertBanner } from '../../components/ui/StatusAlertBanner'
import { useAsyncQuery } from '../../hooks/useAsyncQuery'
import type { DomainListItem } from '../../types'

interface MultiDomainHubPageProps {
  onSelectDomainRoadmap: (domainSlug: string) => void
  onStartPlacement: (domainSlug: string) => void
}

type DomainFilter = 'all' | 'active' | 'shared'
type DomainSort = 'default' | 'progress' | 'review'

export function MultiDomainHubPage({
  onSelectDomainRoadmap,
  onStartPlacement,
}: MultiDomainHubPageProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterMode, setFilterMode] = useState<DomainFilter>('all')
  const [sortMode, setSortMode] = useState<DomainSort>('default')

  const { data, loading, errorMessage, refetch } = useAsyncQuery(
    (signal) => apiGetDomains(signal),
    [],
  )
  const domains: DomainListItem[] = useMemo(() => data?.domains ?? [], [data])

  const stats = useMemo(() => {
    let totalNodes = 0
    let mastery = 0
    let deep = 0
    let applied = 0
    let surface = 0
    let needsReview = 0
    let activeDomains = 0
    let sharedDomains = 0

    for (const d of domains) {
      const s = d.user_summary
      totalNodes += d.total_nodes
      mastery += s.mastery_count
      deep += s.deep_count
      applied += s.applied_count
      surface += s.surface_count
      needsReview += s.needs_review_count
      const learned = s.surface_count + s.applied_count + s.deep_count + s.mastery_count
      if (learned > 0) activeDomains += 1
      if (d.shared_nodes_count > 0) sharedDomains += 1
    }

    const totalLearned = mastery + deep + applied + surface
    const totalUnactivated = Math.max(0, totalNodes - totalLearned)
    const learnedPct = totalNodes > 0 ? Math.round((totalLearned / totalNodes) * 100) : 0
    const reviewDomains = domains.filter((d) => d.user_summary.needs_review_count > 0)

    return {
      totalNodes,
      totalLearned,
      totalUnactivated,
      learnedPct,
      mastery,
      deep,
      applied,
      surface,
      needsReview,
      activeDomains,
      sharedDomains,
      reviewDomains,
    }
  }, [domains])

  const visibleDomains = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const filtered = domains.filter((d) => {
      const s = d.user_summary
      const learned = s.surface_count + s.applied_count + s.deep_count + s.mastery_count
      if (filterMode === 'active' && learned === 0) return false
      if (filterMode === 'shared' && d.shared_nodes_count === 0) return false
      if (!q) return true
      return (
        d.title.toLowerCase().includes(q) ||
        d.slug.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q)
      )
    })

    if (sortMode === 'progress') {
      return [...filtered].sort((a, b) => {
        const aRatio =
          a.total_nodes > 0
            ? (a.user_summary.deep_count + a.user_summary.mastery_count) / a.total_nodes
            : 0
        const bRatio =
          b.total_nodes > 0
            ? (b.user_summary.deep_count + b.user_summary.mastery_count) / b.total_nodes
            : 0
        return bRatio - aRatio
      })
    }
    if (sortMode === 'review') {
      return [...filtered].sort(
        (a, b) => b.user_summary.needs_review_count - a.user_summary.needs_review_count,
      )
    }
    return filtered
  }, [domains, searchQuery, filterMode, sortMode])

  function cycleSortMode() {
    setSortMode((prev) =>
      prev === 'default' ? 'progress' : prev === 'progress' ? 'review' : 'default',
    )
  }

  const sortLabel =
    sortMode === 'default'
      ? 'Mặc định'
      : sortMode === 'progress'
        ? 'Tiến độ cao nhất'
        : 'Ưu tiên cần ôn tập'

  const barBase = Math.max(1, stats.totalLearned)
  const masteryBarPct = stats.totalLearned > 0 ? (stats.mastery / barBase) * 100 : 0
  const deepBarPct = stats.totalLearned > 0 ? (stats.deep / barBase) * 100 : 0
  const appliedBarPct = stats.totalLearned > 0 ? (stats.applied / barBase) * 100 : 0
  const surfaceBarPct = stats.totalLearned > 0 ? (stats.surface / barBase) * 100 : 0

  return (
    <section className="w-full space-y-6 pb-8" data-testid="scr09-multi-domain-hub">
      <PageContextBar
        breadcrumbs={[
          { label: 'Trang chủ' },
          { label: 'Trung tâm Chuyên ngành', isCurrent: true },
        ]}
        rightSlot={
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-container/60 text-on-primary-container text-xs font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            <span>
              Đã học {stats.totalLearned}/{stats.totalNodes} chủ đề
            </span>
          </div>
        }
      />

      {/* Title & Context */}
      <div className="space-y-1.5">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary-container text-on-primary-container text-xs font-bold">
          <Compass className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Lộ trình Học tập Đa chuyên ngành</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-headline font-extrabold text-on-surface tracking-tight">
          Hồ sơ Năng lực &amp; Lộ trình của Bạn
        </h1>
        <p className="text-sm text-on-surface-variant max-w-3xl leading-relaxed">
          Chọn chuyên ngành bạn muốn chinh phục. Các kiến thức nền tảng dùng chung sẽ tự động được kế thừa khi bạn chuyển sang chuyên ngành mới.
        </p>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-5 h-48 rounded-2xl bg-white border border-outline-variant/40 animate-pulse" />
            <div className="lg:col-span-4 h-48 rounded-2xl bg-white border border-outline-variant/40 animate-pulse" />
            <div className="lg:col-span-3 h-48 rounded-2xl bg-white border border-outline-variant/40 animate-pulse" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {[0, 1, 2].map((idx) => (
              <div
                key={idx}
                className="h-96 rounded-2xl bg-white border border-outline-variant/40 animate-pulse"
              />
            ))}
          </div>
        </div>
      )}

      {/* Error State */}
      {!loading && errorMessage && (
        <StatusAlertBanner variant="error" message={errorMessage} onRetry={refetch} />
      )}

      {/* Main Loaded Content */}
      {!loading && !errorMessage && (
        <>
          {/* Summary Strip */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Card 1: 4-Level Competency Overview */}
            <div className="lg:col-span-5 bg-white rounded-2xl p-5 shadow-sm border border-outline-variant/50 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary-container text-primary flex items-center justify-center shrink-0">
                      <Layers className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <h2 className="text-sm font-headline font-bold text-on-surface">
                      Tổng quan 4 Mức độ Nắm vững
                    </h2>
                  </div>
                  <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-surface-container text-primary shrink-0">
                    {stats.learnedPct}%
                  </span>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="w-full h-3 rounded-full overflow-hidden flex bg-surface-container-high">
                    {stats.mastery > 0 && (
                      <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${masteryBarPct}%` }}
                        title={`Làm chủ: ${stats.mastery} chủ đề`}
                      />
                    )}
                    {stats.deep > 0 && (
                      <div
                        className="h-full bg-primary-fixed-dim transition-all duration-300"
                        style={{ width: `${deepBarPct}%` }}
                        title={`Hiểu bản chất: ${stats.deep} chủ đề`}
                      />
                    )}
                    {stats.applied > 0 && (
                      <div
                        className="h-full bg-secondary transition-all duration-300"
                        style={{ width: `${appliedBarPct}%` }}
                        title={`Biết áp dụng: ${stats.applied} chủ đề`}
                      />
                    )}
                    {stats.surface > 0 && (
                      <div
                        className="h-full bg-outline transition-all duration-300"
                        style={{ width: `${surfaceBarPct}%` }}
                        title={`Nắm khái niệm: ${stats.surface} chủ đề`}
                      />
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-on-surface-variant">
                    <span>Đã học: {stats.totalLearned} chủ đề</span>
                    <span>Chưa bắt đầu: {stats.totalUnactivated} chủ đề</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-surface-container-low flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-medium text-on-surface">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                    Làm chủ (100%)
                  </span>
                  <span className="font-mono font-bold text-primary">{stats.mastery}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-surface-container-low flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-medium text-on-surface">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary-fixed-dim" />
                    Hiểu bản chất (75%)
                  </span>
                  <span className="font-mono font-bold text-on-surface">{stats.deep}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-surface-container-low flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-medium text-on-surface">
                    <span className="w-2.5 h-2.5 rounded-full bg-secondary" />
                    Biết áp dụng (50%)
                  </span>
                  <span className="font-mono font-bold text-secondary">{stats.applied}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-surface-container-low flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-medium text-on-surface">
                    <span className="w-2.5 h-2.5 rounded-full bg-outline" />
                    Khái niệm (25%)
                  </span>
                  <span className="font-mono font-bold text-on-surface-variant">{stats.surface}</span>
                </div>
              </div>
            </div>

            {/* Card 2: Cross-Domain Knowledge Sharing */}
            <div className="lg:col-span-4 bg-white rounded-2xl p-5 shadow-sm border border-outline-variant/50 flex flex-col justify-between space-y-4">
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-shared-bg text-shared-text border border-shared-border flex items-center justify-center shrink-0">
                    <GitMerge className="w-4 h-4" aria-hidden="true" />
                  </div>
                  <h2 className="text-sm font-headline font-bold text-on-surface">
                    Kiến thức Liên thông Chuyên ngành
                  </h2>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Các chủ đề nền tảng chung (như Mạng, HTTP/HTTPS, Bảo mật API) được đồng bộ tự động giữa{' '}
                  <strong className="text-on-surface">{stats.sharedDomains} chuyên ngành</strong> để bạn không phải học lặp lại.
                </p>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {domains.map((d) => (
                    <span
                      key={d.slug}
                      className="px-2.5 py-1 rounded-lg bg-shared-bg text-shared-text border border-shared-border/60 text-[11px] font-semibold"
                    >
                      {d.title}: {d.shared_nodes_count} chủ đề chung
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-surface-container-low text-xs text-on-surface-variant">
                Hoàn thành một chủ đề chung ở bất kỳ lộ trình nào sẽ tự động cập nhật tiến độ cho các chuyên ngành liên quan.
              </div>
            </div>

            {/* Card 3: Real-Time Review Schedule */}
            <div className="lg:col-span-3 bg-white rounded-2xl p-5 shadow-sm border border-outline-variant/50 flex flex-col justify-between space-y-4">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-ai-sunlit-bg text-tertiary border border-ai-sunlit-border/40 flex items-center justify-center shrink-0">
                      <Clock className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <h2 className="text-sm font-headline font-bold text-on-surface">
                      Lịch Ôn tập Hôm nay
                    </h2>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                      stats.needsReview > 0
                        ? 'bg-ai-sunlit-bg text-tertiary border border-ai-sunlit-border/40'
                        : 'bg-primary-container text-on-primary-container'
                    }`}
                  >
                    {stats.needsReview > 0 ? `${stats.needsReview} đến hạn` : 'Đang vững'}
                  </span>
                </div>

                <p className="text-xs text-on-surface-variant leading-relaxed">
                  {stats.needsReview > 0
                    ? `Bạn có ${stats.needsReview} chủ đề cần củng cố nhanh để duy trì trí nhớ dài hạn.`
                    : 'Tất cả chủ đề bạn đã học hiện đều đang trong vùng ghi nhớ an toàn.'}
                </p>

                {stats.reviewDomains.length > 0 && (
                  <div className="space-y-1.5 text-xs">
                    {stats.reviewDomains.slice(0, 2).map((rd) => (
                      <div
                        key={rd.slug}
                        className="px-3 py-2 rounded-lg bg-ai-sunlit-bg/70 border border-ai-sunlit-border/30 flex items-center justify-between gap-2"
                      >
                        <span className="font-semibold text-on-surface truncate">{rd.title}</span>
                        <span className="text-[11px] font-bold text-tertiary shrink-0">
                          {rd.user_summary.needs_review_count} bài
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {stats.reviewDomains.length > 0 ? (
                <button
                  type="button"
                  onClick={() => onSelectDomainRoadmap(stats.reviewDomains[0].slug)}
                  className="w-full py-2.5 px-3 rounded-xl bg-tertiary hover:bg-tertiary-dim text-on-tertiary text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Ôn tập ngay ({stats.needsReview} bài)</span>
                </button>
              ) : (
                <div className="w-full py-2 px-3 rounded-xl bg-surface-container-low text-on-surface-variant text-xs font-medium text-center">
                  Không có chủ đề quá hạn ôn tập
                </div>
              )}
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-outline-variant/50 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-80">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-outline">
                <Search className="w-4 h-4" aria-hidden="true" />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Tìm chuyên ngành"
                placeholder="Tìm chuyên ngành theo tên hoặc mô tả..."
                className="w-full pl-9 pr-4 py-2 bg-surface-container-low text-on-surface placeholder:text-outline/70 text-xs rounded-xl border border-transparent focus:border-primary focus:bg-white focus:outline-none transition-all"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto py-0.5 text-xs">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`px-3.5 py-1.5 rounded-full font-semibold transition-colors shrink-0 cursor-pointer ${
                  filterMode === 'all'
                    ? 'bg-primary text-on-primary shadow-xs'
                    : 'bg-surface-container-low hover:bg-surface-container text-on-surface'
                }`}
              >
                Tất cả ({domains.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('active')}
                className={`px-3.5 py-1.5 rounded-full font-semibold transition-colors shrink-0 cursor-pointer ${
                  filterMode === 'active'
                    ? 'bg-primary text-on-primary shadow-xs'
                    : 'bg-surface-container-low hover:bg-surface-container text-on-surface'
                }`}
              >
                Đang học ({stats.activeDomains})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('shared')}
                className={`px-3.5 py-1.5 rounded-full font-semibold transition-colors shrink-0 cursor-pointer ${
                  filterMode === 'shared'
                    ? 'bg-primary text-on-primary shadow-xs'
                    : 'bg-surface-container-low hover:bg-surface-container text-on-surface'
                }`}
              >
                Có kiến thức chung ({stats.sharedDomains})
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs text-on-surface-variant shrink-0 w-full md:w-auto justify-end">
              <SlidersHorizontal className="w-4 h-4 text-outline" aria-hidden="true" />
              <span>Sắp xếp:</span>
              <button
                type="button"
                onClick={cycleSortMode}
                className="font-bold text-primary hover:underline cursor-pointer"
              >
                {sortLabel}
              </button>
            </div>
          </div>

          {/* Empty Filter State */}
          {visibleDomains.length === 0 && (
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-outline-variant/50 text-center space-y-3">
              <p className="text-sm font-bold text-on-surface">
                Không tìm thấy chuyên ngành phù hợp với bộ lọc hiện tại.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  setFilterMode('all')
                }}
                className="px-4 py-2 rounded-xl bg-surface-container text-xs font-bold text-primary hover:bg-primary-container/50 cursor-pointer"
              >
                Hiển thị tất cả chuyên ngành
              </button>
            </div>
          )}

          {/* Domain Cards Grid */}
          {visibleDomains.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {visibleDomains.map((d) => (
                <DomainHubCard
                  key={d.slug}
                  domain={d}
                  onSelectDomainRoadmap={onSelectDomainRoadmap}
                  onStartPlacement={onStartPlacement}
                />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}
