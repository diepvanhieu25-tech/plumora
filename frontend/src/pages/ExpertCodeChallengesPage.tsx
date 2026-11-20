import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Code2,
  Cpu,
  FileQuestion,
  FolderLock,
  GitBranch,
  Loader2,
  Lock,
  Plus,
  RotateCcw,
  Shield,
  ShieldCheck,
  Terminal,
  Trash2,
  UserCheck,
  WifiOff,
} from 'lucide-react'
import {
  apiExpertCreateCodeChallenge,
  apiGetDomainRoadmap,
  apiGetDomains,
} from '../api'
import type { ActiveView, DomainListItem, DomainRoadmapNode } from '../types'

interface ExpertCodeChallengesPageProps {
  onNavigate: (view: ActiveView) => void
}

interface TestCaseRow {
  name: string
  call: string
  expected: string
  is_hidden: boolean
}

const DEFAULT_STARTER_CODE = 'def solve(x):\n    return x\n'
const DEFAULT_SOLUTION_CODE = 'def solve(x):\n    return x * 2\n'

export function ExpertCodeChallengesPage({ onNavigate }: ExpertCodeChallengesPageProps) {
  const [domains, setDomains] = useState<DomainListItem[]>([])
  const [selectedDomain, setSelectedDomain] = useState('backend')
  const [concepts, setConcepts] = useState<DomainRoadmapNode[]>([])
  const [conceptSlug, setConceptSlug] = useState('net-internet')
  const [title, setTitle] = useState('')
  const [prompt, setPrompt] = useState('')
  const [activeEditorTab, setActiveEditorTab] = useState<'starter' | 'solution'>('starter')
  const [starterCode, setStarterCode] = useState(DEFAULT_STARTER_CODE)
  const [solutionCode, setSolutionCode] = useState(DEFAULT_SOLUTION_CODE)
  const [testCases, setTestCases] = useState<TestCaseRow[]>([
    { name: 'Double 5', call: 'solve(5)', expected: '10', is_hidden: false },
  ])
  const [loadingDomains, setLoadingDomains] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      setLoadingDomains(true)
      try {
        const res = await apiGetDomains()
        setDomains(res.domains)
        if (res.domains.length > 0) setSelectedDomain(res.domains[0].slug)
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Không thể tải danh sách lĩnh vực')
      } finally {
        setLoadingDomains(false)
      }
    })()
  }, [])

  useEffect(() => {
    if (!selectedDomain) return
    void (async () => {
      try {
        const rm = await apiGetDomainRoadmap(selectedDomain, 0)
        setConcepts(rm.nodes)
        if (rm.nodes.length > 0) setConceptSlug(rm.nodes[0].slug)
      } catch (err) {
        setConcepts([])
        setErrorMsg(err instanceof Error ? err.message : 'Không thể tải danh sách khái niệm')
      }
    })()
  }, [selectedDomain])

  function handleAddTestCase() {
    setTestCases((prev) => [
      ...prev,
      { name: `Test ${prev.length + 1}`, call: 'solve(0)', expected: '0', is_hidden: true },
    ])
  }

  function handleRemoveTestCase(idx: number) {
    if (testCases.length <= 1) return
    setTestCases((prev) => prev.filter((_, i) => i !== idx))
  }

  function parseExpected(raw: string): unknown {
    try {
      return JSON.parse(raw)
    } catch {
      return raw
    }
  }

  async function handleSave() {
    setErrorMsg(null)
    setStatusMsg(null)
    setSubmitting(true)
    try {
      const res = await apiExpertCreateCodeChallenge(conceptSlug.trim(), {
        title: title.trim() || 'Bài tập Thực hành Code',
        language: 'python',
        prompt: prompt.trim() || 'Hoàn thiện hàm solve(x).',
        buggy_starter_code: starterCode,
        solution_code: solutionCode,
        test_cases: testCases.map((tc) => ({
          name: tc.name,
          call: tc.call,
          expected: parseExpected(tc.expected),
          is_hidden: tc.is_hidden,
        })),
        timeout_ms: 3000,
        memory_limit_mb: 128,
      })
      setStatusMsg(`Solution Code đã pass 100% Test Cases trên Sandbox (ID: ${res.item_id}).`)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Lỗi kiểm thử bài tập Code')
    } finally {
      setSubmitting(false)
    }
  }

  const publicCount = testCases.filter((t) => !t.is_hidden).length
  const hiddenCount = testCases.filter((t) => t.is_hidden).length
  const activeCode = activeEditorTab === 'starter' ? starterCode : solutionCode
  const lineCount = Math.max(13, activeCode.split('\n').length)

  return (
    <section
      className="w-full max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 pb-8 space-y-5 text-on-surface"
      data-testid="scr17-expert-code"
    >
      {/* 1. Top Navigation & Metadata Context Bar */}
      <div className="w-full bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/25 p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-2 text-xs font-label text-on-surface-variant flex-wrap"
          >
            <span>Chuyên gia</span>
            <span className="text-outline-variant">/</span>
            <span>Ngân hàng Bài tập Thực hành (SCR-17)</span>
            <span className="text-outline-variant">/</span>
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-surface-container font-mono text-[11px] font-semibold text-on-surface">
              <span>{conceptSlug}</span>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary" />
              <span className="text-on-surface-variant font-label text-[10px]">
                {selectedDomain}
              </span>
            </div>
          </nav>

          {/* Studio Navigation & Status */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs font-label px-2.5 py-1 rounded bg-tertiary-fixed/20 text-tertiary">
              <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-ping" />
              <span className="font-semibold">Bản nháp Studio</span>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('expert_domains')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface-container-low hover:bg-surface-container text-on-surface transition-colors cursor-pointer"
            >
              <GitBranch className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
              <span>1. Đồ thị DAG</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('expert_questions')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface-container-low hover:bg-surface-container text-on-surface transition-colors cursor-pointer"
            >
              <FileQuestion className="w-3.5 h-3.5 text-secondary" aria-hidden="true" />
              <span>2. Đề 5 Tầng &amp; Rubric</span>
            </button>
          </div>
        </div>

        {/* Title Header & Runtime Row */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="px-2.5 py-1 rounded bg-surface-container-high font-mono text-xs font-bold text-primary">
              #SBX-{conceptSlug.toUpperCase()}
            </span>
            <h1 className="text-xl sm:text-2xl font-headline font-bold text-on-surface tracking-tight">
              {title.trim() || 'Thiết kế Bài tập Code Sandbox & Kiểm thử Tự động'}
            </h1>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-container-low border border-outline-variant/25 text-xs font-label self-start lg:self-auto">
            <Terminal className="w-4 h-4 text-secondary" aria-hidden="true" />
            <span className="text-on-surface-variant">Runtime:</span>
            <span className="font-mono font-semibold text-on-surface">Python 3.12 Worker</span>
          </div>
        </div>

        {/* INV-SANDBOX-01 Security & Isolation Policy Strip */}
        <div className="w-full p-3 rounded-xl bg-surface-container-low flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-primary font-semibold font-label">
            <ShieldCheck className="w-4 h-4" aria-hidden="true" />
            <span className="tracking-wide">INV-SANDBOX-01 ENFORCED</span>
            <span className="text-outline-variant font-normal hidden md:inline">|</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap font-mono text-[11px]">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-container-lowest shadow-2xs text-on-surface">
              <WifiOff className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
              <span>network_mode: none</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-container-lowest shadow-2xs text-on-surface">
              <FolderLock className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
              <span>ReadOnly RootFS: tmpfs /tmp</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-container-lowest shadow-2xs text-on-surface">
              <UserCheck className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
              <span>UID: 10001 (sandbox-runner)</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-container-lowest shadow-2xs text-on-surface">
              <Clock className="w-3.5 h-3.5 text-tertiary" aria-hidden="true" />
              <span>Max Timeout: 3000ms</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-container-lowest shadow-2xs text-on-surface">
              <Cpu className="w-3.5 h-3.5 text-secondary" aria-hidden="true" />
              <span>Max RAM: 128MB</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary-container/40 text-on-primary-container font-semibold">
              <Shield className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
              <span>AST &amp; RLIMIT Enforced</span>
            </span>
          </div>
        </div>

        {/* Metadata & Prompt Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          <div>
            <label
              htmlFor="scr17-domain-select"
              className="block text-xs font-bold text-on-surface-variant mb-1"
            >
              Lĩnh vực
            </label>
            <select
              id="scr17-domain-select"
              value={selectedDomain}
              onChange={(e) => setSelectedDomain(e.target.value)}
              className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-3 py-2 text-xs font-bold text-on-surface focus:outline-none focus:border-primary"
            >
              {domains.map((d) => (
                <option key={d.slug} value={d.slug}>
                  {d.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="scr17-concept-select"
              className="block text-xs font-bold text-on-surface-variant mb-1"
            >
              Khái niệm (Node)
            </label>
            <select
              id="scr17-concept-select"
              value={conceptSlug}
              onChange={(e) => setConceptSlug(e.target.value)}
              className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-3 py-2 text-xs font-mono font-bold text-on-surface focus:outline-none focus:border-primary"
            >
              {concepts.map((c) => (
                <option key={c.slug} value={c.slug}>
                  [T{c.tier}] {c.title} ({c.slug})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="scr17-title-input"
              className="block text-xs font-bold text-on-surface-variant mb-1"
            >
              Tiêu đề bài tập
            </label>
            <input
              id="scr17-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="vd: Chống Race Condition & N+1 Query"
              className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-3 py-2 text-xs text-on-surface focus:bg-surface-container-lowest focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="scr17-prompt-textarea"
            className="block text-xs font-bold text-on-surface-variant mb-1"
          >
            Đề bài &amp; Yêu cầu Refactoring
          </label>
          <textarea
            id="scr17-prompt-textarea"
            rows={2}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Mô tả yêu cầu bài tập Code Review & Refactoring..."
            className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-low p-3 text-xs text-on-surface focus:bg-surface-container-lowest focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      {/* 2. Two-Column Code Challenge Studio */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (6 cols): Dual Editor Panel */}
        <div className="lg:col-span-6 flex flex-col rounded-2xl bg-surface-container-lowest shadow-sm border border-outline-variant/25 overflow-hidden">
          {/* Editor Tabs */}
          <div className="flex items-center justify-between bg-surface-container-low px-4 pt-3 gap-2 overflow-x-auto">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveEditorTab('starter')}
                className={`px-4 py-2 text-xs font-label rounded-t-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeEditorTab === 'starter'
                    ? 'font-bold bg-[#0F172A] text-amber-400 shadow-2xs'
                    : 'font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Buggy Starter Code (Mã nguồn lỗi)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveEditorTab('solution')}
                className={`px-4 py-2 text-xs font-label rounded-t-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeEditorTab === 'solution'
                    ? 'font-bold bg-[#0F172A] text-emerald-400 shadow-2xs'
                    : 'font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Reference Solution (Mã chuẩn)</span>
              </button>
            </div>
            <span className="text-[11px] font-mono text-on-surface-variant pb-2 pr-2 hidden sm:inline">
              {conceptSlug}.py
            </span>
          </div>

          {/* Editor Sub-Toolbar */}
          <div className="bg-[#1E293B] px-4 py-2 flex items-center justify-between text-xs font-label text-slate-300">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                <span>Python 3.12</span>
              </div>
              <span className="text-slate-600">|</span>
              <span className="text-slate-400 font-mono text-[11px]">UTF-8 &bull; 4 spaces</span>
            </div>
            <button
              type="button"
              onClick={() => {
                if (activeEditorTab === 'starter') setStarterCode(DEFAULT_STARTER_CODE)
                else setSolutionCode(DEFAULT_SOLUTION_CODE)
              }}
              className="px-2.5 py-1 rounded bg-slate-700/60 hover:bg-slate-700 text-slate-200 transition-colors flex items-center gap-1 text-[11px] cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" aria-hidden="true" />
              <span>Khôi phục mẫu</span>
            </button>
          </div>

          {/* Code Block Container with Line Numbers */}
          <div className="bg-[#0F172A] p-4 flex font-mono text-xs leading-6">
            <div
              className="select-none text-slate-600 text-right pr-3 border-r border-slate-800 space-y-0"
              aria-hidden="true"
            >
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i}>{String(i + 1).padStart(2, '0')}</div>
              ))}
            </div>
            {activeEditorTab === 'starter' ? (
              <textarea
                aria-label="Buggy Starter Code"
                rows={13}
                value={starterCode}
                onChange={(e) => setStarterCode(e.target.value)}
                spellCheck={false}
                className="flex-1 w-full bg-transparent text-slate-100 pl-3 font-mono text-xs leading-6 focus:outline-none resize-y"
              />
            ) : (
              <textarea
                aria-label="Reference Solution Code"
                rows={13}
                value={solutionCode}
                onChange={(e) => setSolutionCode(e.target.value)}
                spellCheck={false}
                className="flex-1 w-full bg-transparent text-emerald-300 pl-3 font-mono text-xs leading-6 focus:outline-none resize-y"
              />
            )}
          </div>

          {/* Technical Annotation Footer */}
          <div className="p-3.5 bg-surface-container flex items-center gap-2 text-xs text-on-surface-variant font-label">
            <ShieldCheck className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
            <span>
              <strong>Mã chuẩn Reference:</strong> Bắt buộc pass 100% Test Cases trên Worker cô lập
              trước khi bài tập được lưu vào CSDL.
            </span>
          </div>
        </div>

        {/* Right Column (6 cols): Automated Test Suite & Dry-Run Execution Panel */}
        <div className="lg:col-span-6 flex flex-col gap-4">
          {/* Header & Add Test Case Row */}
          <div className="p-5 rounded-2xl bg-surface-container-lowest shadow-sm border border-outline-variant/25 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-headline font-bold text-on-surface">
                  Bộ Kiểm thử Tự động (Automated Test Suite)
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-[11px] font-bold">
                  {testCases.length} Tests
                </span>
              </div>
              <p className="text-xs text-on-surface-variant font-label">
                {publicCount} Công khai (Public Guide), {hiddenCount} Ẩn (Hidden Anti-Hardcode).
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddTestCase}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold font-label transition-colors self-start sm:self-auto shadow-2xs cursor-pointer"
            >
              <Plus className="w-4 h-4 text-primary" aria-hidden="true" />
              <span>Thêm Test Case mới</span>
            </button>
          </div>

          {/* Test Case Cards List */}
          <div className="flex flex-col gap-3">
            {testCases.map((tc, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/25 flex flex-col gap-2.5"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    {tc.is_hidden ? (
                      <Lock className="w-4 h-4 text-tertiary" aria-hidden="true" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-primary" aria-hidden="true" />
                    )}
                    <span className="font-mono font-bold text-xs text-on-surface">
                      Test #{idx + 1}: {tc.name || `test_${idx + 1}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded font-label text-[10px] font-bold ${
                        tc.is_hidden
                          ? 'bg-tertiary-fixed/30 text-tertiary'
                          : 'bg-primary-container/60 text-on-primary-container'
                      }`}
                    >
                      {tc.is_hidden ? 'Ẩn (Hidden Anti-Hardcode)' : 'Công khai (Public)'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTestCase(idx)}
                      disabled={testCases.length <= 1}
                      aria-label="Xóa test case"
                      className="p-1 text-on-surface-variant hover:text-error disabled:opacity-35 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center text-xs">
                  <input
                    value={tc.name}
                    onChange={(e) =>
                      setTestCases((prev) =>
                        prev.map((r, i) => (i === idx ? { ...r, name: e.target.value } : r)),
                      )
                    }
                    placeholder="Tên test case"
                    className="sm:col-span-3 rounded-lg border border-outline-variant/40 bg-surface-container-low px-2.5 py-1.5"
                  />
                  <input
                    value={tc.call}
                    onChange={(e) =>
                      setTestCases((prev) =>
                        prev.map((r, i) => (i === idx ? { ...r, call: e.target.value } : r)),
                      )
                    }
                    placeholder="solve(5)"
                    className="sm:col-span-4 rounded-lg border border-outline-variant/40 bg-surface-container-low px-2.5 py-1.5 font-mono"
                  />
                  <input
                    value={tc.expected}
                    onChange={(e) =>
                      setTestCases((prev) =>
                        prev.map((r, i) => (i === idx ? { ...r, expected: e.target.value } : r)),
                      )
                    }
                    placeholder="Expected JSON"
                    className="sm:col-span-3 rounded-lg border border-outline-variant/40 bg-surface-container-low px-2.5 py-1.5 font-mono"
                  />
                  <label className="sm:col-span-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-on-surface cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tc.is_hidden}
                      onChange={(e) =>
                        setTestCases((prev) =>
                          prev.map((r, i) =>
                            i === idx ? { ...r, is_hidden: e.target.checked } : r,
                          ),
                        )
                      }
                      className="accent-primary"
                    />
                    <span>Test ẩn</span>
                  </label>
                </div>

                <div className="p-2 rounded-lg bg-surface-container-low font-mono text-[11px] text-on-surface">
                  <span className="text-secondary font-bold">assert</span> {tc.call} =={' '}
                  {tc.expected}
                </div>
              </div>
            ))}
          </div>

          {/* Dry-Run Verification Status Banner */}
          <div className="p-4 rounded-xl bg-primary-container/25 border border-primary/25 shadow-2xs flex flex-col gap-2">
            <div className="flex items-center gap-2 text-on-primary-container font-headline font-bold text-xs">
              <ShieldCheck className="w-4 h-4 text-primary" aria-hidden="true" />
              <span>Quy trình Kiểm chứng Dry-Run Test Engine</span>
            </div>
            <p className="text-xs text-on-surface leading-relaxed">
              Khi bấm lưu, hệ thống tự động thực thi{' '}
              <strong className="text-primary">Reference Solution</strong> với toàn bộ{' '}
              {testCases.length} Test Cases trên Sandbox Worker cô lập. Chỉ những bài tập có mã giải
              đạt 100% mới được phép xuất bản.
            </p>
          </div>

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
            <div className="p-3.5 rounded-xl bg-primary-container/35 border border-primary/35 text-xs font-bold text-on-primary-container flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
              <span>{statusMsg}</span>
            </div>
          )}

          {/* Bottom Action Bar */}
          <div className="p-4 rounded-2xl bg-surface-container-lowest shadow-sm border border-outline-variant/25 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs font-label text-on-surface-variant">
              <Terminal className="w-4 h-4 text-primary" aria-hidden="true" />
              <span>Sandbox Dry-Run: Sẵn sàng ({testCases.length} test cases)</span>
            </div>
            <button
              type="button"
              disabled={submitting || loadingDomains || !conceptSlug}
              onClick={() => void handleSave()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-dim disabled:opacity-50 text-on-primary text-xs font-label font-bold transition-all shadow-sm cursor-pointer"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
              )}
              <span>
                {submitting
                  ? 'Đang chạy thử Solution Code trên Sandbox Worker...'
                  : 'Chạy Thử Test Cases & Lưu Bài Code'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
