import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import {
  apiExpertCreateQuestion,
  apiExpertDeleteQuestion,
  apiExpertGetDomainGraph,
  apiExpertListQuestions,
  apiExpertUpdateQuestion,
  apiGetDomains,
} from '../../api'
import { ExpertQuestionListSidebar } from '../../components/expert/ExpertQuestionListSidebar'
import {
  ExpertRubricEditorPanel,
  type RubricRow,
} from '../../components/expert/ExpertRubricEditorPanel'
import { useOptionalBackOfficeStudio } from '../../shells/BackOfficeStudioContext'
import type {
  BackOfficeView,
  ExpertGraphNodeItem,
  ExpertQuestionItem,
  ExpertTaskType,
} from '../../types/expert'
import type { DomainListItem } from '../../types/learnerV2'

export interface ExpertQuestionsPageProps {
  onNavigate?: (view: BackOfficeView, params?: { domainSlug?: string; conceptSlug?: string }) => void
}

const DEPTH_TIER_META: Array<{
  tier: number
  short: string
  desc: string
  defaultTask: ExpertTaskType
}> = [
  { tier: 1, short: 'Tầng 1: What', desc: 'Khái niệm & Mô hình', defaultTask: 'mcq' },
  { tier: 2, short: 'Tầng 2: How', desc: 'Cơ chế Vận hành', defaultTask: 'mcq' },
  { tier: 3, short: 'Tầng 3: Pitfalls', desc: 'Sự cố & Code Review', defaultTask: 'troubleshooting' },
  {
    tier: 4,
    short: 'Tầng 4: Trade-offs',
    desc: 'Thay đổi Ràng buộc',
    defaultTask: 'constraint_shifting',
  },
  { tier: 5, short: 'Tầng 5: Internals', desc: 'Nội tại & Teach-back', defaultTask: 'teach_back' },
]

const TASK_TYPE_OPTIONS: Array<{ value: ExpertTaskType; label: string }> = [
  { value: 'mcq', label: 'Trắc nghiệm 4 phương án (Tầng 1–2)' },
  { value: 'troubleshooting', label: 'Xử lý sự cố (Troubleshooting)' },
  { value: 'code_review', label: 'Đánh giá mã nguồn (Code Review)' },
  { value: 'constraint_shifting', label: 'Thay đổi ràng buộc (Constraint Shifting)' },
  { value: 'teach_back', label: 'Giải thích ngược (Teach-back)' },
]

function defaultRubricRows(): RubricRow[] {
  return [
    { name: 'Xác định đúng nguyên nhân / cơ chế cốt lõi', weight: 0.5, keywords: '', socratic_hint: '' },
    { name: 'Đề xuất giải pháp & phân tích đánh đổi', weight: 0.5, keywords: '', socratic_hint: '' },
  ]
}

export function ExpertQuestionsPage({ onNavigate }: ExpertQuestionsPageProps = {}) {
  void onNavigate
  const studio = useOptionalBackOfficeStudio()
  const [localDomains, setLocalDomains] = useState<DomainListItem[]>([])
  const [localDomain, setLocalDomain] = useState('backend')
  const [localConcept, setLocalConcept] = useState('net-internet')

  const domains = studio ? studio.domains : localDomains
  const selectedDomain = studio ? studio.selectedDomainSlug : localDomain
  const setSelectedDomain = studio ? studio.setSelectedDomainSlug : setLocalDomain
  const conceptSlug = studio ? studio.selectedConceptSlug : localConcept
  const setConceptSlug = studio ? studio.setSelectedConceptSlug : setLocalConcept

  const [concepts, setConcepts] = useState<ExpertGraphNodeItem[]>([])
  const [questions, setQuestions] = useState<ExpertQuestionItem[]>([])
  const [loadingQuestions, setLoadingQuestions] = useState(false)

  // Master-Detail Editing State (null => CREATE mode, string => EDIT mode)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const [depthTier, setDepthTier] = useState<number>(studio?.selectedDepthTier ?? 3)
  const [taskType, setTaskType] = useState<ExpertTaskType>('troubleshooting')
  const [prompt, setPrompt] = useState('')
  const [mcqOptions, setMcqOptions] = useState<{ A: string; B: string; C: string; D: string }>({
    A: '',
    B: '',
    C: '',
    D: '',
  })
  const [correctOptionKey, setCorrectOptionKey] = useState<'A' | 'B' | 'C' | 'D'>('A')
  const [criteria, setCriteria] = useState<RubricRow[]>(defaultRubricRows())
  const [refExp, setRefExp] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (studio) return
    void (async () => {
      try {
        const res = await apiGetDomains()
        setLocalDomains(res.domains)
        if (res.domains.length > 0) setLocalDomain(res.domains[0].slug)
      } catch {
        // handled cleanly
      }
    })()
  }, [studio])

  useEffect(() => {
    if (!selectedDomain) return
    void (async () => {
      try {
        const graph = await apiExpertGetDomainGraph(selectedDomain)
        setConcepts(graph.nodes)
        if (graph.nodes.length > 0 && !graph.nodes.some((n) => n.slug === conceptSlug)) {
          setConceptSlug(graph.nodes[0].slug)
        }
      } catch {
        setConcepts([])
      }
    })()
  }, [selectedDomain, conceptSlug, setConceptSlug])

  const loadQuestions = useCallback(async (slug: string) => {
    if (!slug) return
    setLoadingQuestions(true)
    setErrorMsg(null)
    try {
      const res = await apiExpertListQuestions(slug)
      setQuestions(res.questions)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Không thể tải ngân hàng câu hỏi')
      setQuestions([])
    } finally {
      setLoadingQuestions(false)
    }
  }, [])

  useEffect(() => {
    void loadQuestions(conceptSlug)
  }, [conceptSlug, loadQuestions])

  function resetToNewQuestion(tier: number) {
    const meta = DEPTH_TIER_META.find((m) => m.tier === tier) ?? DEPTH_TIER_META[2]
    setEditingId(null)
    setDepthTier(tier)
    studio?.setSelectedDepthTier(tier)
    setTaskType(meta.defaultTask)
    setPrompt('')
    setMcqOptions({ A: '', B: '', C: '', D: '' })
    setCorrectOptionKey('A')
    setCriteria(defaultRubricRows())
    setRefExp('')
    setStatusMsg(null)
    setErrorMsg(null)
  }

  function loadQuestionIntoEditor(q: ExpertQuestionItem) {
    setEditingId(q.id)
    setDepthTier(q.depth_tier)
    studio?.setSelectedDepthTier(q.depth_tier)
    setTaskType(q.task_type)
    setPrompt(q.prompt)
    setMcqOptions({
      A: q.options?.A ?? '',
      B: q.options?.B ?? '',
      C: q.options?.C ?? '',
      D: q.options?.D ?? '',
    })
    const key = (q.correct_option_key?.toUpperCase() ?? 'A') as 'A' | 'B' | 'C' | 'D'
    setCorrectOptionKey(['A', 'B', 'C', 'D'].includes(key) ? key : 'A')
    if (q.rubric && q.rubric.criteria.length > 0) {
      setCriteria(
        q.rubric.criteria.map((c) => ({
          name: c.name,
          weight: c.weight,
          keywords: (c.required_keywords || []).join(', '),
          socratic_hint: c.socratic_hint ?? '',
        })),
      )
      setRefExp(q.rubric.reference_explanation)
    } else {
      setCriteria(defaultRubricRows())
      setRefExp('')
    }
    setStatusMsg(null)
    setErrorMsg(null)
  }

  const tierCounts = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    for (const q of questions) {
      counts[q.depth_tier] = (counts[q.depth_tier] ?? 0) + 1
    }
    return counts
  }, [questions])

  const filteredTierQuestions = useMemo(
    () => questions.filter((q) => q.depth_tier === depthTier),
    [questions, depthTier],
  )

  const totalWeight = Number(
    criteria.reduce((sum, c) => sum + Number(c.weight || 0), 0).toFixed(4),
  )
  const isWeightValid = taskType === 'mcq' || Math.abs(totalWeight - 1.0) <= 0.001
  const isMcqValid =
    taskType !== 'mcq' ||
    (['A', 'B', 'C', 'D'] as const).every((k) => mcqOptions[k].trim().length > 0)
  const hasAllKeywords =
    taskType === 'mcq' ||
    criteria.every(
      (c) =>
        c.name.trim().length > 0 &&
        c.keywords
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean).length > 0,
    )

  function buildRubricPayload() {
    return {
      criteria: criteria.map((c) => ({
        name: c.name.trim(),
        weight: Number(c.weight),
        required_keywords: c.keywords
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        socratic_hint: c.socratic_hint.trim() || null,
      })),
      reference_explanation: refExp.trim() || 'Giải thích tham chiếu chuẩn theo tiêu chí Rubric.',
    }
  }

  async function handleSave() {
    setErrorMsg(null)
    setStatusMsg(null)
    setSubmitting(true)
    try {
      const payload = {
        depth_tier: depthTier,
        task_type: taskType,
        prompt: prompt.trim(),
        options:
          taskType === 'mcq'
            ? {
                A: mcqOptions.A.trim(),
                B: mcqOptions.B.trim(),
                C: mcqOptions.C.trim(),
                D: mcqOptions.D.trim(),
              }
            : null,
        correct_option_key: taskType === 'mcq' ? correctOptionKey : null,
        rubric: taskType === 'mcq' ? null : buildRubricPayload(),
        is_active: true,
      }
      if (editingId) {
        const res = await apiExpertUpdateQuestion(editingId, payload)
        setStatusMsg(`Đã cập nhật câu hỏi thành công (v${res.version}).`)
      } else {
        const res = await apiExpertCreateQuestion(conceptSlug, payload)
        setStatusMsg(`Đã tạo câu hỏi mới thành công (v${res.version}).`)
        setEditingId(res.item_id)
      }
      await loadQuestions(conceptSlug)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Không thể lưu câu hỏi')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleConfirmDelete(id: string) {
    setErrorMsg(null)
    setStatusMsg(null)
    try {
      await apiExpertDeleteQuestion(id)
      setConfirmDeleteId(null)
      if (editingId === id) {
        resetToNewQuestion(depthTier)
      }
      setStatusMsg('Đã xóa câu hỏi khỏi ngân hàng đề đang hoạt động.')
      await loadQuestions(conceptSlug)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Không thể xóa câu hỏi')
    }
  }

  return (
    <section
      className="w-full space-y-5 text-[#14241B]"
      data-testid="scr16-expert-questions"
    >
      {/* Top Selection Bar */}
      <div className="bg-white rounded-2xl border border-[#D8E2D8] p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-[#14241B] tracking-tight">
              Ngân hàng Câu hỏi 5 Tầng &amp; Kiểm thử Rubric
            </h1>
            <p className="text-xs text-[#3F5247] mt-0.5">
              Quản lý toàn bộ câu hỏi hiện có của khái niệm, chỉnh sửa tiêu chí chấm và chạy thử bộ chấm trực tiếp.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadQuestions(conceptSlug)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#F6F8F5] border border-[#D8E2D8] hover:bg-[#F0FDF4] text-xs font-semibold cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loadingQuestions ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>Làm mới danh sách</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-[#F6F8F5] p-3 rounded-xl border border-[#D8E2D8]">
            <label
              htmlFor="scr16-select-domain"
              className="block text-[10px] uppercase font-bold text-[#57534E] mb-1"
            >
              Lĩnh vực
            </label>
            <select
              id="scr16-select-domain"
              value={selectedDomain}
              onChange={(e) => setSelectedDomain(e.target.value)}
              className="w-full text-xs font-bold text-[#14241B] bg-transparent focus:outline-none cursor-pointer"
            >
              {domains.map((d) => (
                <option key={d.slug} value={d.slug}>
                  {d.title} ({d.total_nodes} nodes)
                </option>
              ))}
            </select>
          </div>

          <div className="bg-[#F6F8F5] p-3 rounded-xl border border-[#D8E2D8]">
            <label
              htmlFor="scr16-select-concept"
              className="block text-[10px] uppercase font-bold text-[#57534E] mb-1"
            >
              Khái niệm mục tiêu
            </label>
            <select
              id="scr16-select-concept"
              value={conceptSlug}
              onChange={(e) => {
                setConceptSlug(e.target.value)
                setEditingId(null)
              }}
              className="w-full text-xs font-bold font-mono text-[#14241B] bg-transparent focus:outline-none cursor-pointer"
            >
              {concepts.map((c) => (
                <option key={c.slug} value={c.slug}>
                  [T{c.tier}] {c.title} ({c.slug})
                </option>
              ))}
            </select>
          </div>

          <div className="bg-[#F6F8F5] p-3 rounded-xl border border-[#D8E2D8]">
            <label
              htmlFor="scr16-select-tier"
              className="block text-[10px] uppercase font-bold text-[#57534E] mb-1"
            >
              Tầng sâu (1–5)
            </label>
            <select
              id="scr16-select-tier"
              value={depthTier}
              onChange={(e) => {
                const t = Number(e.target.value)
                setDepthTier(t)
                studio?.setSelectedDepthTier(t)
              }}
              className="w-full text-xs font-bold text-[#14241B] bg-transparent focus:outline-none cursor-pointer"
            >
              {[1, 2, 3, 4, 5].map((t) => (
                <option key={t} value={t}>
                  Tầng {t} ({tierCounts[t]} câu)
                </option>
              ))}
            </select>
          </div>

          <div className="bg-[#F6F8F5] p-3 rounded-xl border border-[#D8E2D8]">
            <label
              htmlFor="scr16-select-tasktype"
              className="block text-[10px] uppercase font-bold text-[#57534E] mb-1"
            >
              Dạng bài Đánh giá
            </label>
            <select
              id="scr16-select-tasktype"
              value={taskType}
              onChange={(e) => setTaskType(e.target.value as ExpertTaskType)}
              className="w-full text-xs font-bold text-[#14241B] bg-transparent focus:outline-none cursor-pointer"
            >
              {TASK_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 5-Depth Coverage Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {DEPTH_TIER_META.map((item) => {
            const count = tierCounts[item.tier] ?? 0
            const active = depthTier === item.tier
            return (
              <button
                key={item.tier}
                type="button"
                onClick={() => {
                  setDepthTier(item.tier)
                  studio?.setSelectedDepthTier(item.tier)
                  if (!editingId) setTaskType(item.defaultTask)
                }}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  active
                    ? 'bg-[#F0FDF4] border-[#15803D] ring-1 ring-[#15803D]'
                    : 'bg-white border-[#D8E2D8] hover:bg-[#F6F8F5]'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-bold text-[#14241B]">{item.short}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                      count === 0
                        ? 'bg-[#FFFBEB] text-[#B45309] border border-[#F59E0B]/50'
                        : 'bg-[#DCFCE7] text-[#14532D]'
                    }`}
                  >
                    {count === 0 ? 'Thiếu' : `${count} câu`}
                  </span>
                </div>
                <p className="text-[10px] text-[#57534E] truncate mt-0.5">{item.desc}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Master-Detail Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <ExpertQuestionListSidebar
          conceptSlug={conceptSlug}
          depthTier={depthTier}
          questions={filteredTierQuestions}
          loading={loadingQuestions}
          editingId={editingId}
          onCreateNew={() => resetToNewQuestion(depthTier)}
          onSelectQuestion={loadQuestionIntoEditor}
          onRequestDelete={setConfirmDeleteId}
        />

        <ExpertRubricEditorPanel
          conceptSlug={conceptSlug}
          depthTier={depthTier}
          editingId={editingId}
          taskType={taskType}
          prompt={prompt}
          onPromptChange={setPrompt}
          mcqOptions={mcqOptions}
          onMcqOptionsChange={setMcqOptions}
          correctOptionKey={correctOptionKey}
          onCorrectOptionKeyChange={setCorrectOptionKey}
          criteria={criteria}
          onCriteriaChange={setCriteria}
          refExp={refExp}
          onRefExpChange={setRefExp}
          totalWeight={totalWeight}
          isWeightValid={isWeightValid}
          isMcqValid={isMcqValid}
          hasAllKeywords={hasAllKeywords}
          submitting={submitting}
          statusMsg={statusMsg}
          errorMsg={errorMsg}
          onError={setErrorMsg}
          onResetToNew={() => resetToNewQuestion(depthTier)}
          onSave={() => void handleSave()}
          buildRubricPayload={buildRubricPayload}
          dryRunResetKey={`${conceptSlug}:${editingId ?? 'new'}:${depthTier}`}
        />
      </div>

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white max-w-md w-full rounded-2xl border border-[#D8E2D8] p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-extrabold text-[#14241B]">
              Xác nhận gỡ câu hỏi khỏi ngân hàng đề
            </h3>
            <p className="text-xs text-[#57534E]">
              Câu hỏi sẽ được đánh dấu ngừng hoạt động (soft-delete) để không ảnh hưởng lịch sử làm bài cũ của học viên.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 rounded-lg bg-[#F6F8F5] border border-[#D8E2D8] text-xs font-semibold cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDelete(confirmDeleteId)}
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
