import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Code2,
  FileQuestion,
  GitBranch,
  GitMerge,
  Info,
  Layers,
  Network,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react'
import {
  apiExpertCreateDomain,
  apiExpertUpdateGraph,
  apiGetDomainRoadmap,
  apiGetDomains,
} from '../api'
import type { ActiveView, DomainListItem } from '../types'

interface ExpertDomainsPageProps {
  onNavigate: (view: ActiveView) => void
}

interface EditableNode {
  slug: string
  title: string
  tier: number
  is_shared: boolean
  lesson_markdown?: string
  prerequisites: string[]
}

const TIER_HEADER_META: Record<
  number,
  { title: string; dotColor: string; degreeNote: string }
> = {
  1: {
    title: 'Tầng 1: Nền tảng Hệ thống & Giao thức (Foundations)',
    dotColor: 'bg-secondary',
    degreeNote: 'In-degree: 0 (Gốc không phụ thuộc)',
  },
  2: {
    title: 'Tầng 2: Cơ chế Cốt lõi & Điều phối (Core Mechanics)',
    dotColor: 'bg-primary',
    degreeNote: 'In-degree: 1 - 2',
  },
  3: {
    title: 'Tầng 3: Kiến trúc Ứng dụng & Trạng thái Phân tán (Applied Architecture)',
    dotColor: 'bg-tertiary',
    degreeNote: 'Trọng số Bloom L3 - L4',
  },
  4: {
    title: 'Tầng 4: Hệ thống Phân tán & Chuyên sâu (Capstone)',
    dotColor: 'bg-error-dim',
    degreeNote: 'Đỉnh lá (Bloom L4 - L5)',
  },
}

export function ExpertDomainsPage({ onNavigate }: ExpertDomainsPageProps) {
  const [domains, setDomains] = useState<DomainListItem[]>([])
  const [selectedDomain, setSelectedDomain] = useState<string>('backend')
  const [nodes, setNodes] = useState<EditableNode[]>([])
  const [selectedNodeSlug, setSelectedNodeSlug] = useState<string | null>(null)
  const [canvasFilter, setCanvasFilter] = useState<'all' | 'shared'>('all')
  const [loadingDomains, setLoadingDomains] = useState(true)
  const [loadingGraph, setLoadingGraph] = useState(false)

  // New domain form
  const [showNewDomainForm, setShowNewDomainForm] = useState(false)
  const [newSlug, setNewSlug] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [creatingDomain, setCreatingDomain] = useState(false)

  // New node form
  const [nodeSlug, setNodeSlug] = useState('')
  const [nodeTitle, setNodeTitle] = useState('')
  const [nodeTier, setNodeTier] = useState(1)
  const [nodeShared, setNodeShared] = useState(false)

  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const loadDomainGraph = useCallback(async (slug: string) => {
    setLoadingGraph(true)
    setErrorMsg(null)
    try {
      const rm = await apiGetDomainRoadmap(slug, 0)
      // Gate 3 invariant: DO NOT overwrite lesson_markdown for existing nodes with `## ${n.title}`
      const mapped: EditableNode[] = rm.nodes.map((n) => ({
        slug: n.slug,
        title: n.title,
        tier: n.tier,
        is_shared: n.is_shared,
        prerequisites: [...n.prerequisites],
      }))
      setNodes(mapped)
      setSelectedNodeSlug(mapped.length > 0 ? mapped[0].slug : null)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Không thể tải đồ thị lĩnh vực')
      setNodes([])
      setSelectedNodeSlug(null)
    } finally {
      setLoadingGraph(false)
    }
  }, [])

  const loadDomains = useCallback(async () => {
    setLoadingDomains(true)
    setErrorMsg(null)
    try {
      const data = await apiGetDomains()
      setDomains(data.domains)
      if (data.domains.length > 0) {
        const target = data.domains.some((d) => d.slug === selectedDomain)
          ? selectedDomain
          : data.domains[0].slug
        setSelectedDomain(target)
        await loadDomainGraph(target)
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Không thể tải danh sách lĩnh vực')
    } finally {
      setLoadingDomains(false)
    }
  }, [loadDomainGraph, selectedDomain])

  useEffect(() => {
    void loadDomains()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSelectDomain(slug: string) {
    setSelectedDomain(slug)
    setStatusMsg(null)
    await loadDomainGraph(slug)
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
      const data = await apiGetDomains()
      setDomains(data.domains)
      setSelectedDomain(created.slug)
      setNodes([])
      setSelectedNodeSlug(null)
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
      setErrorMsg(`Node '${cleanSlug}' đã tồn tại trong đồ thị.`)
      return
    }
    setErrorMsg(null)
    const newNode: EditableNode = {
      slug: cleanSlug,
      title: nodeTitle.trim(),
      tier: nodeTier,
      is_shared: nodeShared,
      lesson_markdown: `## ${nodeTitle.trim()}`,
      prerequisites: [],
    }
    setNodes((prev) => [...prev, newNode])
    setSelectedNodeSlug(cleanSlug)
    setNodeSlug('')
    setNodeTitle('')
    setNodeTier(1)
    setNodeShared(false)
  }

  function handleRemoveNode(slug: string) {
    setNodes((prev) => {
      const next = prev
        .filter((n) => n.slug !== slug)
        .map((n) => ({
          ...n,
          prerequisites: n.prerequisites.filter((p) => p !== slug),
        }))
      if (selectedNodeSlug === slug) {
        setSelectedNodeSlug(next.length > 0 ? next[0].slug : null)
      }
      return next
    })
  }

  function handleToggleShared(slug: string) {
    setNodes((prev) =>
      prev.map((n) => (n.slug === slug ? { ...n, is_shared: !n.is_shared } : n)),
    )
  }

  function handleUpdateNodeTitle(slug: string, title: string) {
    setNodes((prev) => prev.map((n) => (n.slug === slug ? { ...n, title } : n)))
  }

  function handleUpdateNodeTier(slug: string, tier: number) {
    setNodes((prev) => prev.map((n) => (n.slug === slug ? { ...n, tier } : n)))
  }

  function handleTogglePrereq(nodeSlugTarget: string, prereqSlug: string) {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.slug !== nodeSlugTarget) return n
        const exists = n.prerequisites.includes(prereqSlug)
        return {
          ...n,
          prerequisites: exists
            ? n.prerequisites.filter((p) => p !== prereqSlug)
            : [...n.prerequisites, prereqSlug],
        }
      }),
    )
  }

  async function handlePublish() {
    if (!selectedDomain) return
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
      setStatusMsg(
        `DAG Valid — Đã xuất bản đồ thị '${res.domain_slug}' phiên bản v${res.graph_version} (${nodes.length} nodes, ${edges.length} cạnh).`,
      )
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Lỗi kiểm tra chu trình DAG')
    } finally {
      setSubmitting(false)
    }
  }

  const allEdges = useMemo(
    () =>
      nodes.flatMap((n) =>
        n.prerequisites.map((p) => ({ source: p, target: n.slug })),
      ),
    [nodes],
  )

  const sharedNodesCount = useMemo(
    () => nodes.filter((n) => n.is_shared).length,
    [nodes],
  )

  const outDegreeMap = useMemo(() => {
    const map: Record<string, number> = {}
    for (const n of nodes) map[n.slug] = 0
    for (const e of allEdges) {
      map[e.source] = (map[e.source] ?? 0) + 1
    }
    return map
  }, [nodes, allEdges])

  const selectedNode = useMemo(
    () => nodes.find((n) => n.slug === selectedNodeSlug) ?? nodes[0] ?? null,
    [nodes, selectedNodeSlug],
  )

  const currentDomainMeta = domains.find((d) => d.slug === selectedDomain)

  return (
    <section
      className="w-full max-w-[1760px] mx-auto px-4 sm:px-6 pb-8 space-y-6 text-on-surface"
      data-testid="scr15-expert-domains"
    >
      {/* 1. TOP CONTROL & DAG VALIDATION BAR */}
      <div className="w-full bg-surface-container-lowest rounded-2xl border border-surface-container-high p-5 shadow-sm flex flex-col gap-4">
        {/* Upper row: Domain switcher, Studio nav & Publish action */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Domain Selector */}
            <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-surface-container-low border border-outline-variant/25">
              <Network className="w-5 h-5 text-primary shrink-0" aria-hidden="true" />
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-mono tracking-wider text-on-surface-variant font-bold">
                  Lĩnh vực đang chọn
                </span>
                <div className="flex items-center gap-2">
                  <select
                    aria-label="Chọn lĩnh vực DAG"
                    value={selectedDomain}
                    onChange={(e) => void handleSelectDomain(e.target.value)}
                    className="font-headline font-bold text-sm text-on-surface bg-transparent focus:outline-none cursor-pointer"
                  >
                    {domains.map((d) => (
                      <option key={d.slug} value={d.slug}>
                        {d.title} ({d.slug})
                      </option>
                    ))}
                  </select>
                  <span className="text-xs font-mono font-normal text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-md">
                    v{currentDomainMeta?.graph_version ?? 1} ({nodes.length} Nodes,{' '}
                    {allEdges.length} Edges)
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void loadDomains()}
                className="p-1.5 rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-container cursor-pointer transition-colors"
                title="Làm mới danh sách lĩnh vực"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${loadingDomains ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
              </button>
            </div>

            {/* Domain Quick Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {domains.map((d) => (
                <button
                  key={d.slug}
                  type="button"
                  onClick={() => void handleSelectDomain(d.slug)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    selectedDomain === d.slug
                      ? 'bg-primary-container text-on-primary-container shadow-2xs'
                      : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                  }`}
                >
                  {d.title}
                </button>
              ))}
            </div>

            {/* Toggle New Domain Drawer/Panel */}
            <button
              type="button"
              onClick={() => setShowNewDomainForm((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary-container/60 hover:bg-primary-container text-on-primary-container text-xs font-semibold transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 text-primary" aria-hidden="true" />
              <span>Tạo Lĩnh vực Mới (Không sửa code)</span>
            </button>
          </div>

          {/* Primary Right Actions & Studio Nav */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate('expert_questions')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-surface-container-low hover:bg-surface-container text-on-surface cursor-pointer transition-colors"
            >
              <FileQuestion className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
              <span>2. Ngân hàng Đề 5 Tầng &amp; Rubric</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('expert_code')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-surface-container-low hover:bg-surface-container text-on-surface cursor-pointer transition-colors"
            >
              <Code2 className="w-3.5 h-3.5 text-secondary" aria-hidden="true" />
              <span>3. Bài tập Code Sandbox</span>
            </button>
            <button
              type="button"
              disabled={submitting || nodes.length === 0}
              onClick={() => void handlePublish()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-dim disabled:opacity-45 text-on-primary text-xs font-bold shadow-sm transition-all cursor-pointer"
              data-testid="expert-publish-dag-btn"
            >
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
              <span>
                {submitting
                  ? 'Đang kiểm tra chu trình...'
                  : 'Kiểm tra Chu trình & Xuất bản Đồ thị'}
              </span>
            </button>
          </div>
        </div>

        {/* Collapsible New Domain Form */}
        {showNewDomainForm && (
          <form
            onSubmit={handleCreateDomain}
            className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center"
          >
            <input
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              placeholder="Mã slug (vd: data-engineering)"
              className="sm:col-span-3 rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 text-xs font-mono focus:border-primary focus:outline-none"
              required
            />
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Tên lĩnh vực (vd: Kỹ thuật Dữ liệu)"
              className="sm:col-span-4 rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 text-xs focus:border-primary focus:outline-none"
              required
            />
            <input
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Mô tả lộ trình..."
              className="sm:col-span-3 rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 text-xs focus:border-primary focus:outline-none"
            />
            <div className="sm:col-span-2 flex items-center gap-1.5">
              <button
                type="submit"
                disabled={creatingDomain}
                className="flex-1 inline-flex items-center justify-center gap-1 py-2 px-3 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary-dim cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{creatingDomain ? 'Đang tạo...' : 'Tạo'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowNewDomainForm(false)}
                className="p-2 rounded-xl bg-surface-container text-on-surface-variant hover:text-on-surface cursor-pointer"
                title="Đóng"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </form>
        )}

        {/* Lower row: Live Kahn's Algorithm Validation Status + Add Node Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-surface-container">
          <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-primary-container/40 text-on-surface text-xs flex-wrap">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
            </span>
            <span className="font-mono text-[11px] font-medium text-on-surface-variant">
              Topological Sort Engine:
            </span>
            <span className="font-semibold text-primary">
              Kahn&apos;s Acyclic Validator Active
            </span>
            <span className="text-outline-variant font-mono">|</span>
            <span className="text-[11px] font-mono text-secondary-dim font-medium">
              {sharedNodesCount} Node Giao thoa Liên thông (Cross-domain isomorphic)
            </span>
          </div>

          <div className="text-xs font-mono text-on-surface-variant">
            Studio Quản lý Knowledge Graph Đa lĩnh vực (SCR-15)
          </div>
        </div>
      </div>

      {/* Status & Cycle Detection Alerts */}
      {errorMsg && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-error-container/20 border border-error/30 text-on-surface flex items-start gap-3"
        >
          <AlertTriangle className="w-5 h-5 text-error shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-xs font-bold text-error">
              CẢNH BÁO KIỂM ĐỊNH ĐỒ THỊ DAG
            </span>
            <p className="text-xs text-on-surface">{errorMsg}</p>
          </div>
        </div>
      )}

      {statusMsg && (
        <div className="p-4 rounded-xl bg-primary-container/30 border border-primary/30 text-xs font-bold text-on-primary-container flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
          <span>{statusMsg}</span>
        </div>
      )}

      {/* 2. TWO-COLUMN STUDIO WORKSPACE (7/12 Canvas + 5/12 Node Inspector) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: INTERACTIVE TIERED DAG CANVAS (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="w-full bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/25 overflow-hidden flex flex-col">
            {/* Canvas Toolbar Header */}
            <div className="px-5 py-3.5 bg-surface-container-low/70 border-b border-surface-container flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-primary" aria-hidden="true" />
                <h1 className="font-headline font-bold text-xs uppercase tracking-wider text-on-surface">
                  Không gian Biên tập Cây Tri thức ({selectedDomain})
                </h1>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-surface-container text-on-surface-variant">
                  4 Tầng &bull; {nodes.length} Khái niệm
                </span>
              </div>

              {/* View Filter Pills */}
              <div className="flex items-center bg-surface-container rounded-lg p-0.5 text-xs font-medium text-on-surface-variant">
                <button
                  type="button"
                  onClick={() => setCanvasFilter('all')}
                  className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                    canvasFilter === 'all'
                      ? 'bg-surface-container-lowest text-primary font-semibold shadow-2xs'
                      : 'hover:text-on-surface'
                  }`}
                >
                  Tất cả ({nodes.length} nodes)
                </button>
                <button
                  type="button"
                  onClick={() => setCanvasFilter('shared')}
                  className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                    canvasFilter === 'shared'
                      ? 'bg-surface-container-lowest text-primary font-semibold shadow-2xs'
                      : 'hover:text-on-surface'
                  }`}
                >
                  Giao thoa ({sharedNodesCount} nodes)
                </button>
              </div>
            </div>

            {/* Add Node Quick Strip */}
            <div className="px-5 py-3 bg-surface-container-low border-b border-surface-container grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <input
                value={nodeSlug}
                onChange={(e) => setNodeSlug(e.target.value)}
                placeholder="slug node mới (vd: stream-kafka)"
                className="sm:col-span-3 rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-2.5 py-1.5 text-xs font-mono focus:border-primary focus:outline-none"
              />
              <input
                value={nodeTitle}
                onChange={(e) => setNodeTitle(e.target.value)}
                placeholder="Tên khái niệm hiển thị tiếng Việt"
                className="sm:col-span-4 rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-2.5 py-1.5 text-xs focus:border-primary focus:outline-none"
              />
              <select
                value={nodeTier}
                onChange={(e) => setNodeTier(Number(e.target.value))}
                className="sm:col-span-2 rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-2 py-1.5 text-xs"
              >
                {[1, 2, 3, 4].map((t) => (
                  <option key={t} value={t}>
                    Tầng {t}
                  </option>
                ))}
              </select>
              <label className="sm:col-span-2 inline-flex items-center gap-1.5 text-xs font-medium text-on-surface cursor-pointer">
                <input
                  type="checkbox"
                  checked={nodeShared}
                  onChange={(e) => setNodeShared(e.target.checked)}
                  className="accent-primary"
                />
                <span>Giao thoa</span>
              </label>
              <button
                type="button"
                onClick={handleAddNode}
                className="sm:col-span-1 inline-flex items-center justify-center py-1.5 px-2 rounded-lg bg-primary text-on-primary text-xs font-bold hover:bg-primary-dim cursor-pointer"
                title="Thêm node mới vào đồ thị"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {/* DAG Canvas Area with Dot Graph Pattern */}
            <div className="relative p-6 bg-[radial-gradient(#acb4af_1px,transparent_1px)] [background-size:18px_18px] bg-surface flex flex-col gap-6">
              {loadingGraph ? (
                <div className="space-y-4">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-24 rounded-xl bg-surface-container-low animate-pulse"
                    />
                  ))}
                </div>
              ) : nodes.length === 0 ? (
                <div className="p-8 rounded-xl bg-surface-container-lowest border border-dashed border-outline-variant text-center text-xs text-on-surface-variant">
                  Đồ thị chưa có khái niệm nào. Hãy thêm Root Node Tầng 1 đầu tiên ở thanh công cụ
                  phía trên.
                </div>
              ) : (
                [1, 2, 3, 4].map((tierNum) => {
                  const tierNodes = nodes.filter(
                    (n) =>
                      n.tier === tierNum && (canvasFilter === 'all' || n.is_shared),
                  )
                  if (tierNodes.length === 0) return null
                  const meta = TIER_HEADER_META[tierNum]

                  return (
                    <div key={tierNum} className="flex flex-col gap-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${meta.dotColor}`} />
                          <span className="font-headline font-extrabold text-xs uppercase tracking-wider text-on-surface">
                            {meta.title}
                          </span>
                        </div>
                        <span className="font-mono text-[11px] text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded">
                          {meta.degreeNote}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
                        {tierNodes.map((node) => {
                          const isSelected = selectedNode?.slug === node.slug
                          const outDeg = outDegreeMap[node.slug] ?? 0
                          return (
                            <div
                              key={node.slug}
                              onClick={() => setSelectedNodeSlug(node.slug)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  setSelectedNodeSlug(node.slug)
                                }
                              }}
                              className={`relative p-4 rounded-xl bg-surface-container-lowest transition-all cursor-pointer text-left ${
                                isSelected
                                  ? 'ring-2 ring-primary shadow-md bg-gradient-to-br from-primary-container/20 to-transparent'
                                  : 'border border-outline-variant/25 hover:shadow-md'
                              }`}
                            >
                              {isSelected && (
                                <div className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full bg-primary text-on-primary font-mono text-[9px] font-bold tracking-wider uppercase shadow-2xs">
                                  Đang chọn
                                </div>
                              )}

                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span
                                    className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                                      isSelected
                                        ? 'bg-primary-container text-on-primary-container'
                                        : 'bg-surface-container-high text-on-surface'
                                    }`}
                                  >
                                    <Layers className="w-3.5 h-3.5" aria-hidden="true" />
                                  </span>
                                  <span
                                    className={`font-mono text-xs font-bold truncate ${
                                      isSelected ? 'text-primary' : 'text-on-surface'
                                    }`}
                                  >
                                    {node.slug}
                                  </span>
                                </div>

                                {node.is_shared && (
                                  <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-mono text-[10px] font-semibold shrink-0">
                                    Giao thoa
                                  </span>
                                )}
                              </div>

                              <h3 className="font-headline font-bold text-xs text-on-surface leading-tight mb-2">
                                {node.title}
                              </h3>

                              <div className="flex items-center justify-between text-[10px] font-mono text-on-surface-variant pt-2 border-t border-surface-container">
                                <span>
                                  In: {node.prerequisites.length} | Out: {outDeg}
                                </span>
                                <span className="text-primary font-semibold">
                                  Tầng {node.tier}
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

          {/* Active Prerequisite Edges Summary Table */}
          <div className="w-full bg-surface-container-lowest rounded-2xl p-5 shadow-sm border border-outline-variant/25 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitMerge className="w-4 h-4 text-secondary" aria-hidden="true" />
                <h2 className="font-headline font-bold text-sm text-on-surface">
                  Danh sách Cạnh Tiên quyết Hiện hành ({allEdges.length} Active Edges)
                </h2>
              </div>
              <span className="text-xs font-mono text-on-surface-variant">
                Topological Sorted Order
              </span>
            </div>

            {allEdges.length === 0 ? (
              <p className="text-xs text-on-surface-variant">
                Chưa có cạnh tiên quyết nào trong đồ thị này.
              </p>
            ) : (
              <div className="overflow-x-auto max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs font-body">
                  <thead>
                    <tr className="bg-surface-container-low text-on-surface-variant font-mono text-[11px] uppercase tracking-wider">
                      <th className="py-2.5 px-3 rounded-l-lg">Node Tiên quyết (Source)</th>
                      <th className="py-2.5 px-3">Node Nhận (Target)</th>
                      <th className="py-2.5 px-3">Điều kiện Mở khóa</th>
                      <th className="py-2.5 px-3 text-right rounded-r-lg">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono text-[11px]">
                    {allEdges.map((edge) => {
                      const isRelated =
                        selectedNode?.slug === edge.source || selectedNode?.slug === edge.target
                      return (
                        <tr
                          key={`${edge.source}->${edge.target}`}
                          className={`hover:bg-surface-container-low transition-colors ${
                            isRelated ? 'bg-primary-container/15' : ''
                          }`}
                        >
                          <td className="py-2 px-3 text-primary font-bold">{edge.source}</td>
                          <td className="py-2 px-3 text-on-surface font-semibold">
                            {edge.target}
                          </td>
                          <td className="py-2 px-3">
                            <span className="px-2 py-0.5 rounded bg-primary-container/40 text-on-primary-container font-semibold">
                              Bắt buộc (&ge; 75%)
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleTogglePrereq(edge.target, edge.source)}
                              className="text-on-surface-variant hover:text-error transition-colors cursor-pointer"
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

        {/* RIGHT COLUMN: NODE & CROSS-DOMAIN LINK INSPECTOR (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="w-full bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/25 p-6 flex flex-col gap-5">
            {!selectedNode ? (
              <div className="p-6 text-center text-xs text-on-surface-variant">
                Chọn một khái niệm ở khung đồ thị bên trái để chỉnh sửa thuộc tính và cạnh tiên
                quyết.
              </div>
            ) : (
              <>
                {/* Inspector Header */}
                <div className="flex items-start justify-between gap-4 pb-4 border-b border-surface-container">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-full bg-primary-container text-on-primary-container font-mono text-xs font-bold">
                        {selectedNode.slug}
                      </span>
                      <span className="text-xs font-mono text-on-surface-variant bg-surface-container px-2 py-0.5 rounded">
                        Tầng {selectedNode.tier} / 4
                      </span>
                      <span className="text-xs font-mono text-secondary-dim font-medium">
                        {selectedDomain}
                      </span>
                    </div>
                    <h2 className="font-headline font-extrabold text-base text-on-surface">
                      Thông số Khái niệm (Node Inspector)
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveNode(selectedNode.slug)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-error hover:bg-error-container/20 transition-colors cursor-pointer"
                    title="Xóa node này khỏi đồ thị"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Xóa Node</span>
                  </button>
                </div>

                {/* Cross-Domain Mapping Section (GNN Transfer Learning Banner) */}
                <div className="p-4 rounded-xl bg-secondary-container/20 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GitMerge className="w-4 h-4 text-secondary" aria-hidden="true" />
                      <span className="font-headline font-bold text-xs uppercase tracking-wider text-on-surface">
                        Liên kết Khái niệm Giao thoa Dùng chung
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleShared(selectedNode.slug)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold cursor-pointer transition-colors ${
                        selectedNode.is_shared
                          ? 'bg-secondary text-on-secondary'
                          : 'bg-surface-container-high text-on-surface-variant'
                      }`}
                    >
                      {selectedNode.is_shared ? 'Giao thoa (Shared)' : 'Nội bộ Lĩnh vực'}
                    </button>
                  </div>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    Khái niệm giao thoa (Isomorphic) cho phép hệ thống GNN-PPO chuyển giao trực tiếp
                    vector năng lực 8 chiều giữa các lộ trình.
                  </p>
                  <div className="text-[11px] font-mono text-secondary-dim bg-secondary-fixed/30 p-2.5 rounded-lg flex items-center gap-2">
                    <Info className="w-4 h-4 text-secondary shrink-0" aria-hidden="true" />
                    <span>
                      Học viên đạt &ge; 75% ở lĩnh vực gốc sẽ tự động đồng bộ trạng thái sang lĩnh
                      vực liên thông.
                    </span>
                  </div>
                </div>

                {/* Node Identity & Metadata Form */}
                <div className="flex flex-col gap-3.5">
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="inspector-node-title"
                      className="text-xs font-semibold text-on-surface flex items-center justify-between"
                    >
                      <span>Tên hiển thị tiếng Việt</span>
                      <span className="text-[11px] font-normal text-on-surface-variant">
                        Hiển thị trên lộ trình
                      </span>
                    </label>
                    <input
                      id="inspector-node-title"
                      type="text"
                      value={selectedNode.title}
                      onChange={(e) => handleUpdateNodeTitle(selectedNode.slug, e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-surface-container-low text-on-surface text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs font-semibold text-on-surface">
                        Concept Slug (DAG ID)
                      </span>
                      <input
                        type="text"
                        disabled
                        value={selectedNode.slug}
                        className="w-full px-3 py-2 rounded-xl bg-surface-container text-on-surface-variant font-mono text-xs cursor-not-allowed"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label
                        htmlFor="inspector-node-tier"
                        className="text-xs font-semibold text-on-surface"
                      >
                        Tầng DAG (1–4)
                      </label>
                      <select
                        id="inspector-node-tier"
                        value={selectedNode.tier}
                        onChange={(e) =>
                          handleUpdateNodeTier(selectedNode.slug, Number(e.target.value))
                        }
                        className="w-full px-3 py-2 rounded-xl bg-surface-container-low text-on-surface text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        {[1, 2, 3, 4].map((t) => (
                          <option key={t} value={t}>
                            Tầng {t}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Prerequisite Edges Configuration */}
                <div className="flex flex-col gap-3 pt-2 border-t border-surface-container">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-on-surface uppercase tracking-wider font-headline">
                      Cạnh Tiên quyết Trực tiếp ({selectedNode.prerequisites.length})
                    </span>
                    <span className="text-[10px] font-mono text-on-surface-variant">
                      Bấm để bật/tắt cạnh
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-1">
                    {nodes
                      .filter((other) => other.slug !== selectedNode.slug)
                      .map((other) => {
                        const checked = selectedNode.prerequisites.includes(other.slug)
                        return (
                          <button
                            key={other.slug}
                            type="button"
                            onClick={() => handleTogglePrereq(selectedNode.slug, other.slug)}
                            className={`px-2.5 py-1 rounded-lg border font-mono text-[11px] cursor-pointer transition-colors ${
                              checked
                                ? 'bg-primary text-on-primary border-primary font-bold shadow-2xs'
                                : 'bg-surface-container-low text-on-surface-variant border-outline-variant/30 hover:border-primary'
                            }`}
                          >
                            [T{other.tier}] {other.slug}
                          </button>
                        )
                      })}
                  </div>
                </div>

                {/* Quick SCR-16 & SCR-17 Links */}
                <div className="pt-2 border-t border-surface-container flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => onNavigate('expert_questions')}
                    className="w-full py-2.5 px-4 rounded-xl bg-primary hover:bg-primary-dim text-on-primary text-xs font-bold flex items-center justify-center gap-2 shadow-2xs transition-all cursor-pointer"
                  >
                    <span>Mở Ngân hàng Đề 5 Tầng &amp; Rubric (SCR-16)</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('expert_code')}
                    className="w-full py-2 px-4 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Code2 className="w-4 h-4 text-secondary" aria-hidden="true" />
                    <span>Thiết kế Bài tập Code Sandbox (SCR-17)</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* All Nodes Quick Selector List */}
          <div className="w-full bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/25 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface font-headline flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-primary" aria-hidden="true" />
                <span>Danh mục Node ({nodes.length})</span>
              </h3>
              <span className="text-[11px] font-mono text-on-surface-variant">
                Bấm chọn để nạp Inspector
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
              {nodes.map((n) => (
                <button
                  key={n.slug}
                  type="button"
                  onClick={() => setSelectedNodeSlug(n.slug)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
                    selectedNode?.slug === n.slug
                      ? 'bg-primary text-on-primary font-bold'
                      : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
                  }`}
                >
                  {n.slug}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
