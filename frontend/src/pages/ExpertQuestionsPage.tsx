import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  FileQuestion,
  Layers,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import {
  apiExpertCreateQuestion,
  apiExpertDeleteQuestion,
  apiExpertGetDomainGraph,
  apiExpertListQuestions,
  apiExpertRubricDryRun,
  apiExpertUpdateQuestion,
  apiGetDomains,
} from '../api'
import { useOptionalBackOfficeStudio } from '../shells/BackOfficeStudioContext'
import type {
  BackOfficeView,
  ExpertGraphNodeItem,
  ExpertQuestionItem,
  ExpertRubricDryRunResponse,
  ExpertTaskType,
} from '../types/expert'
import type { DomainListItem } from '../types/learnerV2'

export interface ExpertQuestionsPageProps {
  onNavigate?: (view: BackOfficeView, params?: { domainSlug?: string; conceptSlug?: string }) => void
}

interface RubricRow {
  name: string
  weight: number
  keywords: string
  socratic_hint: string
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

  // Live Rubric Dry-Run State
  const [sampleAnswer, setSampleAnswer] = useState('')
  const [dryRunning, setDryRunning] = useState(false)
  const [dryRunResult, setDryRunResult] = useState<ExpertRubricDryRunResponse | null>(null)

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
    setDryRunResult(null)
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
    setDryRunResult(null)
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

  async function handleDryRunRubric() {
    if (taskType === 'mcq' || !sampleAnswer.trim() || !isWeightValid || !hasAllKeywords) return
    setDryRunning(true)
    setErrorMsg(null)
    try {
      const res = await apiExpertRubricDryRun({
        prompt: prompt.trim() || 'Câu hỏi đánh giá tự luận',
        sample_answer: sampleAnswer.trim(),
        rubric: buildRubricPayload(),
      })
      setDryRunResult(res)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Lỗi chạy thử bộ chấm Rubric')
    } finally {
      setDryRunning(false)
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
        {/* LEFT MASTER LIST (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-[#D8E2D8] p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#E7EFE7]">
            <div className="flex items-center gap-1.5">
              <FileQuestion className="w-4 h-4 text-[#15803D]" aria-hidden="true" />
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#14241B]">
                Câu hỏi Tầng {depthTier} ({filteredTierQuestions.length})
              </h2>
            </div>
            <button
              type="button"
              onClick={() => resetToNewQuestion(depthTier)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#15803D] hover:bg-[#166534] text-white text-[11px] font-bold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Tạo mới</span>
            </button>
          </div>

          {loadingQuestions ? (
            <div className="space-y-2">
              {[0, 1].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-[#F6F8F5] animate-pulse" />
              ))}
            </div>
          ) : filteredTierQuestions.length === 0 ? (
            <div className="p-4 rounded-xl bg-[#FFFBEB] border border-[#F59E0B]/50 text-xs text-[#78350F] space-y-1">
              <div className="font-bold">Chưa có câu hỏi nào ở Tầng {depthTier}</div>
              <p className="text-[11px]">
                Hãy soạn ít nhất 1 câu hỏi cho tầng này để hoàn thiện chuỗi đào sâu 5 tầng của khái niệm{' '}
                <code className="font-mono font-bold">{conceptSlug}</code>.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {filteredTierQuestions.map((q) => {
                const isSelected = editingId === q.id
                return (
                  <div
                    key={q.id}
                    className={`p-3 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-[#F0FDF4] border-[#15803D]'
                        : 'bg-[#F6F8F5] border-[#D8E2D8] hover:border-[#15803D]/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => loadQuestionIntoEditor(q)}
                        className="text-left flex-1 min-w-0 cursor-pointer"
                      >
                        <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#57534E] mb-1">
                          <span className="px-1.5 py-0.5 rounded bg-white border border-[#D8E2D8] font-bold text-[#15803D]">
                            {q.task_type}
                          </span>
                          <span>v{q.version}</span>
                        </div>
                        <p className="text-xs font-semibold text-[#14241B] line-clamp-2">
                          {q.prompt}
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(q.id)}
                        className="p-1.5 rounded-lg text-[#57534E] hover:text-[#9F1239] hover:bg-[#FFF1F2] cursor-pointer shrink-0"
                        title="Xóa câu hỏi"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* RIGHT DETAIL EDITOR + LIVE RUBRIC DRY-RUN (8 cols) */}
        <div className="lg:col-span-8 space-y-5">
          <div className="bg-white rounded-2xl border border-[#D8E2D8] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-[#E7EFE7]">
              <h2 className="text-sm font-extrabold text-[#14241B]">
                {editingId ? 'Chỉnh sửa Câu hỏi Hiện có' : 'Soạn Câu hỏi Mới'} —{' '}
                <code className="font-mono text-[#15803D]">{conceptSlug}</code> (Tầng {depthTier})
              </h2>
              {editingId && (
                <button
                  type="button"
                  onClick={() => resetToNewQuestion(depthTier)}
                  className="text-xs font-semibold text-[#15803D] hover:underline cursor-pointer"
                >
                  Chuyển sang tạo câu mới
                </button>
              )}
            </div>

            {/* Prompt Input */}
            <div>
              <label
                htmlFor="scr16-prompt-textarea"
                className="block text-xs font-bold text-[#14241B] mb-1.5"
              >
                Nội dung câu hỏi / Tình huống kỹ thuật
              </label>
              <textarea
                id="scr16-prompt-textarea"
                rows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Nhập câu hỏi, tình huống sự cố, đoạn code cần review hoặc yêu cầu giải thích..."
                className="w-full rounded-xl border border-[#D8E2D8] bg-[#F6F8F5] p-3 text-xs text-[#14241B] focus:bg-white focus:border-[#15803D] focus:outline-none leading-relaxed"
              />
            </div>

            {taskType === 'mcq' ? (
              <div className="p-4 rounded-xl bg-[#F6F8F5] border border-[#D8E2D8] space-y-3">
                <div className="flex items-center justify-between gap-2 text-xs font-bold">
                  <span className="inline-flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-[#15803D]" aria-hidden="true" />
                    <span>4 Phương án Trắc nghiệm (A, B, C, D)</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <label htmlFor="mcq-correct-key" className="text-[#57534E]">
                      Đáp án đúng:
                    </label>
                    <select
                      id="mcq-correct-key"
                      value={correctOptionKey}
                      onChange={(e) =>
                        setCorrectOptionKey(e.target.value as 'A' | 'B' | 'C' | 'D')
                      }
                      className="rounded-lg border border-[#D8E2D8] bg-white px-2.5 py-1 text-xs font-mono font-bold text-[#15803D]"
                    >
                      {(['A', 'B', 'C', 'D'] as const).map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {(['A', 'B', 'C', 'D'] as const).map((k) => (
                    <div
                      key={k}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border bg-white ${
                        correctOptionKey === k ? 'border-[#15803D]' : 'border-[#D8E2D8]'
                      }`}
                    >
                      <span
                        className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold shrink-0 ${
                          correctOptionKey === k
                            ? 'bg-[#15803D] text-white'
                            : 'bg-[#F6F8F5] text-[#14241B]'
                        }`}
                      >
                        {k}
                      </span>
                      <input
                        value={mcqOptions[k]}
                        onChange={(e) =>
                          setMcqOptions((prev) => ({ ...prev, [k]: e.target.value }))
                        }
                        placeholder={`Nội dung phương án ${k}`}
                        className="flex-1 text-xs bg-transparent focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Structured Rubric Criteria */}
                <div className="p-4 rounded-xl bg-[#F6F8F5] border border-[#D8E2D8] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
                    <span>Bảng Tiêu chí Rubric (Tổng trọng số = 1.0)</span>
                    <div className="flex items-center gap-3">
                      <span
                        className={`font-mono ${isWeightValid ? 'text-[#15803D]' : 'text-[#9F1239]'}`}
                      >
                        Tổng: {totalWeight}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (criteria.length === 0) return
                          const base = Math.floor(100 / criteria.length) / 100
                          const rem = Math.round((1.0 - base * criteria.length) * 100) / 100
                          setCriteria((prev) =>
                            prev.map((c, idx) => ({
                              ...c,
                              weight: idx === 0 ? Number((base + rem).toFixed(2)) : base,
                            })),
                          )
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#F0FDF4] border border-[#86EFAC] text-[#14532D] text-[11px] font-bold cursor-pointer"
                      >
                        <span>Tự cân bằng = 1.0</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setCriteria((prev) => [
                            ...prev,
                            { name: `Tiêu chí ${prev.length + 1}`, weight: 0, keywords: '', socratic_hint: '' },
                          ])
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-[#D8E2D8] text-[#15803D] cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Thêm tiêu chí</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {criteria.map((row, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-white border border-[#D8E2D8] space-y-2 text-xs"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                          <input
                            value={row.name}
                            onChange={(e) =>
                              setCriteria((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, name: e.target.value } : r)),
                              )
                            }
                            placeholder="Tên tiêu chí đánh giá"
                            className="sm:col-span-7 rounded-lg border border-[#D8E2D8] bg-[#F6F8F5] px-2.5 py-1.5"
                          />
                          <input
                            type="number"
                            step="0.05"
                            min="0"
                            max="1"
                            value={row.weight}
                            onChange={(e) =>
                              setCriteria((prev) =>
                                prev.map((r, i) =>
                                  i === idx ? { ...r, weight: Number(e.target.value) } : r,
                                ),
                              )
                            }
                            aria-label={`Trọng số tiêu chí ${idx + 1}`}
                            className="sm:col-span-3 rounded-lg border border-[#D8E2D8] bg-[#F6F8F5] px-2.5 py-1.5 font-mono"
                          />
                          <div className="sm:col-span-2 flex justify-end">
                            <button
                              type="button"
                              disabled={criteria.length <= 1}
                              onClick={() =>
                                setCriteria((prev) => prev.filter((_, i) => i !== idx))
                              }
                              className="p-1.5 rounded-lg text-[#9F1239] hover:bg-[#FFF1F2] disabled:opacity-30 cursor-pointer"
                              title="Xóa tiêu chí"
                            >
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                        <input
                          value={row.keywords}
                          onChange={(e) =>
                            setCriteria((prev) =>
                              prev.map((r, i) =>
                                i === idx ? { ...r, keywords: e.target.value } : r,
                              ),
                            )
                          }
                          placeholder="Từ khóa bắt buộc (phân tách bằng dấu phẩy, vd: index, b-tree, scan)"
                          className="w-full rounded-lg border border-[#D8E2D8] bg-[#F6F8F5] px-2.5 py-1.5 font-mono text-[11px]"
                        />
                        <input
                          value={row.socratic_hint}
                          onChange={(e) =>
                            setCriteria((prev) =>
                              prev.map((r, i) =>
                                i === idx ? { ...r, socratic_hint: e.target.value } : r,
                              ),
                            )
                          }
                          placeholder="Gợi ý Socratic khi học viên thiếu tiêu chí này (tùy chọn)"
                          className="w-full rounded-lg border border-[#D8E2D8] bg-[#F6F8F5] px-2.5 py-1.5 text-[11px]"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Reference Explanation */}
                <div>
                  <label
                    htmlFor="scr16-ref-exp"
                    className="block text-xs font-bold text-[#14241B] mb-1"
                  >
                    Lời giải thích tham chiếu chuẩn (Reference Explanation)
                  </label>
                  <textarea
                    id="scr16-ref-exp"
                    rows={2}
                    value={refExp}
                    onChange={(e) => setRefExp(e.target.value)}
                    placeholder="Giải thích chuẩn để AI Tutor phản hồi cho học viên..."
                    className="w-full rounded-xl border border-[#D8E2D8] bg-[#F6F8F5] p-2.5 text-xs focus:bg-white focus:border-[#15803D] focus:outline-none"
                  />
                </div>

                {/* Live Rubric Dry-Run Tool (Replaces decorative status card) */}
                <div
                  className="p-4 rounded-xl bg-[#F0FDF4]/70 border border-[#BBF7D0] space-y-3"
                  data-testid="live-rubric-dry-run-panel"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-extrabold text-[#14532D]">
                      Kiểm thử Bộ chấm Rubric Trực tiếp (Live Rubric Dry-Run)
                    </h3>
                    <button
                      type="button"
                      disabled={dryRunning || !sampleAnswer.trim() || !isWeightValid || !hasAllKeywords}
                      onClick={() => void handleDryRunRubric()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#15803D] hover:bg-[#166534] disabled:opacity-45 text-white text-xs font-bold cursor-pointer"
                    >
                      {dryRunning ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Play className="w-3.5 h-3.5" aria-hidden="true" />
                      )}
                      <span>Chạy thử Bộ chấm</span>
                    </button>
                  </div>

                  <textarea
                    rows={2}
                    value={sampleAnswer}
                    onChange={(e) => setSampleAnswer(e.target.value)}
                    placeholder="Nhập thử câu trả lời mẫu của học viên để kiểm tra điểm số và từ khóa khớp..."
                    className="w-full rounded-lg border border-[#BBF7D0] bg-white p-2.5 text-xs focus:border-[#15803D] focus:outline-none"
                  />

                  {dryRunResult && (
                    <div className="p-3 rounded-lg bg-white border border-[#D8E2D8] space-y-2 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold">
                          Điểm chấm thử:{' '}
                          <span
                            className={`font-mono ${
                              dryRunResult.passed ? 'text-[#15803D]' : 'text-[#9F1239]'
                            }`}
                          >
                            {Math.round(dryRunResult.rubric_score * 100)}% (
                            {dryRunResult.passed ? 'ĐẠT >= 75%' : 'CHƯA ĐẠT'})
                          </span>
                        </span>
                        <span className="font-mono text-[11px] text-[#57534E]">
                          Nguồn: {dryRunResult.grader_source}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#3F5247]">{dryRunResult.tutor_summary}</p>
                      <div className="space-y-1">
                        {dryRunResult.criteria_results.map((cr, idx) => (
                          <div
                            key={idx}
                            className="p-2 rounded bg-[#F6F8F5] flex flex-wrap items-center justify-between gap-2 text-[11px]"
                          >
                            <span className="font-semibold text-[#14241B]">{cr.name}</span>
                            <span className="font-mono">
                              Điểm: {Math.round(cr.score * 100)}% | Khớp:{' '}
                              {cr.matched_keywords.join(', ') || 'Không'} | Thiếu:{' '}
                              {cr.missing_keywords.join(', ') || 'Không'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {errorMsg && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-[#FFF1F2] border border-[#FDA4AF] text-xs font-bold text-[#9F1239] flex items-center gap-2"
              >
                <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{errorMsg}</span>
              </div>
            )}

            {statusMsg && (
              <div className="p-3 rounded-xl bg-[#F0FDF4] border border-[#86EFAC] text-xs font-bold text-[#14532D] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0" aria-hidden="true" />
                <span>{statusMsg}</span>
              </div>
            )}

            {/* Save Footer */}
            <div className="pt-3 border-t border-[#E7EFE7] flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-[#57534E]">
                {isWeightValid && isMcqValid && hasAllKeywords
                  ? 'Cấu trúc câu hỏi hợp lệ để xuất bản.'
                  : 'Vui lòng điền đủ đề bài, phương án hoặc từ khóa Rubric (tổng trọng số = 1.0).'}
              </span>
              <button
                type="button"
                disabled={
                  submitting ||
                  !prompt.trim() ||
                  !isWeightValid ||
                  !isMcqValid ||
                  !hasAllKeywords
                }
                onClick={() => void handleSave()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#15803D] hover:bg-[#166534] disabled:opacity-45 text-white text-xs font-bold cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                <span>
                  {submitting
                    ? 'Đang lưu...'
                    : editingId
                      ? 'Cập nhật Câu hỏi & Rubric'
                      : 'Lưu Câu hỏi & Rubric'}
                </span>
              </button>
            </div>
          </div>
        </div>
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
