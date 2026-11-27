import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
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
} from '../../api'
import { ExpertDagCanvas } from '../../components/expert/ExpertDagCanvas'
import { ExpertNodeInspectorPanel } from '../../components/expert/ExpertNodeInspectorPanel'
import { useDagTopologyEditor } from '../../hooks/useDagTopologyEditor'
import { useOptionalBackOfficeStudio } from '../../shells/BackOfficeStudioContext'
import type { BackOfficeView } from '../../types/expert'
import type { DomainListItem } from '../../types/learnerV2'

export interface ExpertDomainsPageProps {
  onNavigate: (view: BackOfficeView, params?: { domainSlug?: string; conceptSlug?: string }) => void
}

export function ExpertDomainsPage({ onNavigate }: ExpertDomainsPageProps) {
  const studio = useOptionalBackOfficeStudio()
  const [localDomains, setLocalDomains] = useState<DomainListItem[]>([])
  const [localSelectedDomain, setLocalSelectedDomain] = useState('backend')

  const domains = studio ? studio.domains : localDomains
  const selectedDomain = studio ? studio.selectedDomainSlug : localSelectedDomain
  const setSelectedDomain = studio ? studio.setSelectedDomainSlug : setLocalSelectedDomain

  const [graphVersion, setGraphVersion] = useState<number>(1)
  const [loadingGraph, setLoadingGraph] = useState(false)
  const [inspectorTab, setInspectorTab] = useState<'meta' | 'lesson'>('meta')

  // New domain form
  const [showNewDomainForm, setShowNewDomainForm] = useState(false)
  const [newSlug, setNewSlug] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [creatingDomain, setCreatingDomain] = useState(false)

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

  function handleAddNode(input: {
    slug: string
    title: string
    tier: number
    isShared: boolean
  }): boolean {
    const cleanSlug = input.slug.trim()
    if (!cleanSlug || !input.title.trim()) return false
    if (nodes.some((n) => n.slug === cleanSlug)) {
      setErrorMsg(`Khái niệm '${cleanSlug}' đã tồn tại trong đồ thị.`)
      return false
    }
    setErrorMsg(null)
    addNode({
      slug: cleanSlug,
      title: input.title.trim(),
      tier: input.tier,
      is_shared: input.isShared,
      lesson_markdown: `## ${input.title.trim()}\n\n### 1. Bản chất & Mục tiêu\nNhập nội dung bài giảng tại đây.\n`,
      prerequisites: [],
      question_counts_by_tier: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
      has_code_challenge: false,
    })
    setInspectorTab('lesson')
    return true
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
        <ExpertDagCanvas
          selectedDomain={selectedDomain}
          nodes={nodes}
          selectedNodeSlug={selectedNode?.slug ?? null}
          allEdges={allEdges}
          outDegreeMap={outDegreeMap}
          cycleAnalysis={cycleAnalysis}
          sharedNodesCount={sharedNodesCount}
          loadingGraph={loadingGraph}
          onSelectNode={selectNode}
          onAddNode={handleAddNode}
          onTogglePrereq={togglePrereq}
        />

        <ExpertNodeInspectorPanel
          selectedDomain={selectedDomain}
          nodes={nodes}
          selectedNode={selectedNode}
          cycleAnalysis={cycleAnalysis}
          inspectorTab={inspectorTab}
          onInspectorTabChange={setInspectorTab}
          savingPlaybook={savingPlaybook}
          onQuickSavePlaybook={(slug, md) => void handleQuickSavePlaybook(slug, md)}
          onUpdateNode={updateNode}
          onTogglePrereq={togglePrereq}
          onRequestRemoveNode={setConfirmRemoveSlug}
          onNavigate={onNavigate}
        />
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
