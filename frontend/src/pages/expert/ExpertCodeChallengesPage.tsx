import { useCallback, useEffect, useState } from 'react'
import { Database, Plus, RefreshCw } from 'lucide-react'
import {
  apiExpertDryRunCodeChallenge,
  apiExpertGetDomainGraph,
  apiExpertListCodeChallenges,
  apiExpertPublishCodeChallenge,
  apiGetDomains,
} from '../../api'
import { ExpertChallengeCodeEditor } from '../../components/expert/ExpertChallengeCodeEditor'
import {
  ExpertChallengeTestCasesPanel,
  type TestCaseRow,
} from '../../components/expert/ExpertChallengeTestCasesPanel'
import { useOptionalBackOfficeStudio } from '../../shells/BackOfficeStudioContext'
import type {
  BackOfficeView,
  CodeLanguage,
  ExpertCodeChallengeItem,
  ExpertGraphNodeItem,
  SandboxTestResultItem,
} from '../../types/expert'
import type { DomainListItem } from '../../types/learnerV2'

export interface ExpertCodeChallengesPageProps {
  onNavigate?: (view: BackOfficeView, params?: { domainSlug?: string; conceptSlug?: string }) => void
}

function defaultStarterForLanguage(lang: CodeLanguage): string {
  if (lang === 'sql') return 'SELECT id, name FROM items;'
  if (lang === 'javascript') return 'function solve(x) {\n  return x;\n}\n'
  return 'def solve(x):\n    return x\n'
}

function defaultSolutionForLanguage(lang: CodeLanguage): string {
  if (lang === 'sql') return 'SELECT id, name FROM items ORDER BY id ASC;'
  if (lang === 'javascript') return 'function solve(x) {\n  return x * 2;\n}\n'
  return 'def solve(x):\n    return x * 2\n'
}

function extractTestResultsFromError(err: unknown): SandboxTestResultItem[] {
  if (err && typeof err === 'object' && 'detail' in err) {
    const detail = (err as { detail?: { test_results?: unknown } }).detail
    if (Array.isArray(detail?.test_results)) {
      return detail.test_results as SandboxTestResultItem[]
    }
  }
  return []
}

export function ExpertCodeChallengesPage({ onNavigate }: ExpertCodeChallengesPageProps = {}) {
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
  const [existingChallenges, setExistingChallenges] = useState<ExpertCodeChallengeItem[]>([])
  const [selectedChallengeId, setSelectedChallengeId] = useState<string | null>(null)
  const [loadingChallenges, setLoadingChallenges] = useState(false)

  // Form state
  const [title, setTitle] = useState('')
  const [language, setLanguage] = useState<CodeLanguage>('python')
  const [timeoutMs, setTimeoutMs] = useState(3000)
  const [memoryLimitMb, setMemoryLimitMb] = useState(128)
  const [prompt, setPrompt] = useState('')
  const [setupSql, setSetupSql] = useState('')
  const [starterCode, setStarterCode] = useState(defaultStarterForLanguage('python'))
  const [solutionCode, setSolutionCode] = useState(defaultSolutionForLanguage('python'))
  const [testCases, setTestCases] = useState<TestCaseRow[]>([
    { name: 'Test 1', call: 'solve(5)', expected: '10', is_hidden: false },
  ])

  const [submitting, setSubmitting] = useState(false)
  const [dryRunning, setDryRunning] = useState(false)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [verificationResults, setVerificationResults] = useState<SandboxTestResultItem[]>([])
  const [verificationMeta, setVerificationMeta] = useState<{
    runtimeMs: number
    memoryKb: number
    starterFailed: boolean
  } | null>(null)

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

  const hydrateFromChallenge = useCallback((ch: ExpertCodeChallengeItem) => {
    setSelectedChallengeId(ch.id)
    setTitle(ch.title)
    setLanguage(ch.language)
    setTimeoutMs(ch.timeout_ms)
    setMemoryLimitMb(ch.memory_limit_mb)
    setPrompt(ch.prompt)
    setSetupSql(ch.setup_sql ?? '')
    setStarterCode(ch.buggy_starter_code)
    setSolutionCode(ch.solution_code)
    setTestCases(
      ch.test_cases.length > 0
        ? ch.test_cases.map((tc) => ({
            name: tc.name,
            call: tc.call,
            expected:
              typeof tc.expected === 'string' ? tc.expected : JSON.stringify(tc.expected),
            is_hidden: Boolean(tc.is_hidden),
          }))
        : [{ name: 'Test 1', call: 'solve(5)', expected: '10', is_hidden: false }],
    )
    setVerificationResults([])
    setVerificationMeta(null)
    setStatusMsg(null)
    setErrorMsg(null)
  }, [])

  const resetToNewChallenge = useCallback((lang: CodeLanguage = 'python') => {
    setSelectedChallengeId(null)
    setTitle('')
    setLanguage(lang)
    setTimeoutMs(3000)
    setMemoryLimitMb(128)
    setPrompt('')
    setSetupSql('')
    setStarterCode(defaultStarterForLanguage(lang))
    setSolutionCode(defaultSolutionForLanguage(lang))
    setTestCases([
      {
        name: 'Test 1',
        call: lang === 'sql' ? 'query' : 'solve(5)',
        expected: lang === 'sql' ? '[]' : '10',
        is_hidden: false,
      },
    ])
    setVerificationResults([])
    setVerificationMeta(null)
    setStatusMsg(null)
    setErrorMsg(null)
  }, [])

  const loadChallenges = useCallback(
    async (slug: string) => {
      if (!slug) return
      setLoadingChallenges(true)
      setErrorMsg(null)
      try {
        const res = await apiExpertListCodeChallenges(slug)
        setExistingChallenges(res.challenges)
        if (res.challenges.length > 0) {
          hydrateFromChallenge(res.challenges[0])
        } else {
          resetToNewChallenge('python')
        }
      } catch (err) {
        setExistingChallenges([])
        setErrorMsg(err instanceof Error ? err.message : 'Không thể tải bài tập Code Sandbox')
      } finally {
        setLoadingChallenges(false)
      }
    },
    [hydrateFromChallenge, resetToNewChallenge],
  )

  useEffect(() => {
    void loadChallenges(conceptSlug)
  }, [conceptSlug, loadChallenges])

  function parseExpected(raw: string): unknown {
    try {
      return JSON.parse(raw)
    } catch {
      return raw
    }
  }

  function buildChallengePayload() {
    return {
      title: title.trim() || `Bài tập thực hành ${conceptSlug}`,
      language,
      prompt: prompt.trim() || 'Hoàn thiện mã nguồn vượt qua toàn bộ kiểm thử.',
      buggy_starter_code: starterCode,
      solution_code: solutionCode,
      test_cases: testCases.map((tc) => ({
        name: tc.name,
        call: tc.call,
        expected: parseExpected(tc.expected),
        is_hidden: tc.is_hidden,
      })),
      timeout_ms: Math.min(3000, Math.max(200, timeoutMs)),
      memory_limit_mb: Math.min(128, Math.max(32, memoryLimitMb)),
      setup_sql: language === 'sql' ? setupSql.trim() || null : null,
    }
  }

  async function handleDryRun() {
    setErrorMsg(null)
    setStatusMsg(null)
    setVerificationResults([])
    setVerificationMeta(null)
    setDryRunning(true)
    try {
      const res = await apiExpertDryRunCodeChallenge(buildChallengePayload())
      setVerificationResults(
        (res.test_results || []).map((tr) => ({
          name: tr.name,
          passed: tr.passed,
          error: tr.error ?? undefined,
        })),
      )
      setVerificationMeta({
        runtimeMs: res.runtime_ms,
        memoryKb: res.memory_kb,
        starterFailed: res.starter_failed,
      })
      setStatusMsg(
        `Dry-Run thành công (chưa lưu DB): Solution pass ${res.passed_tests}/${res.total_tests} (${res.runtime_ms}ms), Starter code fail đúng yêu cầu.`,
      )
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Lỗi chạy thử Sandbox (Dry-Run)')
      setVerificationResults(extractTestResultsFromError(err))
    } finally {
      setDryRunning(false)
    }
  }

  async function handlePublish() {
    setErrorMsg(null)
    setStatusMsg(null)
    setVerificationResults([])
    setVerificationMeta(null)
    setSubmitting(true)
    try {
      const res = await apiExpertPublishCodeChallenge(conceptSlug, buildChallengePayload())
      setVerificationResults(res.validation_run.test_results || [])
      setVerificationMeta({
        runtimeMs: res.validation_run.runtime_ms,
        memoryKb: res.validation_run.memory_kb,
        starterFailed: res.validation_run.starter_failed_at_least_one,
      })
      setStatusMsg(
        `Kiểm chứng kép thành công (v${res.version}): Solution pass 100%, Starter code fail đúng yêu cầu (${res.validation_run.runtime_ms}ms).`,
      )
      const refreshed = await apiExpertListCodeChallenges(conceptSlug)
      setExistingChallenges(refreshed.challenges)
      setSelectedChallengeId(res.item_id)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Lỗi kiểm chứng bài tập Code Sandbox')
      setVerificationResults(extractTestResultsFromError(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section
      className="w-full space-y-5 text-[#14241B]"
      data-testid="scr17-expert-code"
    >
      {/* Top Bar */}
      <div className="bg-white rounded-2xl border border-[#D8E2D8] p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-[#14241B] tracking-tight">
              Thiết kế Bài tập Code Sandbox &amp; Kiểm chứng Kép
            </h1>
            <p className="text-xs text-[#3F5247] mt-0.5">
              Nạp bài tập hiện có từ CSDL, hỗ trợ Python / SQL / JavaScript và kiểm chứng đồng thời cả mã chuẩn lẫn mã khởi đầu lỗi.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => resetToNewChallenge(language)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0] text-[#14532D] text-xs font-bold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Tạo bản mới</span>
            </button>
            <button
              type="button"
              onClick={() => void loadChallenges(conceptSlug)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#F6F8F5] border border-[#D8E2D8] text-xs font-semibold cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loadingChallenges ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>Làm mới</span>
            </button>
          </div>
        </div>

        {/* Selectors: Domain, Concept, Language, Timeout, RAM */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-1">
            <label
              htmlFor="scr17-domain-select"
              className="block text-[11px] font-bold text-[#57534E] mb-1"
            >
              Lĩnh vực
            </label>
            <select
              id="scr17-domain-select"
              value={selectedDomain}
              onChange={(e) => setSelectedDomain(e.target.value)}
              className="w-full rounded-lg border border-[#D8E2D8] bg-[#F6F8F5] px-2.5 py-2 text-xs font-bold"
            >
              {domains.map((d) => (
                <option key={d.slug} value={d.slug}>
                  {d.title}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <label
              htmlFor="scr17-concept-select"
              className="block text-[11px] font-bold text-[#57534E] mb-1"
            >
              Khái niệm (Node)
            </label>
            <select
              id="scr17-concept-select"
              value={conceptSlug}
              onChange={(e) => setConceptSlug(e.target.value)}
              className="w-full rounded-lg border border-[#D8E2D8] bg-[#F6F8F5] px-2.5 py-2 text-xs font-mono font-bold"
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
              htmlFor="scr17-language-select"
              className="block text-[11px] font-bold text-[#57534E] mb-1"
            >
              Ngôn ngữ thực thi
            </label>
            <select
              id="scr17-language-select"
              value={language}
              onChange={(e) => setLanguage(e.target.value as CodeLanguage)}
              className="w-full rounded-lg border border-[#D8E2D8] bg-[#F6F8F5] px-2.5 py-2 text-xs font-mono font-bold"
            >
              <option value="python">Python 3.12</option>
              <option value="sql">SQL (SQLite)</option>
              <option value="javascript">JavaScript (Node)</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="scr17-timeout-input"
              className="block text-[11px] font-bold text-[#57534E] mb-1"
            >
              Timeout (200–3000ms)
            </label>
            <input
              id="scr17-timeout-input"
              type="number"
              min={200}
              max={3000}
              step={100}
              value={timeoutMs}
              onChange={(e) => setTimeoutMs(Number(e.target.value))}
              className="w-full rounded-lg border border-[#D8E2D8] bg-[#F6F8F5] px-2.5 py-2 text-xs font-mono"
            />
          </div>

          <div>
            <label
              htmlFor="scr17-memory-input"
              className="block text-[11px] font-bold text-[#57534E] mb-1"
            >
              RAM tối đa (32–128MB)
            </label>
            <input
              id="scr17-memory-input"
              type="number"
              min={32}
              max={128}
              step={16}
              value={memoryLimitMb}
              onChange={(e) => setMemoryLimitMb(Number(e.target.value))}
              className="w-full rounded-lg border border-[#D8E2D8] bg-[#F6F8F5] px-2.5 py-2 text-xs font-mono"
            />
          </div>
        </div>

        {/* Existing Versions Strip */}
        {existingChallenges.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#E7EFE7] text-xs">
            <span className="font-bold text-[#57534E]">Phiên bản trong CSDL:</span>
            {existingChallenges.map((ch) => (
              <button
                key={ch.id}
                type="button"
                onClick={() => hydrateFromChallenge(ch)}
                className={`px-2.5 py-1 rounded-lg border font-mono text-[11px] cursor-pointer ${
                  selectedChallengeId === ch.id
                    ? 'bg-[#DCFCE7] border-[#15803D] text-[#14532D] font-bold'
                    : 'bg-[#F6F8F5] border-[#D8E2D8] text-[#3F5247]'
                }`}
              >
                v{ch.version} • {ch.language} {ch.is_active ? '(Active)' : '(Archived)'}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label htmlFor="scr17-title-input" className="block text-xs font-bold text-[#14241B] mb-1">
              Tiêu đề bài tập
            </label>
            <input
              id="scr17-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="vd: Tối ưu truy vấn tránh N+1 Query"
              className="w-full rounded-lg border border-[#D8E2D8] bg-[#F6F8F5] px-3 py-2 text-xs focus:bg-white focus:border-[#15803D] focus:outline-none"
            />
          </div>
          <div>
            <label
              htmlFor="scr17-prompt-textarea"
              className="block text-xs font-bold text-[#14241B] mb-1"
            >
              Đề bài &amp; Yêu cầu Refactoring
            </label>
            <input
              id="scr17-prompt-textarea"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Mô tả lỗi cần sửa và điều kiện nghiệm thu..."
              className="w-full rounded-lg border border-[#D8E2D8] bg-[#F6F8F5] px-3 py-2 text-xs focus:bg-white focus:border-[#15803D] focus:outline-none"
            />
          </div>
        </div>

        {/* SQL Setup Schema Editor (only when language === 'sql') */}
        {language === 'sql' && (
          <div className="space-y-1.5" data-testid="setup-sql-editor">
            <label
              htmlFor="scr17-setup-sql"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#14241B]"
            >
              <Database className="w-3.5 h-3.5 text-[#0D9488]" aria-hidden="true" />
              <span>Schema &amp; Dữ liệu Khởi tạo SQL (setup_sql)</span>
            </label>
            <textarea
              id="scr17-setup-sql"
              rows={4}
              value={setupSql}
              onChange={(e) => setSetupSql(e.target.value)}
              placeholder="CREATE TABLE items (id INT, name TEXT); INSERT INTO items VALUES (1, 'A');"
              spellCheck={false}
              className="w-full rounded-xl border border-[#D8E2D8] bg-[#0F172A] text-emerald-300 p-3 font-mono text-xs focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* Main Two-Column Editor & Test Suite */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <ExpertChallengeCodeEditor
          starterCode={starterCode}
          solutionCode={solutionCode}
          onStarterCodeChange={setStarterCode}
          onSolutionCodeChange={setSolutionCode}
        />

        <ExpertChallengeTestCasesPanel
          conceptSlug={conceptSlug}
          language={language}
          testCases={testCases}
          onTestCasesChange={setTestCases}
          errorMsg={errorMsg}
          statusMsg={statusMsg}
          verificationResults={verificationResults}
          verificationMeta={verificationMeta}
          dryRunning={dryRunning}
          submitting={submitting}
          onDryRun={() => void handleDryRun()}
          onPublish={() => void handlePublish()}
        />
      </div>
    </section>
  )
}
