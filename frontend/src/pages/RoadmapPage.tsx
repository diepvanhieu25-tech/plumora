import { useMemo, useState } from 'react'
import { AiRecommendationBanner } from '../components/roadmap/AiRecommendationBanner'
import { DagNodeCard } from '../components/roadmap/DagNodeCard'
import { DemoPresetToolbar } from '../components/roadmap/DemoPresetToolbar'
import type { DagNode, RecommendationPayload } from '../types'

export type NodeFilter = 'all' | 'recommended' | 'unlocked' | 'mastered' | 'locked'

interface RoadmapPageProps {
  nodes: DagNode[]
  recommendation: RecommendationPayload
  masteredCount: number
  isLoading: boolean
  onSelectPreset: (preset: { key: string; title: string }) => void
  onOpenConcept: (slug: string, targetScreen: 'scr03_lesson' | 'scr04_quiz') => void
}

export function RoadmapPage({
  nodes,
  recommendation,
  masteredCount,
  isLoading,
  onSelectPreset,
  onOpenConcept,
}: RoadmapPageProps) {
  const [nodeFilter, setNodeFilter] = useState<NodeFilter>('all')

  const filteredNodes = useMemo(() => {
    return nodes.filter((node) => {
      if (nodeFilter === 'all') return true
      if (nodeFilter === 'recommended') {
        return recommendation.recommended_concept?.slug === node.slug
      }
      return node.status === nodeFilter
    })
  }, [nodes, nodeFilter, recommendation])

  return (
    <section
      aria-label="SCR-02 Bản đồ Lộ trình 12 Khái niệm và Khuyến nghị AI"
      className="space-y-6"
      data-testid="scr02-roadmap-section"
    >
      {/* Demo Presets Toolbar */}
      <DemoPresetToolbar
        isLoading={isLoading}
        onSelectPreset={onSelectPreset}
      />

      {/* SCR-07 Completed State or SCR-02 Sunlit Amber AI Recommendation Banner */}
      <AiRecommendationBanner
        recommendation={recommendation}
        masteredCount={masteredCount}
        onStartRecommended={(slug) => onOpenConcept(slug, 'scr03_lesson')}
      />

      {/* Filter controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-[#14241B]">
          Bản đồ 12 Khái niệm Backend (4 Tầng Tiên quyết DAG)
        </h2>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Bộ lọc trạng thái Node">
          {(
            [
              ['all', 'Tất cả (12)'],
              ['recommended', 'AI Đề xuất'],
              ['unlocked', 'Đã mở khóa'],
              ['mastered', 'Đã thông thạo'],
              ['locked', 'Đang khóa'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setNodeFilter(key)}
              className={`px-3 py-1 rounded-md text-xs font-semibold border ${
                nodeFilter === key
                  ? 'bg-[#15803D] text-white border-[#15803D]'
                  : 'bg-white text-[#3F5247] border-[#D8E2D8]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 4 Tiers Grid */}
      {[1, 2, 3, 4].map((tier) => {
        const tierNodes = filteredNodes.filter((n) => n.tier === tier)
        if (tierNodes.length === 0) return null
        return (
          <div key={tier} className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#3F5247] border-b border-[#D8E2D8] pb-1">
              Tầng {tier} (Tier {tier})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tierNodes.map((node) => {
                const isRecommended =
                  recommendation.recommended_concept?.slug === node.slug
                return (
                  <DagNodeCard
                    key={node.slug}
                    node={node}
                    isRecommended={isRecommended}
                    onOpenLesson={(slug) => onOpenConcept(slug, 'scr03_lesson')}
                    onOpenQuiz={(slug) => onOpenConcept(slug, 'scr04_quiz')}
                  />
                )
              })}
            </div>
          </div>
        )
      })}
    </section>
  )
}
