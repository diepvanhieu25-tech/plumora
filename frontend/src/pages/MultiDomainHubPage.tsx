import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Check,
  Clock,
  Compass,
  GitMerge,
  Layers,
  Play,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react'
import { apiGetDomains } from '../api'
import type { DomainListItem } from '../types'

interface MultiDomainHubPageProps {
  onSelectDomainRoadmap: (domainSlug: string) => void
  onStartPlacement: (domainSlug: string) => void
}

type DomainFilter = 'all' | 'active' | 'shared'
type DomainSort = 'default' | 'progress' | 'review'

function getDomainVisualTheme(slug: string): {
  gradient: string
  dagCode: string
  accentLabel: string
} {
  if (slug === 'backend') {
    return {
      gradient: 'from-[#064e2b] via-[#0c5e3a] to-[#0c261b]',
      dagCode: 'DAG: BE-01',
      accentLabel: 'Backend Engineering',
    }
  }
  if (slug === 'frontend') {
    return {
      gradient: 'from-[#005c54] via-[#0b6f66] to-[#0a2b29]',
      dagCode: 'DAG: FE-02',
      accentLabel: 'Frontend Engineering',
    }
  }
  if (slug === 'devops') {
    return {
      gradient: 'from-[#1e3a2f] via-[#2c5241] to-[#11201a]',
      dagCode: 'DAG: DO-03',
      accentLabel: 'DevOps & SRE',
    }
  }
  return {
    gradient: 'from-[#164e35] via-[#1c6443] to-[#0d261a]',
    dagCode: `DAG: ${slug.slice(0, 4).toUpperCase()}`,
    accentLabel: slug,
  }
}

export function MultiDomainHubPage({
  onSelectDomainRoadmap,
  onStartPlacement,
}: MultiDomainHubPageProps) {
  const [domains, setDomains] = useState<DomainListItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filterMode, setFilterMode] = useState<DomainFilter>('all')
  const [sortMode, setSortMode] = useState<DomainSort>('default')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadDomains() {
    setLoading(true)
    setError(null)
    try {
      const data = await apiGetDomains()
      setDomains(data.domains)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải danh sách lĩnh vực')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadDomains()
  }, [])

  const stats = useMemo(() => {
    let totalNodes = 0
    let mastery = 0
    let deep = 0
    let applied = 0
    let surface = 0
    let needsReview = 0
    let activeDomains = 0
    let sharedDomains = 0
    let maxShared = 0

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
      if (d.shared_nodes_count > maxShared) maxShared = d.shared_nodes_count
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
      maxShared,
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
      ? 'Mặc định GNN-PPO'
      : sortMode === 'progress'
        ? 'Tiến độ Deep/Mastery'
        : 'Ưu tiên Ôn tập R(t)'

  const barBase = Math.max(1, stats.totalLearned)
  const masteryBarPct = stats.totalLearned > 0 ? (stats.mastery / barBase) * 100 : 0
  const deepBarPct = stats.totalLearned > 0 ? (stats.deep / barBase) * 100 : 0
  const appliedBarPct = stats.totalLearned > 0 ? (stats.applied / barBase) * 100 : 0
  const surfaceBarPct = stats.totalLearned > 0 ? (stats.surface / barBase) * 100 : 0

  return (
    <section className="w-full space-y-6 pb-8" data-testid="scr09-multi-domain-hub">
      {/* 1. Top Utility & Metadata Sub-bar */}
      <div className="w-full bg-surface-container-lowest rounded-xl shadow-sm py-3 px-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-2 text-on-surface-variant font-label flex-wrap"
          >
            <span>Trang chủ</span>
            <span className="text-outline-variant">/</span>
            <span>Trung tâm Lĩnh vực</span>
            <span className="text-outline-variant">/</span>
            <span className="font-semibold text-on-surface">Hồ sơ Năng lực Liên thông</span>
          </nav>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary-container/40 text-on-secondary-container text-[11px] font-medium">
              <Sparkles className="w-3.5 h-3.5 text-secondary shrink-0" aria-hidden="true" />
              <span>Đồng bộ kiến thức liên ngành: Đang bật</span>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-high text-on-surface text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span className="text-primary font-semibold">
                {stats.totalLearned}/{stats.totalNodes} Chủ đề
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Title & Executive Context */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider font-label">
            <Compass className="w-3.5 h-3.5" aria-hidden="true" />
            Lộ trình Học tập Đa lĩnh vực
          </div>
          <h1 className="text-2xl sm:text-3xl font-headline font-bold text-on-surface tracking-tight">
            Hồ sơ Năng lực &amp; Lộ trình Chuyên môn
          </h1>
          <p className="text-sm text-on-surface-variant max-w-3xl leading-relaxed">
            Động cơ tri thức Graph Neural Network liên tục đồng bộ mức hiểu và độ bền trí nhớ giữa
            các lĩnh vực, giúp tái sử dụng kiến thức nền tảng khi chuyển đổi chuyên ngành.
          </p>
        </div>

        <div className="bg-surface-container-low px-3.5 py-2 rounded-lg text-xs font-mono text-on-surface-variant flex items-center gap-2 self-start lg:self-auto shadow-sm">
          <Check className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
          <span>
            Active Graphs:{' '}
            <code className="text-on-surface font-semibold">{domains.length} DAGs</code>
          </span>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-5 h-52 rounded-xl bg-surface-container-lowest shadow-sm animate-pulse" />
            <div className="lg:col-span-4 h-52 rounded-xl bg-surface-container-lowest shadow-sm animate-pulse" />
            <div className="lg:col-span-3 h-52 rounded-xl bg-surface-container-lowest shadow-sm animate-pulse" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {[0, 1, 2].map((idx) => (
              <div
                key={idx}
                className="h-96 rounded-xl bg-surface-container-lowest shadow-sm animate-pulse"
              />
            ))}
          </div>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div
          role="alert"
          className="rounded-xl border border-tertiary/40 bg-tertiary-fixed/15 p-5 flex flex-wrap items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3 text-sm text-on-tertiary-container font-medium">
            <AlertTriangle className="w-5 h-5 text-tertiary shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadDomains()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-surface-container-lowest border border-tertiary/40 text-tertiary hover:bg-surface-container cursor-pointer transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            Thử lại
          </button>
        </div>
      )}

      {/* Main Loaded Content */}
      {!loading && !error && (
        <>
          {/* 2. Hero Competency Summary Strip (3 Cards Grid) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Card 1: 4-Tier Depth Profile */}
            <div className="lg:col-span-5 bg-surface-container-lowest rounded-xl p-5 shadow-sm flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Layers className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <h2 className="text-sm font-headline font-bold text-on-surface">
                      Hồ sơ Năng lực 4 Bậc Chiều sâu
                    </h2>
                  </div>
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-surface-container text-primary shrink-0">
                    {stats.totalLearned}/{stats.totalNodes} Nodes
                  </span>
                </div>

                {/* Horizontal Stacked Bar */}
                <div className="mt-4 space-y-2">
                  <div className="w-full h-3 rounded-full overflow-hidden flex bg-surface-container-high">
                    {stats.mastery > 0 && (
                      <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${masteryBarPct}%` }}
                        title={`Mastery: ${stats.mastery} nodes`}
                      />
                    )}
                    {stats.deep > 0 && (
                      <div
                        className="h-full bg-primary-fixed-dim transition-all duration-300"
                        style={{ width: `${deepBarPct}%` }}
                        title={`Deep: ${stats.deep} nodes`}
                      />
                    )}
                    {stats.applied > 0 && (
                      <div
                        className="h-full bg-secondary transition-all duration-300"
                        style={{ width: `${appliedBarPct}%` }}
                        title={`Applied: ${stats.applied} nodes`}
                      />
                    )}
                    {stats.surface > 0 && (
                      <div
                        className="h-full bg-outline transition-all duration-300"
                        style={{ width: `${surfaceBarPct}%` }}
                        title={`Surface: ${stats.surface} nodes`}
                      />
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-on-surface-variant font-mono">
                    <span>
                      Đã kích hoạt đánh giá: <strong>{stats.learnedPct}%</strong>
                    </span>
                    <span>{stats.totalUnactivated} nodes chưa kích hoạt</span>
                  </div>
                </div>
              </div>

              {/* 4 Tiers Legend */}
              <div className="grid grid-cols-2 gap-2.5 pt-2 text-xs">
                <div className="p-2.5 rounded-lg bg-surface-container-low flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-medium text-on-surface">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                    Mastery 100%
                  </span>
                  <span className="font-mono font-bold text-primary">{stats.mastery}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-surface-container-low flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-medium text-on-surface">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary-fixed-dim" />
                    Deep 75%
                  </span>
                  <span className="font-mono font-bold text-on-surface">{stats.deep}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-surface-container-low flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-medium text-on-surface">
                    <span className="w-2.5 h-2.5 rounded-full bg-secondary" />
                    Applied 50%
                  </span>
                  <span className="font-mono font-bold text-secondary">{stats.applied}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-surface-container-low flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-medium text-on-surface">
                    <span className="w-2.5 h-2.5 rounded-full bg-outline" />
                    Surface 25%
                  </span>
                  <span className="font-mono font-bold text-on-surface-variant">
                    {stats.surface}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: Cross-Domain GNN Transfer */}
            <div className="lg:col-span-4 bg-surface-container-lowest rounded-xl p-5 shadow-sm flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-secondary-container/50 text-secondary flex items-center justify-center shrink-0">
                      <GitMerge className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <h2 className="text-sm font-headline font-bold text-on-surface">
                      Liên thông Tri thức GNN
                    </h2>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-secondary-container text-on-secondary-container shrink-0">
                    <Check className="w-3 h-3" aria-hidden="true" />
                    Auto-Sync
                  </span>
                </div>

                <div className="mt-3">
                  <div className="text-xs font-semibold text-on-surface flex items-center gap-1.5">
                    <span className="text-secondary font-bold text-base font-mono">
                      {stats.sharedDomains}
                    </span>
                    <span>Lĩnh vực có Khái niệm Giao thoa đồng bộ</span>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                    Trọng số hiểu biết của các khái niệm dùng chung được đồng bộ tự động trên toàn
                    đồ thị tri thức:
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5 mt-3">
                  {domains.map((d) => (
                    <span
                      key={d.slug}
                      className="px-2.5 py-1 rounded bg-surface-container font-mono text-[11px] text-on-surface font-medium"
                    >
                      {d.slug}: {d.shared_nodes_count} giao thoa
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-surface-container-low text-xs text-on-surface-variant flex items-start gap-2">
                <Clock className="w-4 h-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                <span className="leading-normal">
                  Tối đa <strong className="text-primary font-semibold">{stats.maxShared} node</strong>{' '}
                  giao thoa/lĩnh vực được kế thừa tức thì không cần học lại từ đầu.
                </span>
              </div>
            </div>

            {/* Card 3: Ebbinghaus R(t) Memory Retention Guard */}
            <div className="lg:col-span-3 bg-surface-container-lowest rounded-xl p-5 shadow-sm flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-tertiary-container/30 text-tertiary flex items-center justify-center shrink-0">
                      <Clock className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <h2 className="text-sm font-headline font-bold text-on-surface">
                      Trí nhớ Ebbinghaus R(t)
                    </h2>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold shrink-0 ${
                      stats.needsReview > 0
                        ? 'bg-tertiary-container/40 text-on-tertiary-container'
                        : 'bg-primary-container/60 text-on-primary-container'
                    }`}
                  >
                    {stats.needsReview > 0 ? 'Cảnh báo' : 'Ổn định'}
                  </span>
                </div>

                <div className="mt-3">
                  <div className="text-xs font-semibold text-on-surface">
                    <span className="text-tertiary font-bold text-base font-mono">
                      {stats.needsReview}
                    </span>{' '}
                    khái niệm có <span className="font-mono text-tertiary">R(t) &lt; 60%</span>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">
                    {stats.needsReview > 0
                      ? 'Cần củng cố phản xạ trước khi đường cong trí nhớ suy giảm thêm.'
                      : 'Tất cả khái niệm đã đánh giá hiện đều nằm trong vùng nhớ an toàn.'}
                  </p>
                </div>

                {stats.reviewDomains.length > 0 && (
                  <div className="space-y-2 mt-3 text-xs font-mono">
                    {stats.reviewDomains.slice(0, 2).map((rd) => (
                      <div
                        key={rd.slug}
                        className="p-2 rounded bg-surface-container-low flex items-center justify-between gap-2"
                      >
                        <span className="font-semibold text-on-surface truncate">{rd.slug}</span>
                        <span className="px-2 py-0.5 rounded bg-tertiary-container/30 text-on-tertiary-container font-bold text-[11px] shrink-0">
                          {rd.user_summary.needs_review_count} cần ôn
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
                  className="w-full py-2.5 px-3 rounded-lg bg-primary hover:bg-primary-dim text-on-primary text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Ôn tập ngay ({stats.needsReview} Khái niệm)</span>
                </button>
              ) : (
                <div className="w-full py-2 px-3 rounded-lg bg-surface-container-low text-on-surface-variant text-xs font-medium text-center">
                  Chưa có khái niệm đến hạn ôn tập
                </div>
              )}
            </div>
          </div>

          {/* 3. Domain Filter & Search Bar Strip */}
          <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-80">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-on-surface-variant">
                <Search className="w-4 h-4" aria-hidden="true" />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Tìm lĩnh vực"
                placeholder="Tìm lĩnh vực theo tên hoặc mã..."
                className="w-full pl-9 pr-4 py-2 bg-surface-container-low text-on-surface placeholder:text-on-surface-variant/70 text-xs rounded-lg focus:outline-none focus:bg-surface-container transition-all"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto py-1 text-xs">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`px-3.5 py-1.5 rounded-full font-semibold transition-colors shrink-0 cursor-pointer ${
                  filterMode === 'all'
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'bg-surface-container-low hover:bg-surface-container text-on-surface font-medium'
                }`}
              >
                Tất cả Lĩnh vực ({domains.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('active')}
                className={`px-3.5 py-1.5 rounded-full font-semibold transition-colors shrink-0 cursor-pointer ${
                  filterMode === 'active'
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'bg-surface-container-low hover:bg-surface-container text-on-surface font-medium'
                }`}
              >
                Đang học ({stats.activeDomains})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('shared')}
                className={`px-3.5 py-1.5 rounded-full font-semibold transition-colors shrink-0 cursor-pointer ${
                  filterMode === 'shared'
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'bg-surface-container-low hover:bg-surface-container text-on-surface font-medium'
                }`}
              >
                Có Node Giao thoa ({stats.sharedDomains})
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs text-on-surface-variant shrink-0 w-full md:w-auto justify-end">
              <SlidersHorizontal className="w-4 h-4 text-on-surface-variant" aria-hidden="true" />
              <span>Sắp xếp:</span>
              <button
                type="button"
                onClick={cycleSortMode}
                className="font-semibold text-on-surface flex items-center gap-1 hover:text-primary transition-colors cursor-pointer"
              >
                {sortLabel}
              </button>
            </div>
          </div>

          {/* Empty Filter State */}
          {visibleDomains.length === 0 && (
            <div className="bg-surface-container-lowest rounded-xl p-8 shadow-sm text-center space-y-3">
              <p className="text-sm font-bold text-on-surface">
                Không tìm thấy lĩnh vực nào khớp điều kiện lọc hiện tại.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  setFilterMode('all')
                }}
                className="px-4 py-2 rounded-lg bg-surface-container text-xs font-semibold text-primary hover:bg-surface-container-high cursor-pointer"
              >
                Xóa bộ lọc
              </button>
            </div>
          )}

          {/* 4. Main Domain Cards Grid */}
          {visibleDomains.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {visibleDomains.map((d) => {
                const s = d.user_summary
                const learnedCount =
                  s.surface_count + s.applied_count + s.deep_count + s.mastery_count
                const deepAndMastery = s.deep_count + s.mastery_count
                const deepPct =
                  d.total_nodes > 0 ? Math.round((deepAndMastery / d.total_nodes) * 100) : 0
                const masteryW = d.total_nodes > 0 ? (s.mastery_count / d.total_nodes) * 100 : 0
                const deepW = d.total_nodes > 0 ? (s.deep_count / d.total_nodes) * 100 : 0
                const appliedW = d.total_nodes > 0 ? (s.applied_count / d.total_nodes) * 100 : 0
                const theme = getDomainVisualTheme(d.slug)

                return (
                  <article
                    key={d.slug}
                    data-testid={`domain-card-${d.slug}`}
                    className="bg-surface-container-lowest rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between overflow-hidden border border-outline-variant/20"
                  >
                    <div>
                      {/* Card Header Visual Banner */}
                      <div
                        className={`relative h-44 w-full bg-gradient-to-br ${theme.gradient} overflow-hidden`}
                      >
                        {/* Subtle Botanical Graph Pattern SVG */}
                        <svg
                          className="absolute inset-0 w-full h-full opacity-15 pointer-events-none"
                          viewBox="0 0 360 176"
                          fill="none"
                          aria-hidden="true"
                        >
                          <circle cx="64" cy="48" r="28" stroke="#95f8a7" strokeWidth="1.5" />
                          <circle cx="192" cy="72" r="44" stroke="#89f5e7" strokeWidth="1.5" />
                          <circle cx="304" cy="42" r="22" stroke="#95f8a7" strokeWidth="1.5" />
                          <path
                            d="M88 58 L152 68 M232 62 L284 48 M192 116 L120 150 M220 108 L296 144"
                            stroke="#e9ffe7"
                            strokeWidth="1.2"
                            strokeDasharray="4 4"
                          />
                        </svg>
                        <div className="absolute inset-0 bg-gradient-to-t from-inverse-surface/85 via-inverse-surface/25 to-transparent" />

                        {/* Domain Top Badges */}
                        <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between gap-2">
                          {learnedCount > 0 ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary-container text-on-primary-container text-[11px] font-bold tracking-wide uppercase font-label">
                              <span className="w-2 h-2 rounded-full bg-primary" />
                              Đang học
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary-container text-on-secondary-container text-[11px] font-bold tracking-wide uppercase font-label">
                              <GitMerge className="w-3.5 h-3.5" aria-hidden="true" />
                              Liên thông GNN
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded bg-surface-container-lowest/90 backdrop-blur-sm text-[11px] font-mono font-semibold text-on-surface">
                            {theme.dagCode} • v{d.graph_version}
                          </span>
                        </div>

                        {/* Header Title in Scrim */}
                        <div className="absolute bottom-3 left-3.5 right-3.5 text-surface">
                          <h2 className="font-headline font-bold text-lg leading-tight text-surface-bright">
                            {d.title}
                          </h2>
                          <p className="text-xs text-surface-variant font-mono mt-0.5">
                            {theme.accentLabel} • {d.total_nodes} Khái niệm • 4 Tầng DAG
                          </p>
                        </div>
                      </div>

                      {/* Body Content */}
                      <div className="p-5 space-y-4">
                        <p className="text-xs text-on-surface-variant leading-relaxed">
                          {d.description}
                        </p>

                        {/* Progress Section */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-on-surface">
                              Tiến độ chiều sâu (Deep/Mastery)
                            </span>
                            <span className="font-mono font-bold text-primary">
                              {deepAndMastery}/{d.total_nodes} ({deepPct}%)
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-surface-container-high overflow-hidden flex">
                            {masteryW > 0 && (
                              <div
                                className="h-full bg-primary"
                                style={{ width: `${masteryW}%` }}
                                title={`${s.mastery_count} Mastery`}
                              />
                            )}
                            {deepW > 0 && (
                              <div
                                className="h-full bg-primary-fixed-dim"
                                style={{ width: `${deepW}%` }}
                                title={`${s.deep_count} Deep`}
                              />
                            )}
                            {appliedW > 0 && (
                              <div
                                className="h-full bg-secondary"
                                style={{ width: `${appliedW}%` }}
                                title={`${s.applied_count} Applied`}
                              />
                            )}
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-on-surface-variant font-mono">
                            <span>{s.mastery_count} Mastery</span>
                            <span>{s.deep_count} Deep</span>
                            <span>{s.applied_count} Applied</span>
                            <span>{s.surface_count} Surface</span>
                          </div>
                        </div>

                        {/* Cross-Domain & Evaluated Summary */}
                        <div className="p-3 rounded-lg bg-surface-container-low space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-on-surface inline-flex items-center gap-1.5">
                              <GitMerge className="w-3.5 h-3.5 text-secondary" aria-hidden="true" />
                              Khái niệm giao thoa
                            </span>
                            <span className="font-mono font-bold text-secondary">
                              {d.shared_nodes_count}/{d.total_nodes} nodes
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-on-surface-variant font-mono">
                            <span>Đã đánh giá:</span>
                            <span className="font-semibold text-on-surface">
                              {learnedCount}/{d.total_nodes} khái niệm
                            </span>
                          </div>
                        </div>

                        {learnedCount === 0 && (
                          <div className="p-2.5 rounded-lg bg-surface-container text-[11px] font-medium text-on-surface-variant">
                            0% — Sẵn sàng Chẩn đoán đầu vào để định vị tầng xuất phát
                          </div>
                        )}

                        {s.needs_review_count > 0 && (
                          <div className="p-2.5 rounded-lg bg-tertiary-container/15 text-xs font-semibold text-on-tertiary-container flex items-center gap-2">
                            <Clock className="w-4 h-4 text-tertiary shrink-0" aria-hidden="true" />
                            <span>{s.needs_review_count} khái niệm cần ôn tập Ebbinghaus</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer Action Buttons (Last button MUST remain Adaptive Placement for E2E) */}
                    <div className="p-5 pt-0 space-y-2">
                      <button
                        type="button"
                        onClick={() => onSelectDomainRoadmap(d.slug)}
                        className="w-full py-2.5 px-4 rounded-lg bg-primary hover:bg-primary-dim text-on-primary text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
                      >
                        <span>Vào Bản đồ Lĩnh vực</span>
                        <ArrowRight className="w-4 h-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onStartPlacement(d.slug)}
                        className="w-full py-2 px-3 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Activity className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                        <span>
                          {s.placement_completed
                            ? 'Làm lại Chẩn đoán Đầu vào'
                            : 'Chẩn đoán Đầu vào (Adaptive Placement)'}
                        </span>
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}

          {/* 5. Bottom Architectural Insight Strip */}
          <div className="bg-surface-container-low rounded-xl p-5 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                  <GitMerge className="w-5 h-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-sm font-headline font-bold text-on-surface">
                    Cơ chế Giao thoa Đồ thị Tri thức (GNN Transfer Learning)
                  </h3>
                  <p className="text-xs text-on-surface-variant mt-0.5 max-w-2xl leading-relaxed">
                    Khi bạn nâng bậc hiểu biết hoặc ôn tập ở một lĩnh vực, hồ sơ năng lực và độ bền
                    trí nhớ Ebbinghaus của các khái niệm giao thoa sẽ tự động đồng bộ sang mọi lĩnh
                    vực liên quan.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono shrink-0">
                <div className="p-2.5 rounded-lg bg-surface-container-lowest text-on-surface">
                  <span className="text-on-surface-variant block text-[10px]">Tổng lĩnh vực:</span>
                  <strong className="text-primary font-bold">{domains.length} DAGs</strong>
                </div>
                <div className="p-2.5 rounded-lg bg-surface-container-lowest text-on-surface">
                  <span className="text-on-surface-variant block text-[10px]">Tổng khái niệm:</span>
                  <strong className="text-secondary font-bold">{stats.totalNodes} Nodes</strong>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
