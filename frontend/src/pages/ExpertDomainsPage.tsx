import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Code2,
  Eye,
  FileQuestion,
  GitBranch,
  GitMerge,
  Layers,
  Network,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react'
import {
  apiExpertCreateDomain,
  apiExpertGetDomainGraph,
  apiExpertPatchPlaybook,
  apiExpertUpdateGraph,
  apiGetDomains,
} from '../api'
import { MarkdownRenderer } from '../components/ui/MarkdownRenderer'
import { useDagTopologyEditor } from '../hooks/useDagTopologyEditor'
import { useOptionalBackOfficeStudio } from '../shells/BackOfficeStudioContext'
import type { BackOfficeView } from '../types/expert'
import type { DomainListItem } from '../types/learnerV2'

export interface ExpertDomainsPageProps {
  onNavigate: (view: BackOfficeView, params?: { domainSlug?: string; conceptSlug?: string }) => void
}

const TIER_HEADER_META: Record<number, { title: string; dotColor: string }> = {
  1: { title: 'Tầng 1: Nền tảng & Khái niệm Gốc', dotColor: 'bg-[#0D9488]' },
  2: { title: 'Tầng 2: Cơ chế Cốt lõi & Giao thức', dotColor: 'bg-[#15803D]' },
  3: { title: 'Tầng 3: Kiến trúc Ứng dụng & Tích hợp', dotColor: 'bg-[#D97706]' },
  4: { title: 'Tầng 4: Chuyên sâu, Bảo mật & Vận hành', dotColor: 'bg-[#9F1239]' },
}

export function ExpertDomainsPage({ onNavigate }: ExpertDomainsPageProps) {
  const studio = useOptionalBackOfficeStudio()
  const [localDomains, setLocalDomains] = useState<DomainListItem[]>([])
  const [localSelectedDomain, setLocalSelectedDomain] = useState('backend')

  const domains = studio ? studio.domains : localDomains
  const selectedDomain = studio ? studio.selectedDomainSlug : localSelectedDomain
  const setSelectedDomain = studio ? studio.setSelectedDomainSlug : setLocalSelectedDomain

  const [graphVersion, setGraphVersion] = useState<number>(1)
  const [canvasFilter, setCanvasFilter] = useState<'all' | 'shared'>('all')
  const [loadingGraph, setLoadingGraph] = useState(false)
  const [inspectorTab, setInspectorTab] = useState<'meta' | 'lesson'>('meta')
  const [lessonPreview, setLessonPreview] = useState(false)

  // New domain form
  const [showNewDomainForm, setShowNewDomainForm] = useState(false)
  const [newSlug, setNewSlug] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [creatingDomain, setCreatingDomain] = useState(false)

  // New node strip
  const [nodeSlug, setNodeSlug] = useState('')
  const [nodeTitle, setNodeTitle] = useState('')
  const [nodeTier, setNodeTier] = useState(1)
  const [nodeShared, setNodeShared] = useState(false)

  // Confirmation modal for destructive node removal
  const [confirmRemoveSlug, setConfirmRemoveSlug] = useState<string | null>(null)

  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [savingPlaybook, setSavingPlaybook] = useState(false)

  async function handleQuickSavePlaybook(slug: string, markdown: string) {
    setSavingPlaybook(true)
    setErrorMsg(null)
    setStatusMsg(null)
    try {
      const res = await apiExpertPatchPlaybook(slug, markdown)
      setStatusMsg(
        `Đã lưu nhanh Playbook '${res.concept_slug}' (${res.markdown_length} ký tự, đồng bộ ${res.updated_domains_count} ngành).`,
      )
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Không thể lưu Playbook')
    } finally {
      setSavingPlaybook(false)
    }
  }

  const editor = useDagTopologyEditor()
  const {
    nodes,
    selectedNode,
    allEdges,
    outDegreeMap,
    cycleAnalysis,
    isDirty,
    loadFromServer,
    selectNode,
    addNode,
    removeNode,
    updateNode,
    togglePrereq,
    discardChanges,
    commitSnapshot,
  } = editor

  useEffect(() => {
    studio?.setIsDirty(isDirty)
    return () => studio?.setIsDirty(false)
  }, [isDirty, studio])

  useEffect(() => {
    if (selectedNode && studio) {
      studio.setSelectedConceptSlug(selectedNode.slug)
    }
  }, [selectedNode, studio])

  const loadDomainGraph = useCallback(
    async (slug: string, preferredConcept?: string | null) => {
      setLoadingGraph(true)
      setErrorMsg(null)
      try {
        const graph = await apiExpertGetDomainGraph(slug)
        setGraphVersion(graph.graph_version)
        loadFromServer(graph.nodes, preferredConcept ?? studio?.selectedConceptSlug)
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Không thể tải đồ thị lĩnh vực')
        loadFromServer([])
      } finally {
        setLoadingGraph(false)
      }
    },
    [loadFromServer, studio?.selectedConceptSlug],
  )

  const loadDomainsList = useCallback(async () => {
    if (studio) {
      const list = await studio.refreshDomains()
      if (list.length > 0) {
        const target = list.some((d) => d.slug === selectedDomain) ? selectedDomain : list[0].slug
        setSelectedDomain(target)
        await loadDomainGraph(target)
      }
      return
    }
    try {
      const res = await apiGetDomains()
      setLocalDomains(res.domains)
      if (res.domains.length > 0) {
        const target = res.domains.some((d) => d.slug === selectedDomain)
          ? selectedDomain
          : res.domains[0].slug
        setLocalSelectedDomain(target)
        await loadDomainGraph(target)
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Không thể tải danh sách lĩnh vực')
    }
  }, [studio, selectedDomain, setSelectedDomain, loadDomainGraph])

  useEffect(() => {
    void loadDomainsList()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleSelectDomain(slug: string) {
    const proceed = () => {
      setSelectedDomain(slug)
      setStatusMsg(null)
      void loadDomainGraph(slug, null)
    }
    if (studio) {
      studio.requestGuardedAction(proceed)
    } else {
      proceed()
    }
  }

  async function handleCreateDomain(e: React.FormEvent) {
    e.preventDefault()
    if (!newSlug.trim() || !newTitle.trim()) return
    setCreatingDomain(true)
    setErrorMsg(null)
    setStatusMsg(null)
    try {
      const created = await apiExpertCreateDomain({
        slug: newSlug.trim(),
        title: newTitle.trim(),
        description: newDesc.trim() || `Lộ trình ${newTitle.trim()}`,
      })
      setNewSlug('')
      setNewTitle('')
      setNewDesc('')
      setShowNewDomainForm(false)
      setStatusMsg(`Đã tạo lĩnh vực mới '${created.title}' (${created.slug}).`)
      if (studio) {
        await studio.refreshDomains()
      } else {
        const res = await apiGetDomains()
        setLocalDomains(res.domains)
      }
      setSelectedDomain(created.slug)
      setGraphVersion(created.graph_version)
      loadFromServer([])
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Không thể tạo lĩnh vực mới')
    } finally {
      setCreatingDomain(false)
    }
  }

  function handleAddNode() {
    const cleanSlug = nodeSlug.trim()
    if (!cleanSlug || !nodeTitle.trim()) return
    if (nodes.some((n) => n.slug === cleanSlug)) {
      setErrorMsg(`Khái niệm '${cleanSlug}' đã tồn tại trong đồ thị.`)
      return
    }
    setErrorMsg(null)
    addNode({
      slug: cleanSlug,
      title: nodeTitle.trim(),
      tier: nodeTier,
      is_shared: nodeShared,
      lesson_markdown: `## ${nodeTitle.trim()}\n\n### 1. Bản chất & Mục tiêu\nNhập nội dung bài giảng tại đây.\n`,
      prerequisites: [],
      question_counts_by_tier: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
      has_code_challenge: false,
    })
    setNodeSlug('')
    setNodeTitle('')
    setNodeTier(1)
    setNodeShared(false)
    setInspectorTab('lesson')
  }

  async function handlePublish() {
    if (!selectedDomain || cycleAnalysis.hasCycle) return
    setSubmitting(true)
    setErrorMsg(null)
    setStatusMsg(null)
    try {
      const edges = nodes.flatMap((n) =>
        n.prerequisites.map((p) => ({ concept_slug: n.slug, prereq_slug: p })),
      )
      const res = await apiExpertUpdateGraph(selectedDomain, {
        nodes: nodes.map((n) => ({
          slug: n.slug,
          title: n.title,
          tier: n.tier,
          is_shared: n.is_shared,
          lesson_markdown: n.lesson_markdown,
        })),
        edges,
      })
      setGraphVersion(res.graph_version)
      commitSnapshot()
      setStatusMsg(
        `Đã xuất bản đồ thị '${res.domain_slug}' phiên bản v${res.graph_version} (${res.total_nodes} khái niệm, ${edges.length} cạnh tiên quyết).`,
      )
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Lỗi kiểm tra đồ thị DAG')
    } finally {
      setSubmitting(false)
    }
  }

  const sharedNodesCount = useMemo(() => nodes.filter((n) => n.is_shared).length, [nodes])

  return (
    <section
      className="w-full space-y-5 text-[#14241B]"
      data-testid="scr15-expert-domains"
    >
      {/* Top Control Bar */}
      <div className="bg-white rounded-2xl border border-[#D8E2D8] p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-[#F6F8F5] border border-[#D8E2D8]">
              <Network className="w-4 h-4 text-[#15803D] shrink-0" aria-hidden="true" />
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-mono tracking-wider text-[#57534E] font-bold">
                  Lĩnh vực đang biên tập
                </span>
                <div className="flex items-center gap-2">
                  <select
                    aria-label="Chọn lĩnh vực DAG"
                    value={selectedDomain}
                    onChange={(e) => handleSelectDomain(e.target.value)}
                    className="font-bold text-sm text-[#14241B] bg-transparent focus:outline-none cursor-pointer"
                  >
                    {domains.map((d) => (
                      <option key={d.slug} value={d.slug}>
                        {d.title} ({d.slug})
                      </option>
                    ))}
                  </select>
                  <span className="text-[11px] font-mono text-[#57534E] bg-white border border-[#D8E2D8] px-2 py-0.5 rounded">
                    v{graphVersion} • {nodes.length} nodes • {allEdges.length} edges
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void loadDomainGraph(selectedDomain)}
                className="p-1.5 rounded-lg text-[#57534E] hover:text-[#15803D] hover:bg-white cursor-pointer"
                title="Tải lại đồ thị từ máy chủ"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${loadingGraph ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowNewDomainForm((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] hover:bg-[#DCFCE7] text-[#14532D] text-xs font-bold cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#15803D]" aria-hidden="true" />
              <span>Tạo Lĩnh vực Mới</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isDirty && (
              <button
                type="button"
                onClick={discardChanges}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F6F8F5] border border-[#D8E2D8] hover:bg-white text-xs font-semibold text-[#3F5247] cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Hoàn tác thay đổi</span>
              </button>
            )}
            <button
              type="button"
              disabled={submitting || nodes.length === 0 || cycleAnalysis.hasCycle}
              onClick={() => void handlePublish()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#15803D] hover:bg-[#166534] disabled:opacity-45 disabled:cursor-not-allowed text-white text-xs font-bold shadow-xs cursor-pointer"
              data-testid="expert-publish-dag-btn"
            >
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
              <span>
                {submitting
                  ? 'Đang xuất bản đồ thị...'
                  : cycleAnalysis.hasCycle
                    ? 'Đang có chu trình — Không thể xuất bản'
                    : 'Kiểm tra Chu trình & Xuất bản Đồ thị'}
              </span>
            </button>
          </div>
        </div>

        {/* Collapsible Create Domain Form */}
        {showNewDomainForm && (
          <form
            onSubmit={handleCreateDomain}
            className="p-4 rounded-xl bg-[#F6F8F5] border border-[#D8E2D8] grid grid-cols-1 sm:grid-cols-12 gap-3 items-center"
          >
            <input
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              placeholder="Mã slug (vd: data-engineering)"
              className="sm:col-span-3 rounded-lg border border-[#D8E2D8] bg-white px-3 py-2 text-xs font-mono focus:border-[#15803D] focus:outline-none"
              required
            />
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Tên lĩnh vực (vd: Kỹ thuật Dữ liệu)"
              className="sm:col-span-4 rounded-lg border border-[#D8E2D8] bg-white px-3 py-2 text-xs focus:border-[#15803D] focus:outline-none"
              required
            />
            <input
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Mô tả lộ trình..."
              className="sm:col-span-3 rounded-lg border border-[#D8E2D8] bg-white px-3 py-2 text-xs focus:border-[#15803D] focus:outline-none"
            />
            <div className="sm:col-span-2 flex items-center gap-1.5">
              <button
                type="submit"
                disabled={creatingDomain}
                className="flex-1 py-2 px-3 rounded-lg bg-[#15803D] text-white text-xs font-bold hover:bg-[#166534] cursor-pointer"
              >
                {creatingDomain ? 'Đang tạo...' : 'Tạo'}
              </button>
              <button
                type="button"
                onClick={() => setShowNewDomainForm(false)}
                className="p-2 rounded-lg bg-white border border-[#D8E2D8] text-[#57534E] cursor-pointer"
                title="Đóng"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </form>
        )}

        {/* Real-time Client-side Kahn/DFS Validation Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#E7EFE7] text-xs">
          {cycleAnalysis.hasCycle ? (
            <div
              role="alert"
              data-testid="live-dag-cycle-alert"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#FFF1F2] border border-[#FDA4AF] text-[#9F1239] font-bold"
            >
              <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>
                Phát hiện chu trình DAG: {cycleAnalysis.cyclePath.join(' -> ')}
              </span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0] text-[#14532D] font-semibold">
              <CheckCircle2 className="w-4 h-4 text-[#15803D]" aria-hidden="true" />
              <span>
                Đồ thị hợp lệ (Không chu trình) • {sharedNodesCount} khái niệm liên thông đa lĩnh vực
              </span>
            </div>
          )}

          {isDirty && (
            <span className="text-[11px] font-semibold text-[#B45309]">
              Có thay đổi chưa xuất bản lên hệ thống học viên
            </span>
          )}
        </div>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="p-3.5 rounded-xl bg-[#FFF1F2] border border-[#FDA4AF] text-xs font-bold text-[#9F1239] flex items-center gap-2"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}

      {statusMsg && (
        <div className="p-3.5 rounded-xl bg-[#F0FDF4] border border-[#86EFAC] text-xs font-bold text-[#14532D] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0" aria-hidden="true" />
          <span>{statusMsg}</span>
        </div>
      )}

      {/* Two-Column Workspace: Left DAG Canvas (7 cols) + Right Node & Lesson Inspector (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
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
                onClick={handleAddNode}
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
                          const isSelected = selectedNode?.slug === node.slug
                          const inCycle = cycleAnalysis.cycleNodeSet.has(node.slug)
                          const coveredTiers = [1, 2, 3, 4, 5].filter(
                            (t) => (node.question_counts_by_tier[String(t)] ?? 0) > 0,
                          ).length

                          return (
                            <div
                              key={node.slug}
                              onClick={() => selectNode(node.slug)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  selectNode(node.slug)
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
                                      coveredTiers < 5 ? 'text-[#D97706] font-bold' : 'text-[#15803D] font-bold'
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
                              onClick={() => togglePrereq(edge.target, edge.source)}
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

        {/* RIGHT COLUMN: Node Inspector + Lesson Markdown Editor (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-white rounded-2xl border border-[#D8E2D8] p-5 shadow-xs space-y-4">
            {!selectedNode ? (
              <div className="p-6 text-center text-xs text-[#57534E]">
                Chọn một khái niệm trên đồ thị bên trái để chỉnh sửa thuộc tính, cạnh tiên quyết và nội dung bài giảng.
              </div>
            ) : (
              <>
                {/* Inspector Header */}
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#E7EFE7]">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded bg-[#F0FDF4] border border-[#BBF7D0] font-mono text-xs font-bold text-[#15803D]">
                        {selectedNode.slug}
                      </span>
                      <span className="text-[11px] font-mono text-[#57534E]">
                        Tầng {selectedNode.tier}/4
                      </span>
                    </div>
                    <h2 className="font-extrabold text-base text-[#14241B] mt-1">
                      {selectedNode.title}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmRemoveSlug(selectedNode.slug)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#9F1239] hover:bg-[#FFF1F2] cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Xóa Node</span>
                  </button>
                </div>

                {/* Inspector Tabs: Properties vs Lesson Markdown */}
                <div className="flex items-center gap-1 p-1 rounded-xl bg-[#F6F8F5] border border-[#D8E2D8] text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setInspectorTab('meta')}
                    className={`flex-1 py-1.5 px-3 rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer ${
                      inspectorTab === 'meta'
                        ? 'bg-white text-[#14241B] shadow-2xs'
                        : 'text-[#57534E] hover:text-[#14241B]'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Thuộc tính &amp; Cạnh</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInspectorTab('lesson')}
                    className={`flex-1 py-1.5 px-3 rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer ${
                      inspectorTab === 'lesson'
                        ? 'bg-white text-[#15803D] shadow-2xs'
                        : 'text-[#57534E] hover:text-[#14241B]'
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Bài giảng Playbook (Markdown)</span>
                  </button>
                </div>

                {inspectorTab === 'meta' ? (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label
                        htmlFor="inspector-node-title"
                        className="text-xs font-bold text-[#14241B] block"
                      >
                        Tên hiển thị tiếng Việt
                      </label>
                      <input
                        id="inspector-node-title"
                        type="text"
                        value={selectedNode.title}
                        onChange={(e) => updateNode(selectedNode.slug, { title: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-[#D8E2D8] bg-[#F6F8F5] text-xs font-medium focus:bg-white focus:border-[#15803D] focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label
                          htmlFor="inspector-node-tier"
                          className="text-xs font-bold text-[#14241B] block"
                        >
                          Tầng DAG (1–4)
                        </label>
                        <select
                          id="inspector-node-tier"
                          value={selectedNode.tier}
                          onChange={(e) =>
                            updateNode(selectedNode.slug, { tier: Number(e.target.value) })
                          }
                          className="w-full px-3 py-2 rounded-lg border border-[#D8E2D8] bg-[#F6F8F5] text-xs font-semibold focus:border-[#15803D] focus:outline-none"
                        >
                          {[1, 2, 3, 4].map((t) => (
                            <option key={t} value={t}>
                              Tầng {t}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-xs font-bold text-[#14241B] block">
                          Liên thông đa lĩnh vực
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            updateNode(selectedNode.slug, { is_shared: !selectedNode.is_shared })
                          }
                          className={`w-full px-3 py-2 rounded-lg text-xs font-bold border cursor-pointer ${
                            selectedNode.is_shared
                              ? 'bg-[#EFF6FF] border-[#93C5FD] text-[#1D4ED8]'
                              : 'bg-[#F6F8F5] border-[#D8E2D8] text-[#57534E]'
                          }`}
                        >
                          {selectedNode.is_shared ? 'Khái niệm Liên thông' : 'Nội bộ Lĩnh vực'}
                        </button>
                      </div>
                    </div>

                    {/* Prerequisite Toggle Chips */}
                    <div className="space-y-2 pt-2 border-t border-[#E7EFE7]">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[#14241B]">
                          Cạnh Tiên quyết Trực tiếp ({selectedNode.prerequisites.length})
                        </span>
                        <span className="text-[11px] text-[#57534E]">Nhấp để bật/tắt</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto p-1">
                        {nodes
                          .filter((other) => other.slug !== selectedNode.slug)
                          .map((other) => {
                            const checked = selectedNode.prerequisites.includes(other.slug)
                            const edgeKey = `${other.slug}->${selectedNode.slug}`
                            const cyclic = cycleAnalysis.cycleEdgeKeys.has(edgeKey)
                            return (
                              <button
                                key={other.slug}
                                type="button"
                                onClick={() => togglePrereq(selectedNode.slug, other.slug)}
                                className={`px-2.5 py-1 rounded-lg border font-mono text-[11px] cursor-pointer ${
                                  cyclic
                                    ? 'bg-[#9F1239] text-white border-[#9F1239] font-bold'
                                    : checked
                                      ? 'bg-[#15803D] text-white border-[#15803D] font-bold'
                                      : 'bg-[#F6F8F5] text-[#3F5247] border-[#D8E2D8] hover:border-[#15803D]'
                                }`}
                              >
                                [T{other.tier}] {other.slug}
                              </button>
                            )
                          })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3" data-testid="lesson-markdown-editor-panel">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#14241B]">
                        Nội dung Playbook ({selectedNode.lesson_markdown.length} ký tự)
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={savingPlaybook || selectedNode.lesson_markdown.trim().length < 10}
                          onClick={() =>
                            void handleQuickSavePlaybook(
                              selectedNode.slug,
                              selectedNode.lesson_markdown,
                            )
                          }
                          data-testid="quick-save-playbook-btn"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#15803D] hover:bg-[#166534] disabled:opacity-45 text-white text-[11px] font-bold cursor-pointer"
                        >
                          <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{savingPlaybook ? 'Đang lưu...' : 'Lưu riêng Playbook'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setLessonPreview((p) => !p)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#F6F8F5] border border-[#D8E2D8] text-[11px] font-semibold text-[#14241B] cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#15803D]" aria-hidden="true" />
                          <span>{lessonPreview ? 'Quay về Soạn thảo' : 'Xem trước Playbook'}</span>
                        </button>
                      </div>
                    </div>

                    {lessonPreview ? (
                      <div className="p-4 rounded-xl bg-[#F6F8F5] border border-[#D8E2D8] max-h-96 overflow-y-auto">
                        <MarkdownRenderer markdown={selectedNode.lesson_markdown} />
                      </div>
                    ) : (
                      <textarea
                        aria-label="Nội dung bài giảng Playbook Markdown"
                        rows={12}
                        value={selectedNode.lesson_markdown}
                        onChange={(e) =>
                          updateNode(selectedNode.slug, { lesson_markdown: e.target.value })
                        }
                        placeholder="Nhập nội dung bài giảng Markdown (tiêu đề ##, khối code ```, danh sách -)..."
                        className="w-full rounded-xl border border-[#D8E2D8] bg-[#F6F8F5] p-3 text-xs font-mono text-[#14241B] focus:bg-white focus:border-[#15803D] focus:outline-none leading-relaxed"
                      />
                    )}
                  </div>
                )}

                {/* Context-Preserving Jump Links to Questions & Code Challenges */}
                <div className="pt-3 border-t border-[#E7EFE7] grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onNavigate('expert_questions', {
                        domainSlug: selectedDomain,
                        conceptSlug: selectedNode.slug,
                      })
                    }
                    className="py-2 px-3 rounded-xl bg-[#15803D] hover:bg-[#166534] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <FileQuestion className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Đề 5 Tầng &amp; Rubric</span>
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onNavigate('expert_code', {
                        domainSlug: selectedDomain,
                        conceptSlug: selectedNode.slug,
                      })
                    }
                    className="py-2 px-3 rounded-xl bg-[#F6F8F5] border border-[#D8E2D8] hover:border-[#15803D] text-[#14241B] text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Code2 className="w-3.5 h-3.5 text-[#0D9488]" aria-hidden="true" />
                    <span>Bài tập Code Sandbox</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Confirm Remove Node Modal */}
      {confirmRemoveSlug && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white max-w-md w-full rounded-2xl border border-[#D8E2D8] p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FFF1F2] border border-[#FDA4AF] flex items-center justify-center text-[#9F1239]">
                <Trash2 className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-[#14241B]">
                  Xác nhận xóa khái niệm khỏi đồ thị
                </h3>
                <p className="text-xs text-[#57534E]">
                  Khái niệm <code className="font-mono font-bold">{confirmRemoveSlug}</code> và các
                  cạnh tiên quyết liên kết sẽ bị gỡ khỏi bản nháp đồ thị.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmRemoveSlug(null)}
                className="px-4 py-2 rounded-lg bg-[#F6F8F5] border border-[#D8E2D8] text-xs font-semibold text-[#14241B] cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  removeNode(confirmRemoveSlug)
                  setConfirmRemoveSlug(null)
                }}
                className="px-4 py-2 rounded-lg bg-[#9F1239] hover:bg-[#881337] text-xs font-bold text-white cursor-pointer"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
