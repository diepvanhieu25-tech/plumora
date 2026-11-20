import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Code2,
  Cpu,
  FileCode2,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Terminal,
  XCircle,
  Zap,
} from 'lucide-react'
import { apiGetCodeChallenge, apiSubmitCodeSandbox } from '../api'
import type { CodeChallengeOut, CodeSandboxSubmitResponse } from '../types'
import { generateSubmissionId } from '../utils/submission'

interface CodeSandboxPageProps {
  domainSlug: string
  conceptSlug: string
  onBackToRoadmap: () => void
}

export function CodeSandboxPage({
  domainSlug,
  conceptSlug,
  onBackToRoadmap,
}: CodeSandboxPageProps) {
  const [challenge, setChallenge] = useState<CodeChallengeOut | null>(null)
  const [code, setCode] = useState<string>('')
  const [result, setResult] = useState<CodeSandboxSubmitResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mountedRef = useRef(true)

  const initChallenge = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const ch = await apiGetCodeChallenge(conceptSlug)
      if (!mountedRef.current) return
      setChallenge(ch)
      setCode(ch.buggy_starter_code)
    } catch (err) {
      if (!mountedRef.current) return
      setError(err instanceof Error ? err.message : 'Khái niệm chưa có bài tập Code Sandbox')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [conceptSlug])

  useEffect(() => {
    mountedRef.current = true
    void initChallenge()
    return () => {
      mountedRef.current = false
    }
  }, [initChallenge])

  async function handleRunSandbox() {
    if (!challenge || !code.trim()) return
    setRunning(true)
    setError(null)
    try {
      const res = await apiSubmitCodeSandbox(conceptSlug, {
        submission_id: generateSubmissionId(),
        challenge_id: challenge.challenge_id,
        language: challenge.language,
        source_code: code,
      })
      setResult(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi thực thi trong Code Sandbox')
    } finally {
      setRunning(false)
    }
  }

  const ext =
    challenge?.language === 'sql'
      ? 'sql'
      : challenge?.language === 'javascript'
        ? 'js'
        : 'py'
  const lineCount = Math.max(14, code.split('\n').length)

  return (
    <section
      className="w-full max-w-[1520px] mx-auto px-4 sm:px-6 lg:px-8 pb-8 space-y-4 text-on-surface"
      data-testid="scr13-code-sandbox"
    >
      {/* 1. Top Guardrail Bar / Breadcrumb Header */}
      <div className="w-full bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/30 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        {/* Breadcrumb & Back action */}
        <div className="flex items-center gap-3 min-w-0 flex-wrap">
          <button
            type="button"
            onClick={onBackToRoadmap}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-container text-xs font-semibold text-primary hover:bg-primary hover:text-on-primary transition-all cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Quay về Bản đồ Knowledge Graph ({domainSlug})</span>
          </button>
          <div className="h-4 w-px bg-surface-container-highest hidden sm:block" />
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-1.5 text-xs text-on-surface-variant truncate flex-wrap"
          >
            <span>{domainSlug}</span>
            <ChevronRight className="w-3.5 h-3.5 text-outline-variant" aria-hidden="true" />
            <span className="font-mono text-on-surface font-semibold">{conceptSlug}</span>
            <ChevronRight className="w-3.5 h-3.5 text-outline-variant" aria-hidden="true" />
            <span className="text-primary font-semibold truncate">
              Phòng Thực hành Lập trình
            </span>
          </nav>
        </div>

        {/* Security Guardrail Badges */}
        {challenge && (
          <div className="flex items-center flex-wrap gap-2 text-[11px]">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-low text-primary shadow-2xs">
              <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="font-medium">Môi trường chạy cô lập an toàn</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-tertiary-fixed/20 text-on-tertiary-container shadow-2xs">
              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="font-medium">Giới hạn:</span>
              <span className="font-bold font-mono">
                &le; {challenge.timeout_ms}ms | {challenge.memory_limit_mb}MB RAM
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-5 h-96 rounded-xl bg-surface-container-lowest border border-outline-variant/30 animate-pulse" />
          <div className="lg:col-span-7 h-96 rounded-xl bg-surface-container-lowest border border-outline-variant/30 animate-pulse" />
        </div>
      )}

      {/* Initial Load Error */}
      {!loading && !challenge && error && (
        <div
          role="alert"
          className="rounded-xl border border-tertiary/40 bg-tertiary-container/15 p-6 space-y-3"
        >
          <div className="flex items-center gap-2 text-sm font-bold text-on-tertiary-container">
            <AlertTriangle className="w-5 h-5 text-tertiary" aria-hidden="true" />
            <span>{error}</span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void initChallenge()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-container-lowest border border-tertiary/40 text-tertiary text-xs font-bold cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              Thử lại
            </button>
            <button
              type="button"
              onClick={onBackToRoadmap}
              className="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold cursor-pointer"
            >
              Quay về Bản đồ
            </button>
          </div>
        </div>
      )}

      {/* 2. Workspace Container (Split Pane) */}
      {!loading && challenge && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* LEFT COLUMN: Problem Specification & Public Test Cases (5 cols) */}
          <aside className="lg:col-span-5 flex flex-col gap-4">
            {/* Challenge Header Card */}
            <div className="bg-surface-container-lowest rounded-xl p-5 shadow-sm border border-outline-variant/25 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-container text-[11px] font-semibold text-secondary">
                  <Code2 className="w-3 h-3" aria-hidden="true" />
                  Dạng 2: Đọc &amp; Sửa Code ({challenge.language})
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-tertiary-fixed/25 text-[11px] font-semibold text-on-tertiary-container">
                  <Sparkles className="w-3 h-3" aria-hidden="true" />
                  Tầng độ sâu: Tầng 3–4 (Applied &rarr; Deep)
                </span>
              </div>

              <div>
                <h1 className="text-xl font-bold font-headline text-on-surface leading-tight tracking-tight">
                  {challenge.title}
                </h1>
                <p className="mt-2 text-xs text-on-surface-variant leading-relaxed">
                  {challenge.prompt}
                </p>
              </div>
            </div>

            {/* Public Test Cases Checklist */}
            <div className="bg-surface-container-lowest rounded-xl p-5 shadow-sm border border-outline-variant/25 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant font-label">
                  Bộ Test Cases Công khai ({challenge.public_test_cases.length})
                </h2>
                <span className="text-[11px] font-mono font-semibold text-primary">
                  + Hidden Anti-Hardcode Tests
                </span>
              </div>

              <div className="space-y-2">
                {challenge.public_test_cases.map((tc, idx) => (
                  <div
                    key={tc.name}
                    className="p-3 rounded-lg bg-surface-container-low flex items-start gap-2.5"
                  >
                    <span className="w-5 h-5 rounded-full bg-primary text-on-primary flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <div className="text-xs min-w-0 flex-1 space-y-1">
                      <p className="font-semibold text-on-surface">{tc.name}</p>
                      <div className="font-mono text-[11px] text-on-surface-variant break-all">
                        <span>Gọi: </span>
                        <code className="bg-surface-container px-1 py-0.5 rounded text-primary font-semibold">
                          {tc.call}
                        </code>
                        <span> &rarr; Kỳ vọng: </span>
                        <code className="bg-surface-container px-1 py-0.5 rounded text-secondary font-semibold">
                          {JSON.stringify(tc.expected)}
                        </code>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Technical Metadata & Policy Card */}
            <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-outline-variant/25 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-surface-container flex items-center justify-center text-primary font-mono font-bold text-xs">
                  <Check className="w-4 h-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-medium text-on-surface">
                    Khái niệm: <span className="font-mono">{challenge.concept_slug}</span>
                  </p>
                  <p className="text-[10px] text-on-surface-variant">
                    Kiểm chứng thực thi cô lập AST &amp; Unit Test
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-container-low">
                <Zap className="w-4 h-4 text-tertiary" aria-hidden="true" />
                <div className="text-right">
                  <span className="text-[10px] text-on-surface-variant block uppercase font-label">
                    Tín hiệu RL
                  </span>
                  <span className="font-mono font-bold text-tertiary">Code_Practice</span>
                </div>
              </div>
            </div>
          </aside>

          {/* RIGHT COLUMN: Code Editor + Execution Sandbox Console (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            {/* Editor Wrapper */}
            <div className="bg-[#0F172A] rounded-xl overflow-hidden shadow-md border border-[#1E293B]">
              {/* Editor Toolbar Header */}
              <div className="bg-[#1E293B] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#0F172A] text-slate-200 text-xs font-mono">
                    <FileCode2 className="w-3.5 h-3.5 text-secondary-container" aria-hidden="true" />
                    <span>
                      {conceptSlug}.{ext}
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
                    {challenge.language === 'python'
                      ? 'Python 3.12 • Isolated Worker'
                      : challenge.language}
                  </span>
                </div>

                {/* Editor Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCode(challenge.buggy_starter_code)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-all cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Khôi phục mẫu</span>
                  </button>
                  <button
                    type="button"
                    disabled={!code.trim() || running}
                    onClick={() => void handleRunSandbox()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-primary hover:bg-primary-dim disabled:opacity-45 text-on-primary text-xs font-bold shadow-sm transition-all cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>
                      {running
                        ? 'Đang chạy Sandbox...'
                        : 'Chạy Kiểm thử Sandbox & Nộp Code'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Code Canvas Panel with Line Numbers */}
              <div className="p-4 font-mono text-xs leading-6 overflow-x-auto text-slate-100 flex">
                <div
                  className="select-none text-slate-600 text-right pr-4 border-r border-slate-800 space-y-0"
                  aria-hidden="true"
                >
                  {Array.from({ length: lineCount }, (_, i) => (
                    <div key={i}>{String(i + 1).padStart(2, '0')}</div>
                  ))}
                </div>
                <textarea
                  id="sandbox-editor"
                  aria-label="Trình soạn mã Code Sandbox"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  rows={14}
                  spellCheck={false}
                  className="flex-1 w-full bg-transparent text-slate-100 font-mono text-xs pl-4 leading-6 focus:outline-none resize-y"
                />
              </div>
            </div>

            {/* Execution Test Console (Docked below) */}
            <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/25 overflow-hidden">
              {/* Console Top Header */}
              <div className="px-4 py-3 bg-surface-container-low border-b border-outline-variant/20 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-on-surface flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-primary" aria-hidden="true" />
                  <span>Bảng Kết quả Thực thi Sandbox</span>
                </h2>
                {result && (
                  <span className="font-mono text-[11px] font-semibold text-on-surface-variant">
                    Thời gian: <strong className="text-primary">{result.runtime_ms}ms</strong> /{' '}
                    {challenge.timeout_ms}ms &bull; RAM:{' '}
                    <strong className="text-primary">{result.memory_kb} KB</strong>
                  </span>
                )}
              </div>

              <div className="p-4 space-y-3">
                {running && (
                  <div className="p-4 rounded-lg bg-surface-container-low text-xs font-medium text-on-surface-variant animate-pulse">
                    Worker cô lập (network_mode: none, RAM &le; {challenge.memory_limit_mb}MB) đang
                    chạy Test Cases...
                  </div>
                )}

                {!running && !result && !error && (
                  <p className="text-xs text-on-surface-variant">
                    Nhấn &ldquo;Chạy Kiểm thử Sandbox &amp; Nộp Code&rdquo; để thực thi bộ test cases
                    trên Worker cô lập.
                  </p>
                )}

                {/* Gate 3 invariant: preserve [role="alert"] on 408 SANDBOX_TIMEOUT or 422 SANDBOX_SECURITY_VIOLATION */}
                {error && (
                  <div
                    role="alert"
                    className="p-3.5 rounded-xl bg-error-container/20 border border-error/40 text-xs text-error font-semibold flex items-start gap-2"
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{error}</span>
                  </div>
                )}

                {result && !running && (
                  <div className="space-y-3">
                    {/* Banner Result Bar */}
                    <div
                      className={`p-3.5 rounded-lg flex flex-wrap items-center justify-between gap-3 ${
                        result.code_score >= 1.0
                          ? 'bg-primary-container/40 text-on-surface'
                          : 'bg-tertiary-container/25 text-on-surface'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                            result.code_score >= 1.0
                              ? 'bg-primary text-on-primary'
                              : 'bg-tertiary text-on-tertiary'
                          }`}
                        >
                          {result.code_score >= 1.0 ? (
                            <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                          ) : (
                            <AlertTriangle className="w-4 h-4" aria-hidden="true" />
                          )}
                        </div>
                        <div>
                          <h3 className="text-xs font-bold text-on-surface">
                            Test Cases đạt: {result.passed_tests} / {result.total_tests} (
                            {Math.round(result.code_score * 100)}%)
                          </h3>
                          <p className="text-[11px] font-mono text-on-surface-variant">
                            Thực thi: {result.runtime_ms}ms / {challenge.timeout_ms}ms &bull; Bộ nhớ:{' '}
                            {result.memory_kb}KB
                          </p>
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold font-mono ${
                          result.code_score >= 1.0
                            ? 'bg-primary text-on-primary'
                            : 'bg-tertiary text-on-tertiary'
                        }`}
                      >
                        {result.code_score >= 1.0 ? 'PASSED (100%)' : 'PARTIAL'}
                      </span>
                    </div>

                    {/* Itemized Test Results */}
                    <div className="space-y-2">
                      {result.test_results.map((tr) => (
                        <div
                          key={tr.name}
                          className="p-3 rounded-lg bg-surface-container-low flex flex-col md:flex-row md:items-center justify-between gap-2"
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div
                              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${
                                tr.passed
                                  ? 'bg-primary/20 text-primary'
                                  : 'bg-error/20 text-error'
                              }`}
                            >
                              {tr.passed ? (
                                <Check className="w-3 h-3" aria-hidden="true" />
                              ) : (
                                <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs font-semibold text-on-surface">
                                  {tr.name}
                                </span>
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${
                                    tr.passed
                                      ? 'bg-primary/15 text-primary'
                                      : 'bg-error/15 text-error'
                                  }`}
                                >
                                  {tr.passed ? 'PASSED' : 'FAILED'}
                                </span>
                              </div>
                              {tr.error && (
                                <p className="font-mono text-[11px] text-error mt-1 break-all">
                                  {tr.error}
                                </p>
                              )}
                            </div>
                          </div>
                          <span className="font-mono text-[11px] font-bold text-on-surface-variant shrink-0">
                            {tr.passed ? 'PASS' : 'FAIL'}
                          </span>
                        </div>
                      ))}
                    </div>

                    {result.code_score >= 1.0 && (
                      <div className="p-3.5 rounded-lg bg-primary-container/30 border border-primary/30 text-xs font-bold text-on-primary-container flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
                        <span>
                          Đã cập nhật năng lực: {result.updated_competency.depth_label} (
                          {Math.round(result.updated_competency.depth_level_norm * 100)}%) &bull; S ={' '}
                          {result.updated_competency.stability_s.toFixed(1)} ngày
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Bottom System Status Bar */}
      <div className="w-full bg-surface-container-lowest rounded-xl py-2.5 px-5 shadow-2xs border border-outline-variant/25 text-xs text-on-surface-variant flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1.5 text-on-surface font-semibold">
            <Terminal className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
            Môi trường Thực hành Plumora
          </span>
          <span className="text-surface-container-highest">&bull;</span>
          <span className="hidden sm:inline">Kiểm thử tự động an toàn</span>
        </div>
        <div className="flex items-center gap-3 text-primary font-semibold">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span>Sẵn sàng chạy kiểm thử</span>
          </span>
        </div>
      </div>
    </section>
  )
}
