import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Compass,
  Cpu,
  GitMerge,
  History,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react'
import { apiGetDomainRoadmap, apiGetV2Recommendation } from '../api'
import { MultiDomainKgNodeCard } from '../components/MultiDomainKgNodeCard'
import type { DomainRoadmapNode, DomainRoadmapResponse, V2RecommendationResponse } from '../types'

interface MultiDomainRoadmapPageProps {
  domainSlug: string
  onBackToHub: () => void
  onOpenPlaybook: (domainSlug: string, node: DomainRoadmapNode) => void
  onStartDepthProbe: (domainSlug: string, conceptSlug: string) => void
  onStartCodeSandbox: (domainSlug: string, conceptSlug: string) => void
  onStartReview: (domainSlug: string, conceptSlug: string) => void
}

const TIER_TITLES: Record<number, { title: string; subtitle: string }> = {
  1: { title: 'TẦNG 1: Nền tảng Giao tiếp & Hệ thống', subtitle: 'Foundations' },
  2: { title: 'TẦNG 2: Giao thức & Cấu trúc Dữ liệu Lưu trữ', subtitle: 'Protocols & Storage' },
  3: { title: 'TẦNG 3: Kiến trúc API & Tích hợp', subtitle: 'Architecture & Caching' },
  4: { title: 'TẦNG 4: Bảo mật & Vận hành Hệ thống', subtitle: 'Security & Production' },
}

const MODE_LABELS: Record<string, { title: string; desc: string }> = {
  Learn_New: {
    title: 'Học mới & Khám phá',
    desc: 'Khởi tạo nhận thức nền tảng và cơ chế hoạt động cốt lõi của khái niệm.',
  },
  Deep_Probe: {
    title: 'Đào sâu 5 Tầng (Tầng 1–5)',
    desc: 'Kiểm chứng hiểu biết bản chất, đánh đổi kiến trúc và xử lý tình huống thực tế.',
  },
  Code_Practice: {
    title: 'Thực hành Code Sandbox',
    desc: 'Sửa lỗi mã nguồn thực tế và vượt qua bộ Unit Test Cases trên Worker cô lập.',
  },
  Spaced_Review: {
    title: 'Ôn tập Ngắt quãng Ebbinghaus',
    desc: 'Củng cố khái niệm đang suy giảm trí nhớ R(t) < 60% để khôi phục độ bền.',
  },
}

export function MultiDomainRoadmapPage({
  domainSlug,
  onBackToHub,
  onOpenPlaybook,
  onStartDepthProbe,
  onStartCodeSandbox,
  onStartReview,
}: MultiDomainRoadmapPageProps) {
  const [roadmap, setRoadmap] = useState<DomainRoadmapResponse | null>(null)
  const [rec, setRec] = useState<V2RecommendationResponse | null>(null)
  const [filterMode, setFilterMode] = useState<'all' | 'recommended' | 'review' | 'shared'>('all')
  const [simDays, setSimDays] = useState<number>(0)
  const [showRlDetails, setShowRlDetails] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [rm, recData] = await Promise.all([
        apiGetDomainRoadmap(domainSlug, simDays),
        apiGetV2Recommendation(domainSlug),
      ])
      setRoadmap(rm)
      setRec(recData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải bản đồ lĩnh vực')
    } finally {
      setLoading(false)
    }
  }, [domainSlug, simDays])

  useEffect(() => {
    void loadData()
  }, [loadData])

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
    const map = new Map<number, typeof filteredNodes>()
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
    if (learning_mode === 'Code_Practice') {
      onStartCodeSandbox(domainSlug, concept_slug)
    } else if (learning_mode === 'Spaced_Review') {
      onStartReview(domainSlug, concept_slug)
    } else {
      onStartDepthProbe(domainSlug, concept_slug)
    }
  }

  return (
    <section className="w-full pb-8 space-y-6" data-testid="scr11-multi-domain-roadmap">
      {/* 1. Domain Context Bar & Micro-Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-2xl bg-surface-container-lowest shadow-sm">
        <div className="space-y-2 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs font-label text-on-surface-variant font-medium tracking-wide">
            <button
              type="button"
              onClick={onBackToHub}
              className="inline-flex items-center gap-1 text-primary font-bold hover:underline cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              Đổi lĩnh vực khác
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-outline-variant" aria-hidden="true" />
            <span>Bản đồ Knowledge Graph</span>
            <ChevronRight className="w-3.5 h-3.5 text-outline-variant" aria-hidden="true" />
            <span className="font-mono text-primary font-semibold">
              {domainSlug}-dag-v{roadmap?.graph_version ?? 1}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl bg-surface-container-low text-on-surface font-headline font-bold text-base">
              <span className="w-2.5 h-2.5 rounded-full bg-primary ring-4 ring-primary-container" />
              <h1>
                Lĩnh vực: {roadmap?.domain_title ?? domainSlug} ({roadmap?.nodes.length ?? 0} Nodes)
              </h1>
            </div>

            {roadmap && (
              <>
                <div className="h-4 w-px bg-surface-container-highest hidden sm:block" />
                <div className="flex flex-wrap items-center gap-3 text-xs font-label text-on-surface-variant">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-primary" />
                    {summaryCounts.mastery} Mastery
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-primary-fixed-dim" />
                    {summaryCounts.deep} Deep
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-secondary-fixed" />
                    {summaryCounts.applied} Applied
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-outline-variant" />
                    {summaryCounts.locked} Khóa
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-secondary-container/50 text-on-secondary-container font-mono text-[11px] font-semibold">
                    {summaryCounts.shared} Liên thông Đa miền
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Action Pill Group */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setSimDays((d) => (d === 0 ? 5 : 0))}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-label font-semibold transition-colors cursor-pointer ${
              simDays > 0
                ? 'bg-tertiary-container/30 text-on-tertiary-fixed font-bold shadow-sm'
                : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
            }`}
          >
            <Clock className="w-4 h-4 text-primary" aria-hidden="true" />
            <span>
              {simDays > 0 ? 'Đang mô phỏng +5 ngày (Tắt)' : 'Mô phỏng +5 ngày (Ebbinghaus)'}
            </span>
          </button>

          {summaryCounts.reviewNodes.length > 0 && (
            <button
              type="button"
              onClick={() => onStartReview(domainSlug, summaryCounts.reviewNodes[0].slug)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-tertiary-container/30 text-on-tertiary-fixed text-xs font-label font-bold hover:bg-tertiary-container/40 transition-colors shadow-sm cursor-pointer"
            >
              <History className="w-4 h-4 text-tertiary" aria-hidden="true" />
              <span>Trạm Ôn tập Ebbinghaus</span>
              <span className="w-5 h-5 rounded-full bg-tertiary text-on-tertiary flex items-center justify-center text-[10px] font-mono">
                {summaryCounts.reviewNodes.length}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="space-y-4">
          <div className="h-44 rounded-3xl bg-surface-container-lowest shadow-sm animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-52 rounded-2xl bg-surface-container-lowest shadow-sm animate-pulse"
              />
            ))}
          </div>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div
          role="alert"
          className="rounded-2xl border border-tertiary/40 bg-tertiary-fixed/15 p-5 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5 text-sm text-on-tertiary-container font-medium">
            <AlertTriangle className="w-5 h-5 text-tertiary shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadData()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-surface-container-lowest border border-tertiary/40 text-tertiary cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            Thử lại
          </button>
        </div>
      )}

      {!loading && !error && roadmap && (
        <>
          {/* 2. Ebbinghaus Spaced Repetition Critical Alert Strip */}
          {summaryCounts.reviewNodes.length > 0 && (
            <div className="rounded-2xl p-4 bg-tertiary-fixed/15 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-tertiary-fixed flex items-center justify-center text-on-tertiary-container shrink-0 mt-0.5">
                  <AlertTriangle className="w-5 h-5" aria-hidden="true" />
                </div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-headline font-bold text-sm text-tertiary">
                      Cảnh báo Đường cong Quên lãng Ebbinghaus
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-tertiary/20 text-tertiary text-[10px] font-label font-bold uppercase tracking-wider">
                      Hạn củng cố ({summaryCounts.reviewNodes.length})
                    </span>
                  </div>
                  <p className="text-xs text-on-surface leading-relaxed max-w-3xl">
                    Khái niệm{' '}
                    <code className="px-1.5 py-0.5 rounded bg-surface-container font-mono font-semibold text-tertiary">
                      {summaryCounts.reviewNodes[0].slug}
                    </code>{' '}
                    có hệ số duy trì trí nhớ{' '}
                    <strong className="font-mono">
                      R(t) = {Math.round(summaryCounts.reviewNodes[0].retention_ebbinghaus * 100)}%
                    </strong>{' '}
                    (&lt; 60%). Hãy ôn tập sớm để củng cố nền tảng trước khi mở tầng tiếp theo.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onStartReview(domainSlug, summaryCounts.reviewNodes[0].slug)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-tertiary text-on-tertiary hover:bg-tertiary-dim text-xs font-label font-bold shadow-md transition-all shrink-0 cursor-pointer"
              >
                <span>Vào Trạm Ôn tập Ngắt quãng</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          )}

          {/* 3. GNN-PPO Recommendation Engine Banner (Sunlit Apical Bud) */}
          {rec?.recommended_action && (
            <div
              className="rounded-3xl p-6 sm:p-7 bg-surface-container-lowest shadow-md relative overflow-hidden border border-tertiary-fixed/35"
              data-testid="gnn-ppo-banner"
            >
              <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-tertiary-fixed/20 blur-3xl pointer-events-none" />

              <div className="flex flex-col gap-6 relative z-10">
                {/* Banner Header Tag */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-tertiary-fixed/20 text-tertiary text-[11px] font-label font-extrabold uppercase tracking-wider">
                    <Compass className="w-4 h-4 text-tertiary" aria-hidden="true" />
                    <span>Gợi ý Bước học Tiếp theo</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary-container/50 text-on-primary-container text-[11px] font-bold"
                      data-testid="gnn-ppo-policy-badge"
                    >
                      <Cpu className="w-3.5 h-3.5" aria-hidden="true" />
                      {rec.policy_source === 'gnn_ppo' || rec.policy_source === 'gnn_ppo_masked'
                        ? 'Gợi ý từ AI (GNN-PPO)'
                        : 'Đề xuất Theo Lộ trình (Fallback)'}
                    </span>
                    {rec.guardrail_applied && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-surface-container text-primary">
                        <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                        Đủ điều kiện tiên quyết
                      </span>
                    )}
                  </div>
                </div>

                {/* 3-Column Decision Layout */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
                  {/* Column 1: Target Concept */}
                  <div className="md:col-span-4 p-4 rounded-2xl bg-surface-container-low flex flex-col justify-between">
                    <div>
                      <span className="text-[11px] font-label font-bold uppercase tracking-wider text-on-surface-variant">
                        Khái niệm Đích tối ưu
                      </span>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-primary-container text-on-primary-container text-xs font-mono font-bold">
                          Tầng {rec.recommended_action.tier}
                        </span>
                        <span className="font-mono font-bold text-sm text-primary">
                          {rec.recommended_action.concept_slug}
                        </span>
                      </div>
                      <h2 className="font-headline font-extrabold text-base text-on-surface mt-1.5">
                        {rec.recommended_action.title}
                      </h2>
                      <p className="text-xs text-on-surface-variant mt-2 leading-relaxed">
                        {rec.recommended_action.reason_vi}
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-surface-container flex items-center gap-2 text-[11px] text-on-surface-variant">
                      <Check className="w-3.5 h-3.5 text-secondary" aria-hidden="true" />
                      <span>Đã hoàn thành các bài tiên quyết</span>
                    </div>
                  </div>

                  {/* Column 2: Recommended Pedagogical Mode */}
                  <div className="md:col-span-4 p-4 rounded-2xl bg-surface-container-low flex flex-col justify-between">
                    <div>
                      <span className="text-[11px] font-label font-bold uppercase tracking-wider text-on-surface-variant">
                        Chế độ Học Đề xuất
                      </span>
                      <div className="mt-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-xs font-label font-bold">
                          <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                          {MODE_LABELS[rec.recommended_action.learning_mode]?.title ??
                            rec.recommended_action.learning_mode}
                        </span>
                      </div>
                      <p className="text-xs text-on-surface-variant mt-3 leading-relaxed">
                        {MODE_LABELS[rec.recommended_action.learning_mode]?.desc ??
                          'Thực hiện bước học theo khuyến nghị của mô hình.'}
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-surface-container flex items-center gap-2 text-[11px] font-label text-secondary font-semibold">
                      <Zap className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>
                        Hình thức:{' '}
                        {MODE_LABELS[rec.recommended_action.learning_mode]?.title ??
                          rec.recommended_action.learning_mode}
                      </span>
                    </div>
                  </div>

                  {/* Column 3: Action & Optional AI Details */}
                  <div className="md:col-span-4 p-4 rounded-2xl bg-surface-container flex flex-col justify-between gap-4">
                    <div className="space-y-2">
                      <span className="text-[11px] font-label font-bold uppercase tracking-wider text-on-surface-variant block">
                        Sẵn sàng Bắt đầu
                      </span>
                      <p className="text-xs text-on-surface-variant leading-relaxed">
                        Hệ thống đã kiểm tra điều kiện tiên quyết và mức độ ghi nhớ của bạn để chọn bài học tối ưu nhất lúc này.
                      </p>
                      {rec.checkpoint_sha256 && (
                        <span
                          className="sr-only"
                          data-testid="gnn-ppo-checkpoint-sha"
                        >
                          {rec.checkpoint_sha256}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      {recommendedNode && (
                        <button
                          type="button"
                          onClick={() => onOpenPlaybook(domainSlug, recommendedNode)}
                          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white border border-primary/30 text-primary hover:bg-primary-container/20 font-label font-bold text-xs shadow-2xs transition-all cursor-pointer"
                        >
                          <BookOpen className="w-4 h-4" aria-hidden="true" />
                          <span>Đọc Lý thuyết (Playbook)</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleCtaRecommended}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-on-primary hover:bg-primary-dim font-headline font-bold text-xs sm:text-sm shadow-sm transition-all cursor-pointer"
                      >
                        <span>Bắt đầu Bước học Đề xuất</span>
                        <ArrowRight className="w-4 h-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowRlDetails((v) => !v)}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-on-surface text-xs font-bold hover:border-primary transition-colors cursor-pointer"
                        data-testid="toggle-gnn-inference-btn"
                      >
                        <Activity className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                        <span>Giải thích đề xuất AI</span>
                        {showRlDetails ? (
                          <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expandable AI Explanation & Feature Matrix */}
                {showRlDetails && (
                  <div
                    className="pt-4 border-t border-surface-container-high space-y-4"
                    data-testid="gnn-ppo-inference-panel"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      <div className="p-3.5 rounded-xl bg-surface-container-low space-y-1">
                        <span className="font-bold text-primary block">1. Lý do chọn chủ đề</span>
                        <p className="text-on-surface-variant leading-relaxed">
                          {rec.recommended_action.reason_vi}
                        </p>
                      </div>
                      <div className="p-3.5 rounded-xl bg-surface-container-low space-y-1">
                        <span className="font-bold text-secondary block">
                          2. Điều kiện tiên quyết &amp; Độ nhớ
                        </span>
                        <p className="text-on-surface-variant leading-relaxed">
                          {recommendedNode && recommendedNode.prerequisites.length > 0
                            ? `Đã hoàn thành các bài nền: ${recommendedNode.prerequisites.join(', ')}.`
                            : 'Đây là chủ đề nền tảng gốc, sẵn sàng học ngay.'}{' '}
                          {recommendedNode
                            ? `Độ vững hiện tại: ${Math.round(recommendedNode.depth_level_norm * 100)}%.`
                            : ''}
                        </p>
                      </div>
                      <div className="p-3.5 rounded-xl bg-surface-container-low space-y-1">
                        <span className="font-bold text-tertiary block">
                          3. Phương pháp đề xuất
                        </span>
                        <p className="text-on-surface-variant leading-relaxed">
                          {MODE_LABELS[rec.recommended_action.learning_mode]?.desc ??
                            'Học lý thuyết Playbook trước, sau đó hoàn thành bài kiểm tra để mở khóa các chủ đề tiếp theo.'}
                        </p>
                      </div>
                    </div>

                    {rec.node_features_snapshot && (
                      <div className="overflow-x-auto bg-surface-container-lowest rounded-xl border border-outline-variant/30">
                        <table className="w-full text-[11px] font-mono text-left">
                          <thead className="bg-surface-container-low text-on-surface-variant border-b border-outline-variant/30">
                            <tr>
                              <th className="py-2 px-3">Chủ đề</th>
                              <th className="py-2 px-2">Độ sâu</th>
                              <th className="py-2 px-2">Độ tin cậy</th>
                              <th className="py-2 px-2">Độ nhớ R(t)</th>
                              <th className="py-2 px-2">Mở khóa</th>
                              <th className="py-2 px-2">Cần ôn</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-surface-container">
                            {roadmap.nodes.map((node, idx) => {
                              const row = rec.node_features_snapshot?.[idx] ?? []
                              const isTarget = node.slug === recommendedSlug
                              return (
                                <tr
                                  key={node.slug}
                                  className={
                                    isTarget
                                      ? 'bg-tertiary-fixed/15 font-bold text-on-tertiary-container'
                                      : 'text-on-surface'
                                  }
                                >
                                  <td className="py-1.5 px-3">
                                    {node.title} {isTarget ? '(AI chọn)' : ''}
                                  </td>
                                  <td className="py-1.5 px-2">
                                    {Math.round((row[0] ?? 0) * 100)}%
                                  </td>
                                  <td className="py-1.5 px-2">
                                    {Math.round((row[1] ?? 0) * 100)}%
                                  </td>
                                  <td className="py-1.5 px-2">
                                    {Math.round((row[2] ?? 0) * 100)}%
                                  </td>
                                  <td className="py-1.5 px-2">{row[3] === 1 ? 'Có' : 'Khóa'}</td>
                                  <td className="py-1.5 px-2">{row[4] === 1 ? 'Cần ôn' : 'Ổn'}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Completed Domain Banner */}
          {rec?.status === 'completed' && (
            <div className="rounded-2xl border border-primary/30 bg-primary-container/25 p-5 flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-primary shrink-0" aria-hidden="true" />
              <div>
                <h2 className="text-sm font-headline font-extrabold text-on-primary-fixed">
                  Hoàn thành Lĩnh vực {roadmap.domain_title}
                </h2>
                <p className="text-xs text-on-surface-variant">
                  Tất cả khái niệm đã đạt chuẩn Hiểu bản chất trở lên và không có cảnh báo suy giảm
                  trí nhớ.
                </p>
              </div>
            </div>
          )}

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-container-lowest p-4 rounded-2xl shadow-sm">
            <div className="text-xs font-label font-bold text-on-surface-variant uppercase tracking-wider">
              Bộ lọc Đồ thị Kiến thức ({filteredNodes.length} / {roadmap.nodes.length} nodes)
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                  filterMode === 'all'
                    ? 'bg-primary text-on-primary shadow-sm'
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
                      ? 'bg-tertiary text-on-tertiary shadow-sm'
                      : 'bg-tertiary-fixed/15 text-tertiary hover:bg-tertiary-fixed/25'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                  AI Đề xuất (1)
                </button>
              )}
              <button
                type="button"
                onClick={() => setFilterMode('review')}
                className={`inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                  filterMode === 'review'
                    ? 'bg-tertiary text-on-tertiary shadow-sm'
                    : 'bg-surface-container-low text-tertiary hover:bg-surface-container'
                }`}
              >
                <History className="w-3.5 h-3.5" aria-hidden="true" />
                Cần ôn tập ({summaryCounts.reviewNodes.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('shared')}
                className={`inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                  filterMode === 'shared'
                    ? 'bg-secondary text-on-secondary shadow-sm'
                    : 'bg-secondary-container/40 text-on-secondary-container hover:bg-secondary-container/60'
                }`}
              >
                <GitMerge className="w-3.5 h-3.5" aria-hidden="true" />
                Liên thông ({summaryCounts.shared})
              </button>
            </div>
          </div>

          {/* Empty Filter State */}
          {groupedByTier.length === 0 && (
            <div className="bg-surface-container-lowest rounded-2xl p-8 shadow-sm text-center space-y-2">
              <p className="text-sm font-bold text-on-surface">
                Không có khái niệm nào khớp bộ lọc hiện tại.
              </p>
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className="px-4 py-2 rounded-xl bg-surface-container text-xs font-bold text-primary cursor-pointer"
              >
                Hiển thị tất cả khái niệm
              </button>
            </div>
          )}

          {/* 4. Multi-Tier Knowledge Graph DAG Representation */}
          <div className="space-y-6 pt-1">
            {groupedByTier.map(([tier, tierNodes], idx) => {
              const tierInfo = TIER_TITLES[tier] ?? {
                title: `TẦNG ${tier}`,
                subtitle: `Tier ${tier}`,
              }
              const reviewInTier = tierNodes.filter((n) => n.needs_review).length
              const lockedInTier = tierNodes.filter((n) => !n.is_eligible).length
              return (
                <div key={tier} className="space-y-3">
                  {idx > 0 && (
                    <div
                      className="flex items-center justify-center -my-1 opacity-60"
                      aria-hidden="true"
                    >
                      <svg className="w-64 h-8 text-outline-variant" fill="none" viewBox="0 0 256 32">
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
                        L{tier}
                      </span>
                      <h2 className="font-headline font-extrabold text-sm sm:text-base text-on-surface">
                        {tierInfo.title}
                      </h2>
                      <span className="text-xs font-label text-on-surface-variant font-medium">
                        ({tierInfo.subtitle} • {tierNodes.length} Nodes)
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-mono">
                      {reviewInTier > 0 && (
                        <span className="text-tertiary font-semibold inline-flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-tertiary" />
                          {reviewInTier} node cần ôn Ebbinghaus
                        </span>
                      )}
                      {lockedInTier === 0 && reviewInTier === 0 && (
                        <span className="hidden sm:inline-flex items-center gap-1 text-primary font-semibold">
                          <Check className="w-3.5 h-3.5" aria-hidden="true" />
                          Tất cả đã mở khóa
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
