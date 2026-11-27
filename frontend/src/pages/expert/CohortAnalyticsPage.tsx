import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  History,
  Layers,
  RefreshCw,
  ShieldAlert,
  Users,
} from 'lucide-react'
import { apiExpertGetCohortAnalytics, apiGetDomains } from '../../api'
import { useOptionalBackOfficeStudio } from '../../shells/BackOfficeStudioContext'
import type { BackOfficeView, CohortAnalyticsResponse } from '../../types/expert'
import type { DomainListItem } from '../../types/learnerV2'

export interface CohortAnalyticsPageProps {
  onNavigate?: (view: BackOfficeView, params?: { domainSlug?: string; conceptSlug?: string }) => void
}

export function CohortAnalyticsPage({ onNavigate }: CohortAnalyticsPageProps) {
  const studio = useOptionalBackOfficeStudio()
  const [localDomains, setLocalDomains] = useState<DomainListItem[]>([])
  const [localDomainSlug, setLocalDomainSlug] = useState('backend')

  const domains = studio ? studio.domains : localDomains
  const selectedDomain = studio ? studio.selectedDomainSlug : localDomainSlug
  const setSelectedDomain = studio ? studio.setSelectedDomainSlug : setLocalDomainSlug

  const [analytics, setAnalytics] = useState<CohortAnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (studio) return
    void (async () => {
      try {
        const res = await apiGetDomains()
        setLocalDomains(res.domains)
        if (res.domains.length > 0) setLocalDomainSlug(res.domains[0].slug)
      } catch {
        // handled on cohort load
      }
    })()
  }, [studio])

  const loadAnalytics = useCallback(async (domainSlug: string) => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiExpertGetCohortAnalytics(domainSlug)
      setAnalytics(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải dữ liệu phân tích đoàn hệ')
      setAnalytics(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!selectedDomain) return
    void loadAnalytics(selectedDomain)
  }, [selectedDomain, loadAnalytics])

  const bottlenecks = useMemo(() => {
    if (!analytics) return []
    return [...analytics.concepts]
      .filter((c) => c.bottleneck_events > 0)
      .sort((a, b) => b.bottleneck_events - a.bottleneck_events)
  }, [analytics])

  const totalDeepOrMastery = useMemo(() => {
    if (!analytics) return 0
    return analytics.concepts.reduce((sum, c) => sum + c.deep_count + c.mastery_count, 0)
  }, [analytics])

  function jumpToConceptStudio(conceptSlug: string, targetView: BackOfficeView) {
    if (studio) {
      studio.setSelectedDomainSlug(selectedDomain)
      studio.setSelectedConceptSlug(conceptSlug)
    }
    onNavigate?.(targetView, { domainSlug: selectedDomain, conceptSlug })
  }

  return (
    <section
      className="w-full space-y-6 text-[#14241B]"
      data-testid="backoffice-cohort-analytics"
    >
      {/* Header & Domain Switcher */}
      <div className="bg-white rounded-2xl border border-[#D8E2D8] p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-[#14241B] tracking-tight">
            Phân tích Đoàn hệ Học viên &amp; Suy giảm Trí nhớ
          </h1>
          <p className="text-xs text-[#3F5247] mt-1">
            Theo dõi phân bố năng lực 4 bậc, phát hiện điểm nghẽn sư phạm và cảnh báo ôn tập theo thời gian thực.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            aria-label="Chọn lĩnh vực phân tích đoàn hệ"
            value={selectedDomain}
            onChange={(e) => setSelectedDomain(e.target.value)}
            className="rounded-lg border border-[#D8E2D8] bg-[#F6F8F5] px-3 py-2 text-xs font-bold text-[#14241B] focus:border-[#15803D] focus:outline-none cursor-pointer"
          >
            {domains.map((d) => (
              <option key={d.slug} value={d.slug}>
                {d.title} ({d.slug})
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => void loadAnalytics(selectedDomain)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#F6F8F5] border border-[#D8E2D8] hover:bg-[#F0FDF4] text-xs font-semibold text-[#14241B] cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {error && !loading && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-[#FFF1F2] border border-[#FDA4AF] text-xs font-semibold text-[#9F1239] flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadAnalytics(selectedDomain)}
            className="px-3 py-1 rounded-lg bg-white border border-[#FDA4AF] text-[#9F1239] cursor-pointer"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Summary Metric Cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-white border border-[#D8E2D8] animate-pulse" />
          ))}
        </div>
      ) : (
        analytics && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-[#D8E2D8] p-4 space-y-1">
                <div className="flex items-center justify-between text-xs text-[#57534E]">
                  <span className="font-semibold">Học viên đang hoạt động</span>
                  <Users className="w-4 h-4 text-[#15803D]" aria-hidden="true" />
                </div>
                <div className="text-2xl font-extrabold font-mono text-[#14241B]">
                  {analytics.total_active_learners}
                </div>
                <p className="text-[11px] text-[#57534E]">Có dữ liệu năng lực trong lĩnh vực này</p>
              </div>

              <div className="bg-white rounded-xl border border-[#D8E2D8] p-4 space-y-1">
                <div className="flex items-center justify-between text-xs text-[#57534E]">
                  <span className="font-semibold">Lượt đạt Hiểu bản chất / Làm chủ</span>
                  <Layers className="w-4 h-4 text-[#0D9488]" aria-hidden="true" />
                </div>
                <div className="text-2xl font-extrabold font-mono text-[#15803D]">
                  {totalDeepOrMastery}
                </div>
                <p className="text-[11px] text-[#57534E]">Tổng hồ sơ node đạt ngưỡng &ge; 75%</p>
              </div>

              <div className="bg-white rounded-xl border border-[#D8E2D8] p-4 space-y-1">
                <div className="flex items-center justify-between text-xs text-[#57534E]">
                  <span className="font-semibold">Điểm nghẽn Sư phạm</span>
                  <ShieldAlert className="w-4 h-4 text-[#9F1239]" aria-hidden="true" />
                </div>
                <div className="text-2xl font-extrabold font-mono text-[#9F1239]">
                  {bottlenecks.length}
                </div>
                <p className="text-[11px] text-[#57534E]">Khái niệm có học viên chạm trần hiểu biết</p>
              </div>

              <div className="bg-white rounded-xl border border-[#D8E2D8] p-4 space-y-1">
                <div className="flex items-center justify-between text-xs text-[#57534E]">
                  <span className="font-semibold">Cảnh báo Suy giảm Trí nhớ</span>
                  <History className="w-4 h-4 text-[#D97706]" aria-hidden="true" />
                </div>
                <div className="text-2xl font-extrabold font-mono text-[#D97706]">
                  {analytics.total_needs_review_nodes}
                </div>
                <p className="text-[11px] text-[#57534E]">Lượt node có R(t) &lt; 60% cần ôn tập</p>
              </div>
            </div>

            {/* Bottleneck Tier Detector */}
            <div className="bg-white rounded-2xl border border-[#D8E2D8] p-5 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-[#9F1239]" aria-hidden="true" />
                  <h2 className="text-sm font-bold text-[#14241B]">
                    Bộ Phát hiện Điểm nghẽn Sư phạm (Bottleneck Tier Detector)
                  </h2>
                </div>
                <span className="text-[11px] font-mono text-[#57534E]">
                  Nguồn: phiên đánh giá ceiling_reached / insufficient_evidence
                </span>
              </div>

              {bottlenecks.length === 0 ? (
                <div className="p-4 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] text-xs text-[#14532D]">
                  Chưa ghi nhận khái niệm nào có tỷ lệ chạm trần hiểu biết bất thường trong lĩnh vực này.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {bottlenecks.slice(0, 6).map((b) => (
                    <div
                      key={b.concept_slug}
                      className="p-4 rounded-xl bg-[#FFF1F2]/60 border border-[#FDA4AF] flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-bold text-[#9F1239]">
                            {b.concept_slug}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-[#9F1239] text-white text-[10px] font-bold">
                            {b.bottleneck_events} lượt nghẽn
                          </span>
                        </div>
                        <p className="text-xs font-bold text-[#14241B]">{b.title}</p>
                        <p className="text-[11px] text-[#3F5247]">
                          Tầng nghẽn phổ biến nhất:{' '}
                          <strong className="font-mono text-[#9F1239]">
                            Tầng {b.bottleneck_tier ?? 1}
                          </strong>
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => jumpToConceptStudio(b.concept_slug, 'expert_domains')}
                          className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-[#D8E2D8] hover:border-[#15803D] text-[11px] font-semibold text-[#14241B] cursor-pointer"
                        >
                          <span>Sửa Bài giảng</span>
                          <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => jumpToConceptStudio(b.concept_slug, 'expert_questions')}
                          className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#15803D] hover:bg-[#166534] text-[11px] font-semibold text-white cursor-pointer"
                        >
                          <span>Mở Đề 5 Tầng</span>
                          <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 4-Level Competency & Retention Heatmap Table */}
            <div className="bg-white rounded-2xl border border-[#D8E2D8] p-5 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[#15803D]" aria-hidden="true" />
                  <h2 className="text-sm font-bold text-[#14241B]">
                    Bản đồ Nhiệt Năng lực 4 Bậc &amp; Độ nhớ Ebbinghaus ({analytics.concepts.length} khái niệm)
                  </h2>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#F6F8F5] text-[#57534E] font-mono text-[11px] uppercase border-b border-[#D8E2D8]">
                      <th className="py-2.5 px-3">Khái niệm</th>
                      <th className="py-2.5 px-2 text-center">Tầng</th>
                      <th className="py-2.5 px-2 text-center">Surface (25%)</th>
                      <th className="py-2.5 px-2 text-center">Applied (50%)</th>
                      <th className="py-2.5 px-2 text-center">Deep (75%)</th>
                      <th className="py-2.5 px-2 text-center">Mastery (100%)</th>
                      <th className="py-2.5 px-2 text-center">Cần ôn R(t)&lt;60%</th>
                      <th className="py-2.5 px-2 text-center">Điểm nghẽn</th>
                      <th className="py-2.5 px-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7EFE7]">
                    {analytics.concepts.map((c) => (
                      <tr key={c.concept_slug} className="hover:bg-[#F6F8F5]/70">
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-[#14241B]">{c.title}</div>
                          <div className="font-mono text-[11px] text-[#57534E]">{c.concept_slug}</div>
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono">T{c.tier}</td>
                        <td className="py-2.5 px-2 text-center font-mono">
                          <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-700 font-semibold">
                            {c.surface_count}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono">
                          <span className="px-2 py-0.5 rounded bg-teal-50 text-teal-800 font-semibold">
                            {c.applied_count}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono">
                          <span className="px-2 py-0.5 rounded bg-green-50 text-green-800 font-semibold">
                            {c.deep_count}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono">
                          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-bold">
                            {c.mastery_count}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono">
                          <span
                            className={`px-2 py-0.5 rounded font-semibold ${
                              c.needs_review_count > 0
                                ? 'bg-[#FFFBEB] text-[#B45309] border border-[#F59E0B]/40'
                                : 'text-[#57534E]'
                            }`}
                          >
                            {c.needs_review_count}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono">
                          {c.bottleneck_events > 0 ? (
                            <span className="px-2 py-0.5 rounded bg-[#FFF1F2] text-[#9F1239] font-bold">
                              Tầng {c.bottleneck_tier} ({c.bottleneck_events})
                            </span>
                          ) : (
                            <span className="text-[#57534E]">--</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => jumpToConceptStudio(c.concept_slug, 'expert_domains')}
                            className="inline-flex items-center gap-1 text-[#15803D] hover:underline font-semibold cursor-pointer"
                          >
                            <span>Studio</span>
                            <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )
      )}
    </section>
  )
}
