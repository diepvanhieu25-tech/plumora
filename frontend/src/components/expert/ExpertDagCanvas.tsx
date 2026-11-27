import { useState } from 'react'
import { GitBranch, GitMerge, Plus } from 'lucide-react'
import type {
  DagCycleAnalysis,
  DagEdgeItem,
  EditableGraphNode,
} from '../../hooks/useDagTopologyEditor'

const TIER_HEADER_META: Record<number, { title: string; dotColor: string }> = {
  1: { title: 'Tầng 1: Nền tảng & Khái niệm Gốc', dotColor: 'bg-[#0D9488]' },
  2: { title: 'Tầng 2: Cơ chế Cốt lõi & Giao thức', dotColor: 'bg-[#15803D]' },
  3: { title: 'Tầng 3: Kiến trúc Ứng dụng & Tích hợp', dotColor: 'bg-[#D97706]' },
  4: { title: 'Tầng 4: Chuyên sâu, Bảo mật & Vận hành', dotColor: 'bg-[#9F1239]' },
}

export interface ExpertDagCanvasProps {
  selectedDomain: string
  nodes: EditableGraphNode[]
  selectedNodeSlug: string | null
  allEdges: DagEdgeItem[]
  outDegreeMap: Record<string, number>
  cycleAnalysis: DagCycleAnalysis
  sharedNodesCount: number
  loadingGraph: boolean
  onSelectNode: (slug: string) => void
  onAddNode: (input: { slug: string; title: string; tier: number; isShared: boolean }) => boolean
  onTogglePrereq: (targetSlug: string, prereqSlug: string) => void
}

export function ExpertDagCanvas({
  selectedDomain,
  nodes,
  selectedNodeSlug,
  allEdges,
  outDegreeMap,
  cycleAnalysis,
  sharedNodesCount,
  loadingGraph,
  onSelectNode,
  onAddNode,
  onTogglePrereq,
}: ExpertDagCanvasProps) {
  const [canvasFilter, setCanvasFilter] = useState<'all' | 'shared'>('all')
  const [nodeSlug, setNodeSlug] = useState('')
  const [nodeTitle, setNodeTitle] = useState('')
  const [nodeTier, setNodeTier] = useState(1)
  const [nodeShared, setNodeShared] = useState(false)

  function handleAddClick() {
    const added = onAddNode({
      slug: nodeSlug,
      title: nodeTitle,
      tier: nodeTier,
      isShared: nodeShared,
    })
    if (added) {
      setNodeSlug('')
      setNodeTitle('')
      setNodeTier(1)
      setNodeShared(false)
    }
  }

  return (
    <div className="lg:col-span-7 space-y-5">
      <div className="bg-white rounded-2xl border border-[#D8E2D8] shadow-xs overflow-hidden">
        {/* Canvas Header */}
        <div className="px-5 py-3.5 bg-[#F6F8F5] border-b border-[#D8E2D8] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-[#15803D]" aria-hidden="true" />
            <h1 className="font-extrabold text-xs uppercase tracking-wider text-[#14241B]">
              Biên tập Đồ thị Tri thức ({selectedDomain})
            </h1>
          </div>

          <div className="flex items-center bg-white border border-[#D8E2D8] rounded-lg p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setCanvasFilter('all')}
              className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                canvasFilter === 'all'
                  ? 'bg-[#15803D] text-white'
                  : 'text-[#57534E] hover:text-[#14241B]'
              }`}
            >
              Tất cả ({nodes.length})
            </button>
            <button
              type="button"
              onClick={() => setCanvasFilter('shared')}
              className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                canvasFilter === 'shared'
                  ? 'bg-[#1D4ED8] text-white'
                  : 'text-[#57534E] hover:text-[#14241B]'
              }`}
            >
              Liên thông ({sharedNodesCount})
            </button>
          </div>
        </div>

        {/* Add Node Strip */}
        <div className="px-5 py-3 bg-[#F6F8F5]/60 border-b border-[#E7EFE7] grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
          <input
            value={nodeSlug}
            onChange={(e) => setNodeSlug(e.target.value)}
            placeholder="slug mới (vd: stream-kafka)"
            className="sm:col-span-3 rounded-lg border border-[#D8E2D8] bg-white px-2.5 py-1.5 text-xs font-mono focus:border-[#15803D] focus:outline-none"
          />
          <input
            value={nodeTitle}
            onChange={(e) => setNodeTitle(e.target.value)}
            placeholder="Tên khái niệm tiếng Việt"
            className="sm:col-span-4 rounded-lg border border-[#D8E2D8] bg-white px-2.5 py-1.5 text-xs focus:border-[#15803D] focus:outline-none"
          />
          <select
            aria-label="Tầng cho khái niệm mới"
            value={nodeTier}
            onChange={(e) => setNodeTier(Number(e.target.value))}
            className="sm:col-span-2 rounded-lg border border-[#D8E2D8] bg-white px-2 py-1.5 text-xs"
          >
            {[1, 2, 3, 4].map((t) => (
              <option key={t} value={t}>
                Tầng {t}
              </option>
            ))}
          </select>
          <label className="sm:col-span-2 inline-flex items-center gap-1.5 text-xs font-medium text-[#14241B] cursor-pointer">
            <input
              type="checkbox"
              checked={nodeShared}
              onChange={(e) => setNodeShared(e.target.checked)}
              className="accent-[#15803D]"
            />
            <span>Liên thông</span>
          </label>
          <button
            type="button"
            onClick={handleAddClick}
            className="sm:col-span-1 inline-flex items-center justify-center py-1.5 px-2 rounded-lg bg-[#15803D] text-white text-xs font-bold hover:bg-[#166534] cursor-pointer"
            title="Thêm khái niệm mới"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Tiered Nodes Canvas */}
        <div className="p-5 bg-[#F6F8F5] space-y-5">
          {loadingGraph ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-24 rounded-xl bg-white animate-pulse" />
              ))}
            </div>
          ) : nodes.length === 0 ? (
            <div className="p-8 rounded-xl bg-white border border-dashed border-[#D8E2D8] text-center text-xs text-[#57534E]">
              Đồ thị chưa có khái niệm nào. Hãy thêm khái niệm Tầng 1 đầu tiên ở thanh công cụ phía trên.
            </div>
          ) : (
            [1, 2, 3, 4].map((tierNum) => {
              const tierNodes = nodes.filter(
                (n) => n.tier === tierNum && (canvasFilter === 'all' || n.is_shared),
              )
              if (tierNodes.length === 0) return null
              const meta = TIER_HEADER_META[tierNum]

              return (
                <div key={tierNum} className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${meta.dotColor}`} />
                    <span className="font-extrabold text-xs uppercase tracking-wider text-[#14241B]">
                      {meta.title}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {tierNodes.map((node) => {
                      const isSelected = selectedNodeSlug === node.slug
                      const inCycle = cycleAnalysis.cycleNodeSet.has(node.slug)
                      const coveredTiers = [1, 2, 3, 4, 5].filter(
                        (t) => (node.question_counts_by_tier[String(t)] ?? 0) > 0,
                      ).length

                      return (
                        <div
                          key={node.slug}
                          onClick={() => onSelectNode(node.slug)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              onSelectNode(node.slug)
                            }
                          }}
                          className={`relative p-3.5 rounded-xl bg-white transition-all cursor-pointer text-left ${
                            inCycle
                              ? 'ring-2 ring-[#9F1239] bg-[#FFF1F2]/60'
                              : isSelected
                                ? 'ring-2 ring-[#15803D] shadow-sm'
                                : 'border border-[#D8E2D8] hover:border-[#15803D]/60'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <span className="font-mono text-xs font-bold text-[#15803D] truncate">
                              {node.slug}
                            </span>
                            {node.is_shared && (
                              <span className="px-2 py-0.5 rounded-full bg-[#EFF6FF] border border-[#93C5FD] text-[#1D4ED8] text-[10px] font-bold shrink-0">
                                Liên thông
                              </span>
                            )}
                          </div>

                          <h3 className="font-bold text-xs text-[#14241B] leading-snug mb-2">
                            {node.title}
                          </h3>

                          <div className="flex items-center justify-between text-[10px] font-mono text-[#57534E] pt-2 border-t border-[#E7EFE7]">
                            <span>
                              In: {node.prerequisites.length} | Out: {outDegreeMap[node.slug] ?? 0}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <span
                                className={
                                  coveredTiers < 5
                                    ? 'text-[#D97706] font-bold'
                                    : 'text-[#15803D] font-bold'
                                }
                                title="Số tầng sâu đã có câu hỏi"
                              >
                                Đề: {coveredTiers}/5
                              </span>
                              {node.has_code_challenge && (
                                <span className="px-1.5 py-0.5 rounded bg-[#F0FDFA] text-[#0F766E] font-bold">
                                  Code
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Prerequisite Edges Table */}
      <div className="bg-white rounded-2xl border border-[#D8E2D8] p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitMerge className="w-4 h-4 text-[#0D9488]" aria-hidden="true" />
            <h2 className="font-bold text-sm text-[#14241B]">
              Danh sách Cạnh Tiên quyết ({allEdges.length})
            </h2>
          </div>
          <span className="text-[11px] font-mono text-[#57534E]">
            {cycleAnalysis.hasCycle ? 'Có cạnh gây chu trình (tô đỏ)' : 'Thứ tự Topo hợp lệ'}
          </span>
        </div>

        {allEdges.length === 0 ? (
          <p className="text-xs text-[#57534E]">Chưa có cạnh tiên quyết nào trong đồ thị này.</p>
        ) : (
          <div className="overflow-x-auto max-h-56 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#F6F8F5] text-[#57534E] font-mono text-[11px] uppercase">
                  <th className="py-2 px-3">Tiên quyết (Source)</th>
                  <th className="py-2 px-3">Khái niệm mở khóa (Target)</th>
                  <th className="py-2 px-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="font-mono text-[11px] divide-y divide-[#E7EFE7]">
                {allEdges.map((edge) => {
                  const edgeKey = `${edge.source}->${edge.target}`
                  const isCyclicEdge = cycleAnalysis.cycleEdgeKeys.has(edgeKey)
                  return (
                    <tr
                      key={edgeKey}
                      className={
                        isCyclicEdge
                          ? 'bg-[#FFF1F2] text-[#9F1239] font-bold'
                          : 'hover:bg-[#F6F8F5]'
                      }
                    >
                      <td className="py-2 px-3 font-bold">{edge.source}</td>
                      <td className="py-2 px-3">{edge.target}</td>
                      <td className="py-2 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => onTogglePrereq(edge.target, edge.source)}
                          className="text-[#9F1239] hover:underline cursor-pointer"
                        >
                          Gỡ cạnh
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
