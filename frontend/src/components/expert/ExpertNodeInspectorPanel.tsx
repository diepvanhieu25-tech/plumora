import { useState } from 'react'
import {
  ArrowRight,
  BookOpen,
  Code2,
  Eye,
  FileQuestion,
  Layers,
  Trash2,
} from 'lucide-react'
import type {
  DagCycleAnalysis,
  EditableGraphNode,
} from '../../hooks/useDagTopologyEditor'
import type { BackOfficeView } from '../../types/expert'
import { MarkdownRenderer } from '../ui/MarkdownRenderer'

export interface ExpertNodeInspectorPanelProps {
  selectedDomain: string
  nodes: EditableGraphNode[]
  selectedNode: EditableGraphNode | null
  cycleAnalysis: DagCycleAnalysis
  inspectorTab: 'meta' | 'lesson'
  onInspectorTabChange: (tab: 'meta' | 'lesson') => void
  savingPlaybook: boolean
  onQuickSavePlaybook: (slug: string, markdown: string) => void
  onUpdateNode: (slug: string, patch: Partial<EditableGraphNode>) => void
  onTogglePrereq: (targetSlug: string, prereqSlug: string) => void
  onRequestRemoveNode: (slug: string) => void
  onNavigate: (view: BackOfficeView, params?: { domainSlug?: string; conceptSlug?: string }) => void
}

export function ExpertNodeInspectorPanel({
  selectedDomain,
  nodes,
  selectedNode,
  cycleAnalysis,
  inspectorTab,
  onInspectorTabChange,
  savingPlaybook,
  onQuickSavePlaybook,
  onUpdateNode,
  onTogglePrereq,
  onRequestRemoveNode,
  onNavigate,
}: ExpertNodeInspectorPanelProps) {
  const [lessonPreview, setLessonPreview] = useState(false)

  return (
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
                onClick={() => onRequestRemoveNode(selectedNode.slug)}
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
                onClick={() => onInspectorTabChange('meta')}
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
                onClick={() => onInspectorTabChange('lesson')}
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
                    onChange={(e) => onUpdateNode(selectedNode.slug, { title: e.target.value })}
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
                        onUpdateNode(selectedNode.slug, { tier: Number(e.target.value) })
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
                        onUpdateNode(selectedNode.slug, { is_shared: !selectedNode.is_shared })
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
                            onClick={() => onTogglePrereq(selectedNode.slug, other.slug)}
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
                        onQuickSavePlaybook(selectedNode.slug, selectedNode.lesson_markdown)
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
                      onUpdateNode(selectedNode.slug, { lesson_markdown: e.target.value })
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
  )
}
