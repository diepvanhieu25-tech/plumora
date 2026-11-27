import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  GitBranch,
  Layers,
  Link2,
  Terminal,
} from 'lucide-react'
import { useState } from 'react'
import {
  PLAYBOOK_FIVE_SECTIONS,
  SHOWCASE_DOMAINS,
  TIER_LABELS,
} from '../../data/publicShowcaseData'
import type { ShowcaseDomain } from '../../data/publicShowcaseData'

interface PublicCurriculumPageProps {
  onNavigatePath: (path: string) => void
}

export function PublicCurriculumPage({ onNavigatePath }: PublicCurriculumPageProps) {
  const [selectedSlug, setSelectedSlug] = useState<ShowcaseDomain['slug']>('backend')
  const activeDomain =
    SHOWCASE_DOMAINS.find((d) => d.slug === selectedSlug) ?? SHOWCASE_DOMAINS[0]

  const tiers: Array<1 | 2 | 3 | 4> = [1, 2, 3, 4]

  return (
    <div data-testid="pub03-curriculum-page" className="max-w-7xl mx-auto px-4 sm:px-6 py-12 lg:py-16 space-y-14">
      {/* Header */}
      <header className="max-w-3xl space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary-container/70 border border-secondary/30 text-on-secondary-container text-xs font-semibold">
          <GitBranch className="w-3.5 h-3.5 text-secondary" aria-hidden="true" />
          <span>Đồ thị Tri thức Đa lĩnh vực (Multi-domain Knowledge Graph)</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-on-surface">
          3 Lĩnh vực Kỹ thuật · 31 Khái niệm Liên thông
        </h1>
        <p className="text-base text-on-surface-variant leading-relaxed">
          Mỗi lĩnh vực được tổ chức thành Đồ thị có hướng không chu trình (DAG) gồm 4 tầng từ nền tảng đến sản xuất. 7 khái niệm cốt lõi (như Mạng, HTTP, REST API, Redis, Bảo mật) được đồng bộ tự động xuyên suốt các ngành.
        </p>
      </header>

      {/* Interactive Domain Tabs */}
      <section className="space-y-6">
        <div
          role="tablist"
          aria-label="Chọn lĩnh vực học tập"
          className="flex flex-wrap gap-2.5"
        >
          {SHOWCASE_DOMAINS.map((domain) => {
            const isActive = domain.slug === activeDomain.slug
            return (
              <button
                key={domain.slug}
                type="button"
                role="tab"
                aria-selected={isActive}
                data-testid={`pub-curriculum-tab-${domain.slug}`}
                onClick={() => setSelectedSlug(domain.slug)}
                className={`px-4 py-2.5 min-h-[44px] rounded-xl text-sm font-semibold border transition-colors ${
                  isActive
                    ? 'bg-primary text-on-primary border-primary shadow-xs'
                    : 'bg-white text-on-surface-variant border-[#D8E2D8] hover:text-on-surface hover:bg-surface-container-low'
                }`}
              >
                {domain.shortLabel}
              </button>
            )
          })}
        </div>

        {/* Active Domain Overview */}
        <div className="rounded-2xl bg-white border border-[#D8E2D8] p-6 space-y-6 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[#D8E2D8]">
            <div className="space-y-1.5 max-w-2xl">
              <h2 className="text-xl sm:text-2xl font-bold text-on-surface">
                {activeDomain.title}
              </h2>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                {activeDomain.summary}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F6F8F5] border border-[#D8E2D8] text-xs font-mono font-semibold text-on-surface">
                <Layers className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                <span>{activeDomain.nodeCount} khái niệm</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F6F8F5] border border-[#D8E2D8] text-xs font-mono font-semibold text-on-surface">
                <Terminal className="w-3.5 h-3.5 text-secondary" aria-hidden="true" />
                <span>Sandbox: {activeDomain.sandboxLanguages}</span>
              </span>
            </div>
          </div>

          {/* 4-Tier DAG Preview */}
          <div className="space-y-6">
            {tiers.map((tier) => {
              const tierNodes = activeDomain.nodes.filter((n) => n.tier === tier)
              if (tierNodes.length === 0) return null
              return (
                <div key={tier} className="space-y-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-primary">
                    {TIER_LABELS[tier]}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {tierNodes.map((node) => (
                      <div
                        key={node.slug}
                        className="rounded-xl bg-[#F6F8F5] border border-[#D8E2D8] p-4 space-y-2 flex flex-col justify-between"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-mono font-semibold text-on-surface-variant">
                              {node.slug}
                            </span>
                            {node.isShared && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-shared-bg border border-shared-border text-shared-text text-[10px] font-semibold">
                                <Link2 className="w-3 h-3" aria-hidden="true" />
                                <span>Liên thông</span>
                              </span>
                            )}
                          </div>
                          <h3 className="text-sm font-bold text-on-surface leading-snug">
                            {node.title}
                          </h3>
                        </div>
                        <div className="pt-2 border-t border-[#D8E2D8]/80 text-[11px] text-outline font-mono">
                          {node.prerequisites.length === 0
                            ? 'Tiên quyết: Nút gốc (Mở sẵn)'
                            : `Tiên quyết: ${node.prerequisites.join(', ')}`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Playbook 5 Parts & Dual-Pillar Mastery */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 rounded-2xl bg-white border border-[#D8E2D8] p-6 space-y-5 shadow-xs">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-primary" aria-hidden="true" />
            <h2 className="text-lg sm:text-xl font-bold text-on-surface">
              Cấu trúc Playbook 5 Phần chuẩn hóa
            </h2>
          </div>
          <div className="space-y-3">
            {PLAYBOOK_FIVE_SECTIONS.map((sec) => (
              <div
                key={sec.index}
                className="flex items-start gap-3.5 p-3.5 rounded-xl bg-[#F6F8F5] border border-[#D8E2D8]/80"
              >
                <span className="text-xs font-mono font-bold text-primary bg-white border border-[#D8E2D8] rounded-lg px-2 py-1 shrink-0">
                  {sec.index}
                </span>
                <div className="space-y-0.5 min-w-0">
                  <div className="text-sm font-bold text-on-surface">{sec.title}</div>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    {sec.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 rounded-2xl bg-white border border-[#D8E2D8] p-6 space-y-5 shadow-xs flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-primary" aria-hidden="true" />
              <h2 className="text-lg sm:text-xl font-bold text-on-surface">
                Chuẩn Thông thạo Kép (1.00 Mastery)
              </h2>
            </div>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              Để chống học tủ hoặc chỉ đọc lướt lý thuyết, hệ thống áp dụng bất biến tuần tự <span className="font-mono text-xs text-on-surface">INV-SEQ-01..04</span>:
            </p>
            <ul className="space-y-3 text-sm text-on-surface-variant">
              <li className="p-3.5 rounded-xl bg-[#F0FDFA] border border-secondary/30">
                <div className="font-bold text-[#134E4A] text-xs uppercase tracking-wider mb-1">
                  Trụ cột 1 · Đào sâu 5 Tầng (&gt;= 0.75)
                </div>
                <p className="text-xs text-[#134E4A]/90 leading-relaxed">
                  Vượt qua Tầng 3–5 để đạt mức 0.75 Deep Understanding và mở khóa các khái niệm tầng sau trên DAG.
                </p>
              </li>
              <li className="p-3.5 rounded-xl bg-[#F0FDF4] border border-primary/30">
                <div className="font-bold text-[#14532D] text-xs uppercase tracking-wider mb-1">
                  Trụ cột 2 · Code Sandbox (100% Test Cases)
                </div>
                <p className="text-xs text-[#14532D]/90 leading-relaxed">
                  Hoàn thành bài tập thực hành chạy trong môi trường cô lập để chốt mức thông thạo tối đa 1.00 Mastery.
                </p>
              </li>
            </ul>
          </div>

          <button
            type="button"
            onClick={() => onNavigatePath('/register')}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[44px] rounded-xl bg-primary hover:bg-primary-dim text-on-primary text-sm font-semibold transition-colors"
          >
            <span>Khám phá lộ trình của bạn</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </section>
    </div>
  )
}
