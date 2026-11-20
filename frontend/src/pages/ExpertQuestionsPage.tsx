import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  Code2,
  FileQuestion,
  GitBranch,
  Layers,
  Plus,
  ShieldCheck,
  Sparkles,
  Terminal,
  Trash2,
} from 'lucide-react'
import { apiExpertCreateQuestion, apiGetDomainRoadmap, apiGetDomains } from '../api'
import type { ActiveView, DomainListItem, DomainRoadmapNode } from '../types'

interface ExpertQuestionsPageProps {
  onNavigate: (view: ActiveView) => void
}

interface RubricRow {
  name: string
  weight: number
  keywords: string
}

const DEPTH_TIER_META: Array<{
  tier: number
  short: string
  desc: string
  defaultTask: string
}> = [
  { tier: 1, short: 'Tầng 1: What', desc: 'Khái niệm & Mô hình', defaultTask: 'mcq' },
  { tier: 2, short: 'Tầng 2: How', desc: 'Cơ chế Vận hành', defaultTask: 'mcq' },
  {
    tier: 3,
    short: 'Tầng 3: Pitfalls',
    desc: 'Tình huống & Cạm bẫy',
    defaultTask: 'troubleshooting',
  },
  {
    tier: 4,
    short: 'Tầng 4: Trade-offs',
    desc: 'Thay đổi Ràng buộc',
    defaultTask: 'constraint_shifting',
  },
  {
    tier: 5,
    short: 'Tầng 5: Internals',
    desc: 'Nội tại & Teach-back',
    defaultTask: 'teach_back',
  },
]

const FORMAT_CARDS: Array<{
  key: string
  tag: string
  title: string
  tiers: string
}> = [
  {
    key: 'mcq',
    tag: 'Khách quan',
    title: 'Trắc nghiệm 4 Đáp án (A/B/C/D)',
    tiers: 'Tầng 1–2',
  },
  {
    key: 'troubleshooting',
    tag: 'Dạng 1',
    title: 'Xử lý sự cố (Troubleshooting)',
    tiers: 'Tầng 3',
  },
  {
    key: 'constraint_shifting',
    tag: 'Dạng 3',
    title: 'Thay đổi Ràng buộc (Shifting)',
    tiers: 'Tầng 4',
  },
  {
    key: 'teach_back',
    tag: 'Dạng 4',
    title: 'Giải thích ngược (Feynman)',
    tiers: 'Tầng 5',
  },
]

export function ExpertQuestionsPage({ onNavigate }: ExpertQuestionsPageProps) {
  const [domains, setDomains] = useState<DomainListItem[]>([])
  const [selectedDomain, setSelectedDomain] = useState('backend')
  const [concepts, setConcepts] = useState<DomainRoadmapNode[]>([])
  const [conceptSlug, setConceptSlug] = useState('net-internet')
  const [depthTier, setDepthTier] = useState(3)
  const [taskType, setTaskType] = useState('troubleshooting')
  const [prompt, setPrompt] = useState('')
  const [mcqOptions, setMcqOptions] = useState<{ A: string; B: string; C: string; D: string }>({
    A: '',
    B: '',
    C: '',
    D: '',
  })
  const [correctOptionKey, setCorrectOptionKey] = useState<'A' | 'B' | 'C' | 'D'>('A')
  const [criteria, setCriteria] = useState<RubricRow[]>([
    { name: 'Tiêu chí 1 (Nguyên nhân / Cơ chế)', weight: 0.5, keywords: 'dns, ip' },
    { name: 'Tiêu chí 2 (Xử lý / Đánh đổi)', weight: 0.5, keywords: 'tcp, handshake' },
  ])
  const [refExp, setRefExp] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const res = await apiGetDomains()
        setDomains(res.domains)
        if (res.domains.length > 0) {
          setSelectedDomain(res.domains[0].slug)
        }
      } catch {
        // Handled cleanly if domains fail to load
      }
    })()
  }, [])

  useEffect(() => {
    if (!selectedDomain) return
    void (async () => {
      try {
        const rm = await apiGetDomainRoadmap(selectedDomain, 0)
        setConcepts(rm.nodes)
        if (rm.nodes.length > 0) {
          setConceptSlug(rm.nodes[0].slug)
        }
      } catch {
        setConcepts([])
      }
    })()
  }, [selectedDomain])

  const totalWeight = Number(
    criteria.reduce((sum, c) => sum + Number(c.weight || 0), 0).toFixed(4),
  )
  const isWeightValid = taskType === 'mcq' || Math.abs(totalWeight - 1.0) <= 0.001
  const isMcqValid =
    taskType !== 'mcq' ||
    (['A', 'B', 'C', 'D'] as const).every((k) => mcqOptions[k].trim().length > 0)

  const totalKeywordsCount = criteria.reduce(
    (acc, row) =>
      acc +
      row.keywords
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean).length,
    0,
  )

  function handleAddCriterion() {
    setCriteria((prev) => [
      ...prev,
      { name: `Tiêu chí ${prev.length + 1}`, weight: 0, keywords: '' },
    ])
  }

  function handleRemoveCriterion(idx: number) {
    if (criteria.length <= 1) return
    setCriteria((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSave() {
    setErrorMsg(null)
    setStatusMsg(null)
    setSubmitting(true)
    try {
      const res = await apiExpertCreateQuestion(conceptSlug.trim(), {
        depth_tier: depthTier,
        task_type: taskType,
        prompt,
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
        rubric:
          taskType === 'mcq'
            ? null
            : {
                criteria: criteria.map((c) => ({
                  name: c.name,
                  weight: Number(c.weight),
                  required_keywords: c.keywords
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                })),
                reference_explanation: refExp || 'Giải thích chuẩn theo Rubric.',
              },
      })
      setStatusMsg(`Đã lưu câu hỏi & Rubric thành công (ID: ${res.item_id}).`)
      setPrompt('')
      setMcqOptions({ A: '', B: '', C: '', D: '' })
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Không thể lưu câu hỏi')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section
      className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 space-y-5 text-on-surface"
      data-testid="scr16-expert-questions"
    >
      {/* 1. Top Command & Breadcrumb Surface */}
      <div className="w-full bg-surface-container-lowest rounded-2xl border border-surface-container-highest p-5 shadow-sm flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* Breadcrumb and Metadata Badges */}
          <div className="flex flex-wrap items-center gap-2.5">
            <nav
              aria-label="Breadcrumb"
              className="flex items-center gap-1.5 text-xs text-on-surface-variant font-medium flex-wrap"
            >
              <span>Chuyên gia</span>
              <span className="text-outline-variant">/</span>
              <span>Ngân hàng Câu hỏi 5 Tầng &amp; Rubric (SCR-16)</span>
              <span className="text-outline-variant">/</span>
              <span className="font-mono text-primary font-semibold px-2 py-0.5 rounded bg-primary-container/40">
                {conceptSlug}
              </span>
            </nav>
            <span className="w-1 h-1 rounded-full bg-outline-variant hidden sm:inline" />
            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-tertiary-fixed/20 text-tertiary text-[11px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-tertiary" />
              <span>Tầng {depthTier} &bull; {taskType}</span>
            </div>
          </div>

          {/* Studio Navigation Controls */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('expert_domains')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-xs font-semibold text-on-surface transition-all shadow-2xs cursor-pointer"
            >
              <GitBranch className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
              <span>1. Đồ thị DAG</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('expert_code')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-xs font-semibold text-on-surface transition-all shadow-2xs cursor-pointer"
            >
              <Code2 className="w-3.5 h-3.5 text-secondary" aria-hidden="true" />
              <span>3. Code Sandbox</span>
            </button>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-container text-on-primary-container font-semibold text-xs shadow-2xs">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
              <span>INV-DEPTH-01 Guardrail</span>
            </div>
          </div>
        </div>

        {/* 2. Filter & 5-Depth Concept Navigation Bar (4 primary selects first: Domain, Concept, Tier, TaskType) */}
        <div className="p-4 rounded-xl bg-surface-container-low/80 border border-outline-variant/25 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Select 0: Domain */}
            <div className="bg-surface-container-lowest p-3 rounded-xl shadow-2xs border border-outline-variant/20">
              <label
                htmlFor="scr16-select-domain"
                className="block text-[10px] uppercase font-bold tracking-wider text-on-surface-variant mb-1"
              >
                Lĩnh vực kiến trúc
              </label>
              <select
                id="scr16-select-domain"
                value={selectedDomain}
                onChange={(e) => setSelectedDomain(e.target.value)}
                className="w-full text-xs font-bold text-on-surface bg-transparent focus:outline-none cursor-pointer"
              >
                {domains.map((d) => (
                  <option key={d.slug} value={d.slug}>
                    {d.title} ({d.total_nodes} Nodes)
                  </option>
                ))}
              </select>
            </div>

            {/* Select 1: Concept Node */}
            <div className="bg-surface-container-lowest p-3 rounded-xl shadow-2xs border border-outline-variant/20">
              <label
                htmlFor="scr16-select-concept"
                className="block text-[10px] uppercase font-bold tracking-wider text-on-surface-variant mb-1"
              >
                Khái niệm mục tiêu (Node)
              </label>
              <select
                id="scr16-select-concept"
                value={conceptSlug}
                onChange={(e) => setConceptSlug(e.target.value)}
                className="w-full text-xs font-bold font-mono text-on-surface bg-transparent focus:outline-none cursor-pointer"
              >
                {concepts.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    [T{c.tier}] {c.title} ({c.slug})
                  </option>
                ))}
              </select>
            </div>

            {/* Select 2: Depth Tier */}
            <div className="bg-surface-container-lowest p-3 rounded-xl shadow-2xs border border-outline-variant/20">
              <label
                htmlFor="scr16-select-tier"
                className="block text-[10px] uppercase font-bold tracking-wider text-on-surface-variant mb-1"
              >
                Tầng sâu (1–5)
              </label>
              <select
                id="scr16-select-tier"
                value={depthTier}
                onChange={(e) => setDepthTier(Number(e.target.value))}
                className="w-full text-xs font-bold text-on-surface bg-transparent focus:outline-none cursor-pointer"
              >
                {[1, 2, 3, 4, 5].map((t) => (
                  <option key={t} value={t}>
                    Tầng {t}
                  </option>
                ))}
              </select>
            </div>

            {/* Select 3: Task Type (IMPORTANT: 4th select index 3 for E2E audit) */}
            <div className="bg-surface-container-lowest p-3 rounded-xl shadow-2xs border border-outline-variant/20">
              <label
                htmlFor="scr16-select-tasktype"
                className="block text-[10px] uppercase font-bold tracking-wider text-on-surface-variant mb-1"
              >
                Dạng bài Đánh giá
              </label>
              <select
                id="scr16-select-tasktype"
                value={taskType}
                onChange={(e) => setTaskType(e.target.value)}
                className="w-full text-xs font-bold text-on-surface bg-transparent focus:outline-none cursor-pointer"
              >
                <option value="mcq">Trắc nghiệm (Tầng 1–2)</option>
                <option value="troubleshooting">Troubleshooting (Tầng 3)</option>
                <option value="constraint_shifting">Constraint Shifting (Tầng 4)</option>
                <option value="teach_back">Teach-back (Tầng 5)</option>
              </select>
            </div>
          </div>

          {/* 5-Depth Stepper / Interactive Tabs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            {DEPTH_TIER_META.map((item) => {
              const isActive = depthTier === item.tier
              return (
                <button
                  key={item.tier}
                  type="button"
                  onClick={() => {
                    setDepthTier(item.tier)
                    setTaskType(item.defaultTask)
                  }}
                  className={`flex items-start gap-2.5 p-2.5 rounded-xl text-left transition-all relative overflow-hidden cursor-pointer ${
                    isActive
                      ? 'bg-primary-container/35 shadow-sm ring-1 ring-primary'
                      : 'bg-surface-container-lowest hover:bg-surface-container shadow-2xs'
                  }`}
                >
                  {isActive && <div className="absolute top-0 left-0 right-0 h-1 bg-primary" />}
                  <span
                    className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 font-bold text-xs ${
                      isActive
                        ? 'bg-primary text-on-primary'
                        : 'bg-secondary-container text-on-secondary-container'
                    }`}
                  >
                    {item.tier}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`text-[11px] font-bold tracking-tight uppercase ${
                          isActive ? 'text-primary' : 'text-on-surface'
                        }`}
                      >
                        {item.short}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          isActive
                            ? 'bg-tertiary-fixed/30 text-tertiary'
                            : 'bg-surface-container text-on-surface-variant'
                        }`}
                      >
                        {isActive ? 'Đang chọn' : `T${item.tier}`}
                      </span>
                    </div>
                    <p className="text-[11px] text-on-surface-variant truncate mt-0.5">
                      {item.desc}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* 3. Main Authoring Workspace: 2-Column Bespoke Layout (7/12 Left + 5/12 Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: 5-Depth Question & Scenario Editor (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Editor Header & Format Selector Card */}
          <div className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm border border-outline-variant/25 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex p-1.5 rounded-md bg-primary-container text-primary">
                    <Brain className="w-4 h-4" aria-hidden="true" />
                  </span>
                  <h1 className="text-sm font-bold text-on-surface uppercase tracking-wide">
                    Trình biên tập Tình huống Đánh giá Thực tế
                  </h1>
                </div>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Thiết lập câu hỏi đào sâu tư duy kiến trúc &amp; tiêu chí chấm điểm cho khái niệm{' '}
                  <code className="font-mono font-bold text-primary">{conceptSlug}</code>
                </p>
              </div>
              <span className="px-2.5 py-1 rounded bg-surface-container font-mono text-xs font-bold text-on-surface">
                {conceptSlug.toUpperCase()}-T{depthTier}
              </span>
            </div>

            {/* Format Quick Cards */}
            <div className="space-y-1.5">
              <span className="text-[11px] uppercase font-bold text-on-surface-variant tracking-wider block">
                Định dạng Đánh giá Thực tiễn
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {FORMAT_CARDS.map((fmt) => {
                  const activeFmt = taskType === fmt.key
                  return (
                    <button
                      key={fmt.key}
                      type="button"
                      onClick={() => setTaskType(fmt.key)}
                      className={`px-3 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                        activeFmt
                          ? 'bg-primary text-on-primary shadow-sm'
                          : 'bg-surface-container-low hover:bg-surface-container text-on-surface'
                      }`}
                    >
                      <span className="text-[11px] font-bold flex items-center justify-between">
                        <span>{fmt.tag}</span>
                        <span className="font-mono text-[10px] opacity-85">{fmt.tiers}</span>
                      </span>
                      <span
                        className={`text-[10px] block leading-tight mt-0.5 ${
                          activeFmt ? 'text-on-primary/90' : 'text-on-surface-variant'
                        }`}
                      >
                        {fmt.title}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Prompt & Progressive Constraint Card */}
          <div className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm border border-outline-variant/25 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-tertiary" aria-hidden="true" />
                <h2 className="text-xs font-bold text-on-surface uppercase tracking-wide">
                  Đề bài Thách thức Đào sâu (Prompt Học viên)
                </h2>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-container text-on-surface-variant">
                Ngưỡng đạt tầng &ge; 75%
              </span>
            </div>

            <div>
              <label
                htmlFor="scr16-prompt-textarea"
                className="block text-xs font-bold text-on-surface-variant mb-1.5"
              >
                Nội dung tình huống kỹ thuật hoặc câu hỏi phản biện:
              </label>
              <textarea
                id="scr16-prompt-textarea"
                rows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Nhập nội dung câu hỏi đánh giá chiều sâu, thông số tải mục tiêu, giới hạn tài nguyên..."
                className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-low p-3.5 text-sm text-on-surface focus:bg-surface-container-lowest focus:border-primary focus:outline-none leading-relaxed"
              />
            </div>

            {/* Gate 3 Invariant: MCQ 4 options A/B/C/D + correct_option_key when taskType === 'mcq' */}
            {taskType === 'mcq' && (
              <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
                  <span className="text-on-surface flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-primary" aria-hidden="true" />
                    <span>4 Phương án Trắc nghiệm Khách quan (A, B, C, D)</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <label htmlFor="mcq-correct-key" className="text-on-surface-variant">
                      Đáp án đúng:
                    </label>
                    <select
                      id="mcq-correct-key"
                      value={correctOptionKey}
                      onChange={(e) =>
                        setCorrectOptionKey(e.target.value as 'A' | 'B' | 'C' | 'D')
                      }
                      className="rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-2.5 py-1 text-xs font-mono font-bold text-primary"
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
                  {(['A', 'B', 'C', 'D'] as const).map((k) => {
                    const isCorrect = correctOptionKey === k
                    return (
                      <div
                        key={k}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border transition-colors ${
                          isCorrect
                            ? 'bg-primary-container/20 border-primary'
                            : 'bg-surface-container-lowest border-outline-variant/30'
                        }`}
                      >
                        <span
                          className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold shrink-0 ${
                            isCorrect
                              ? 'bg-primary text-on-primary'
                              : 'bg-surface-container text-on-surface'
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
                          className="flex-1 text-xs bg-transparent text-on-surface focus:outline-none"
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {taskType !== 'mcq' && (
              <div className="space-y-1.5">
                <label
                  htmlFor="scr16-ref-exp"
                  className="block text-xs font-bold text-on-surface-variant"
                >
                  Lời giải thích chuẩn tham chiếu cho Gia sư AI Socratic (Reference Explanation):
                </label>
                <input
                  id="scr16-ref-exp"
                  value={refExp}
                  onChange={(e) => setRefExp(e.target.value)}
                  placeholder="Lời giải thích tham khảo chuẩn kiến trúc cho AI Tutor..."
                  className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-3.5 py-2.5 text-xs text-on-surface focus:bg-surface-container-lowest focus:border-primary focus:outline-none"
                />
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Structured Rubric & Deterministic Fallback Builder (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Rubric Header Card */}
          <div className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm border border-outline-variant/25 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-flex p-1.5 rounded-md bg-secondary-container text-on-secondary-container">
                  <FileQuestion className="w-4 h-4" aria-hidden="true" />
                </span>
                <h2 className="text-sm font-bold text-on-surface uppercase tracking-wide">
                  Cấu hình Tiêu chí Rubric Có Cấu trúc
                </h2>
              </div>
              <span className="text-xs font-mono font-bold text-primary">
                {taskType === 'mcq' ? 'MCQ Tất định' : `${criteria.length} Tiêu chí`}
              </span>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Tiêu chí chấm điểm dùng cho LLM Evaluator kết hợp cơ chế Fallback Tất định (
              <em className="italic">Deterministic Keyword Guardrail</em>) nếu LLM không phản hồi.
            </p>
          </div>

          {taskType === 'mcq' ? (
            <div className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm border border-outline-variant/25 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-on-surface">Chế độ Chấm Trắc nghiệm Tất định</span>
                <span className="font-mono text-primary">Đáp án chuẩn: {correctOptionKey}</span>
              </div>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Ở Tầng 1–2 (What / How), hệ thống đối chiếu trực tiếp khóa đáp án{' '}
                <code className="font-mono font-bold text-primary">
                  correct_option_key = {correctOptionKey}
                </code>{' '}
                với độ trễ &lt; 5ms. Chọn sang Tầng 3–5 (Troubleshooting / Constraint Shifting /
                Teach-back) để cấu hình bảng trọng số Rubric.
              </p>
            </div>
          ) : (
            <div className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm border border-outline-variant/25 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
                <span className="text-on-surface">Bảng Trọng số Rubric (Tổng phải bằng 1.0)</span>
                <div className="flex items-center gap-3">
                  <span className={isWeightValid ? 'text-primary font-mono' : 'text-error font-mono'}>
                    Tổng hiện tại: {totalWeight}
                  </span>
                  <button
                    type="button"
                    onClick={handleAddCriterion}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-container-low border border-outline-variant/30 text-primary hover:bg-surface-container cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Thêm tiêu chí</span>
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {criteria.map((row, idx) => {
                  const kwList = row.keywords
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean)
                  return (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/25 space-y-2.5 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 font-bold text-on-surface">
                          <span className="w-5 h-5 rounded-full bg-secondary-container text-on-secondary-container text-[11px] font-bold flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <span>Tiêu chí #{idx + 1}</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-primary">
                            {Math.round(Number(row.weight || 0) * 100)} Điểm
                          </span>
                          <button
                            type="button"
                            disabled={criteria.length <= 1}
                            onClick={() => handleRemoveCriterion(idx)}
                            className="p-1 rounded-lg text-error hover:bg-error-container/20 disabled:opacity-30 cursor-pointer"
                            title="Xóa tiêu chí"
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                        <input
                          value={row.name}
                          onChange={(e) =>
                            setCriteria((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, name: e.target.value } : r)),
                            )
                          }
                          placeholder="Tên tiêu chí"
                          className="sm:col-span-8 rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-2.5 py-1.5"
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
                          className="sm:col-span-4 rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-2.5 py-1.5 font-mono"
                        />
                      </div>

                      <div>
                        <input
                          value={row.keywords}
                          onChange={(e) =>
                            setCriteria((prev) =>
                              prev.map((r, i) =>
                                i === idx ? { ...r, keywords: e.target.value } : r,
                              ),
                            )
                          }
                          placeholder="Từ khóa fallback (phân tách bằng dấu phẩy)"
                          className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-2.5 py-1.5 font-mono"
                        />
                        {kwList.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {kwList.map((kw) => (
                              <span
                                key={kw}
                                className="px-2 py-0.5 rounded bg-surface-container text-[10px] font-mono text-on-surface font-semibold"
                              >
                                {kw}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Deterministic Fallback Engine Status Card */}
          <div className="bg-surface-container-lowest p-4 rounded-2xl shadow-sm border border-outline-variant/25 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-on-surface uppercase tracking-wide flex items-center gap-1.5">
                <Terminal className="w-4 h-4 text-secondary" aria-hidden="true" />
                <span>Bộ chấm Deterministic Fallback Engine</span>
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-primary">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span>Ready</span>
              </span>
            </div>
            <div className="p-3 rounded-xl bg-surface-container font-mono text-[11px] space-y-1.5 text-on-surface">
              <div className="flex justify-between text-on-surface-variant">
                <span>Tokenizer Keyword Guardrail:</span>
                <span className="text-primary font-bold">
                  {taskType === 'mcq'
                    ? `Option ${correctOptionKey} locked`
                    : `${totalKeywordsCount} keywords active`}
                </span>
              </div>
              <div className="w-full bg-surface-container-highest rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-1.5 rounded-full ${isWeightValid ? 'bg-primary' : 'bg-error'}`}
                  style={{ width: isWeightValid ? '100%' : '50%' }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Status & Error Alerts */}
      {errorMsg && (
        <div
          role="alert"
          className="p-3.5 rounded-xl bg-error-container/20 border border-error/40 text-xs font-bold text-error flex items-center gap-2"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}
      {statusMsg && (
        <div className="p-3.5 rounded-xl bg-primary-container/30 border border-primary/30 text-xs font-bold text-on-primary-container flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
          <span>{statusMsg}</span>
        </div>
      )}

      {/* 4. Sticky Bottom Action Footer Panel */}
      <div className="w-full bg-surface-container-lowest rounded-2xl border border-surface-container-highest px-5 py-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-on-surface-variant">
          <ShieldCheck className="w-4 h-4 text-primary" aria-hidden="true" />
          <span>
            Kiểm định cấu trúc:{' '}
            <strong className={isWeightValid && isMcqValid ? 'text-primary' : 'text-error'}>
              {isWeightValid && isMcqValid
                ? 'Hợp lệ để lưu vào Ngân hàng Đề 5 Tầng'
                : 'Vui lòng hoàn thiện đầy đủ trường dữ liệu & tổng trọng số = 1.0'}
            </strong>
          </span>
        </div>

        <button
          type="button"
          disabled={submitting || !prompt.trim() || !isWeightValid || !isMcqValid}
          onClick={() => void handleSave()}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-dim disabled:opacity-45 text-on-primary text-xs font-bold transition-all shadow-sm cursor-pointer"
        >
          <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
          <span>{submitting ? 'Đang lưu...' : 'Lưu Câu hỏi & Rubric'}</span>
        </button>
      </div>
    </section>
  )
}
