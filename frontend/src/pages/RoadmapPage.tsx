import { useMemo, useState } from 'react'
import { ArrowDown } from 'lucide-react'
import { AiRecommendationBanner } from '../components/roadmap/AiRecommendationBanner'
import { DagNodeCard } from '../components/roadmap/DagNodeCard'
import { DemoPresetToolbar } from '../components/roadmap/DemoPresetToolbar'
import type { DagNode, RecommendationPayload } from '../types'

export type NodeFilter = 'all' | 'recommended' | 'unlocked' | 'mastered' | 'locked'

const TIER_METADATA: Record<
  number,
  { label: string; name: string; desc: string }
> = {
  1: {
    label: 'L1',
    name: 'Tầng 1 — Nền tảng (Foundations)',
    desc: 'Kiến thức cơ bản bắt buộc trước mọi giao tiếp hệ thống',
  },
  2: {
    label: 'L2',
    name: 'Tầng 2 — Giao thức & Cơ sở dữ liệu (Protocols & Data)',
    desc: 'Các khái niệm trung tâm về mạng HTTP và lưu trữ dữ liệu',
  },
  3: {
    label: 'L3',
    name: 'Tầng 3 — Thiết kế API & Quản lý Trạng thái (API Design & State)',
    desc: 'Thiết kế RESTful, Data mapping và Caching hiệu năng cao',
  },
  4: {
    label: 'L4',
    name: 'Tầng 4 — Bảo mật Backend cơ bản (Backend Security)',
    desc: 'Xác thực danh tính, phân quyền và bảo vệ an toàn dịch vụ',
  },
}

interface RoadmapPageProps {
  nodes: DagNode[]
  recommendation: RecommendationPayload
  masteredCount: number
  isLoading: boolean
  currentUsername?: string
  onSelectPreset: (preset: { key: string; title: string }) => void
  onOpenConcept: (slug: string, targetScreen: 'scr03_lesson' | 'scr04_quiz') => void
}

export function RoadmapPage({
  nodes,
  recommendation,
  masteredCount,
  isLoading,
  currentUsername,
  onSelectPreset,
  onOpenConcept,
}: RoadmapPageProps) {
  const [nodeFilter, setNodeFilter] = useState<NodeFilter>('all')

  const recommendedSlug = recommendation.recommended_concept?.slug

  const counts = useMemo(() => {
    return {
      all: nodes.length,
      recommended: recommendedSlug ? 1 : 0,
      unlocked: nodes.filter((n) => n.status === 'unlocked').length,
      mastered: nodes.filter((n) => n.status === 'mastered').length,
      locked: nodes.filter((n) => n.status === 'locked').length,
    }
  }, [nodes, recommendedSlug])

  const tiers = [1, 2, 3, 4] as const

  return (
    <div
      aria-label="SCR-02 Bản đồ Lộ trình 12 Khái niệm và Khuyến nghị AI"
      className="space-y-6"
      data-testid="scr02-roadmap-section"
    >
      {/* Demo Presets Sub-bar (Stitch SCR-02) */}
      <DemoPresetToolbar
        isLoading={isLoading}
        onSelectPreset={onSelectPreset}
        currentUsername={currentUsername}
        masteredCount={masteredCount}
      />

      {/* Hero AI Recommendation Banner (Stitch SCR-02 Sunlit Amber) */}
      <AiRecommendationBanner
        recommendation={recommendation}
        masteredCount={masteredCount}
        onStartRecommended={(slug) => onOpenConcept(slug, 'scr03_lesson')}
      />

      {/* Filter Pills Row & DAG Status Legend */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2">
        {/* Filter Tabs */}
        <div className="flex items-center flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setNodeFilter('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
              nodeFilter === 'all'
                ? 'bg-[#15803D] text-white shadow-xs'
                : 'bg-white border border-[#D8E2D8] text-[#3F5247] hover:bg-[#F6F8F5]'
            }`}
          >
            Tất cả ({counts.all})
          </button>
          <button
            type="button"
            onClick={() => setNodeFilter('recommended')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
              nodeFilter === 'recommended'
                ? 'bg-[#D97706] text-white shadow-xs'
                : 'bg-[#FFFBEB] text-[#78350F] border border-[#FDE68A] hover:bg-[#FEF3C7]'
            }`}
          >
            AI Đề xuất ({counts.recommended})
          </button>
          <button
            type="button"
            onClick={() => setNodeFilter('unlocked')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
              nodeFilter === 'unlocked'
                ? 'bg-[#0D9488] text-white shadow-xs'
                : 'bg-[#F0FDFA] text-[#134E4A] border border-[#99F6E4] hover:bg-[#CCFBF1]'
            }`}
          >
            Đã mở khóa ({counts.unlocked})
          </button>
          <button
            type="button"
            onClick={() => setNodeFilter('mastered')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
              nodeFilter === 'mastered'
                ? 'bg-[#16A34A] text-white shadow-xs'
                : 'bg-[#F0FDF4] text-[#14532D] border border-[#BBF7D0] hover:bg-[#DCFCE7]'
            }`}
          >
            Đã thông thạo ({counts.mastered})
          </button>
          <button
            type="button"
            onClick={() => setNodeFilter('locked')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
              nodeFilter === 'locked'
                ? 'bg-[#57534E] text-white shadow-xs'
                : 'bg-white border border-[#D8E2D8] text-[#57534E] hover:bg-[#F6F8F5]'
            }`}
          >
            Đang khóa ({counts.locked})
          </button>
        </div>

        {/* DAG Status Legend */}
        <div className="flex items-center flex-wrap gap-3 text-xs text-[#57534E]">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A]"></span>
            <span>Đã thông thạo (≥ 75%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0D9488]"></span>
            <span>Đã mở khóa</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#A8A29E]"></span>
            <span>Đang khóa</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#D97706] ring-2 ring-[#FDE68A]"></span>
            <span className="font-semibold text-[#78350F]">AI Đề xuất</span>
          </div>
        </div>
      </section>

      {/* Main 4-Tier Prerequisite DAG Grid */}
      <div className="space-y-8 pt-2">
        {tiers.map((tierNum, tierIdx) => {
          const tierMeta = TIER_METADATA[tierNum]
          const tierNodes = nodes.filter((n) => n.tier === tierNum)
          const filteredTierNodes = tierNodes.filter((node) => {
            if (nodeFilter === 'all') return true
            if (nodeFilter === 'recommended') return node.slug === recommendedSlug
            return node.status === nodeFilter
          })

          if (filteredTierNodes.length === 0 && nodeFilter !== 'all') {
            return null
          }

          const tierMastered = tierNodes.filter((n) => n.status === 'mastered').length

          return (
            <div key={tierNum} className="space-y-4">
              {/* Connector from previous tier */}
              {tierIdx > 0 && nodeFilter === 'all' ? (
                <div className="flex items-center justify-center my-3">
                  <div className="flex items-center gap-2 bg-white px-3.5 py-1 rounded-full border border-[#D8E2D8] text-xs text-[#57534E] font-mono shadow-2xs">
                    <ArrowDown className="w-3.5 h-3.5 text-[#15803D]" aria-hidden="true" />
                    <span>DAG Dependencies: Tầng {tierNum - 1} → Tầng {tierNum}</span>
                  </div>
                </div>
              ) : null}

              {/* Tier Section */}
              <section className="space-y-4">
                {/* Tier Header */}
                <div className="flex items-center justify-between border-b border-[#D8E2D8] pb-2">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-lg bg-[#15803D] text-white font-mono font-bold text-xs flex items-center justify-center">
                      {tierMeta.label}
                    </span>
                    <div>
                      <h2 className="font-bold text-base text-[#14241B]">{tierMeta.name}</h2>
                      <p className="text-xs text-[#57534E]">{tierMeta.desc}</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#F0FDF4] text-[#14532D] border border-[#BBF7D0] text-xs font-bold">
                    {tierMastered}/{tierNodes.length} Hoàn thành
                  </span>
                </div>

                {/* Tier Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredTierNodes.map((node) => (
                    <DagNodeCard
                      key={node.slug}
                      node={node}
                      isRecommended={node.slug === recommendedSlug}
                      onOpenConcept={onOpenConcept}
                    />
                  ))}
                </div>
              </section>
            </div>
          )
        })}
      </div>
    </div>
  )
}
