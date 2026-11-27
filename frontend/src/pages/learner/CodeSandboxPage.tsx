import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Code2,
  Cpu,
  FileCode2,
  Play,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import { apiGetCodeChallenge, apiSubmitCodeSandbox } from '../../api'
import { AdaptiveNextStepCard } from '../../components/learner/AdaptiveNextStepCard'
import { PlaybookQuickDrawer } from '../../components/learner/PlaybookQuickDrawer'
import { PageContextBar } from '../../components/ui/PageContextBar'
import { StatusAlertBanner } from '../../components/ui/StatusAlertBanner'
import { useAsyncQuery } from '../../hooks/useAsyncQuery'
import { useDraftStorage } from '../../hooks/useDraftStorage'
import type { CodeSandboxSubmitResponse } from '../../types'
import { generateSubmissionId } from '../../utils/submission'

interface CodeSandboxPageProps {
  domainSlug: string
  conceptSlug: string
  onBackToRoadmap: () => void
  onStartDepthProbe?: (conceptSlug: string) => void
}

export function CodeSandboxPage({
  domainSlug,
  conceptSlug,
  onBackToRoadmap,
  onStartDepthProbe,
}: CodeSandboxPageProps) {
  const { data: challenge, loading, errorMessage: loadError, refetch } = useAsyncQuery(
    (signal) => apiGetCodeChallenge(conceptSlug, domainSlug, signal),
    [conceptSlug, domainSlug],
  )

  const draftKey = challenge ? `plumora_draft_code_${conceptSlug}_${challenge.challenge_id}` : ''
  const [code, setCode, clearCodeDraft] = useDraftStorage(
    draftKey,
    challenge?.buggy_starter_code ?? '',
  )

  const [result, setResult] = useState<CodeSandboxSubmitResponse | null>(null)
  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)
  const [isPlaybookOpen, setIsPlaybookOpen] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const gutterRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (challenge && !code) {
      setCode(challenge.buggy_starter_code)
    }
  }, [challenge, code, setCode])

  async function handleRunSandbox() {
    if (!challenge || !code.trim() || running) return
    setRunning(true)
    setRunError(null)
    try {
      const res = await apiSubmitCodeSandbox(
        conceptSlug,
        {
          submission_id: generateSubmissionId(),
          challenge_id: challenge.challenge_id,
          language: challenge.language,
          source_code: code,
        },
        domainSlug,
      )
      setResult(res)
    } catch (err) {
      setRunError(err instanceof Error ? err.message : 'Lỗi thực thi mã nguồn')
    } finally {
      setRunning(false)
    }
  }

  function handleEditorKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      void handleRunSandbox()
      return
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      const el = e.currentTarget
      const start = el.selectionStart
      const end = el.selectionEnd

      if (e.shiftKey) {
        const lineStart = code.lastIndexOf('\n', start - 1) + 1
        if (code.slice(lineStart, lineStart + 4) === '    ') {
          const next = code.slice(0, lineStart) + code.slice(lineStart + 4)
          setCode(next)
          requestAnimationFrame(() => {
            el.selectionStart = Math.max(lineStart, start - 4)
            el.selectionEnd = Math.max(lineStart, end - 4)
          })
        }
      } else {
        const next = `${code.slice(0, start)}    ${code.slice(end)}`
        setCode(next)
        requestAnimationFrame(() => {
          el.selectionStart = start + 4
          el.selectionEnd = start + 4
        })
      }
    }
  }

  function handleEditorScroll() {
    if (gutterRef.current && textareaRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop
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
      className="w-full pb-8 space-y-5 text-on-surface"
      data-testid="scr13-code-sandbox"
    >
      <PageContextBar
        backLabel={`Quay về Lộ trình (${domainSlug})`}
        onBack={onBackToRoadmap}
        breadcrumbs={[
          { label: domainSlug, onClick: onBackToRoadmap },
          { label: conceptSlug },
          { label: 'Phòng Thực hành Lập trình', isCurrent: true },
        ]}
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPlaybookOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-container/60 text-on-primary-container hover:bg-primary-container text-xs font-bold cursor-pointer transition-colors"
              data-testid="open-playbook-quick-drawer-btn"
            >
              <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Xem nhanh Lý thuyết</span>
            </button>
            {challenge && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-low text-xs text-on-surface-variant font-medium">
                <Clock className="w-3.5 h-3.5 text-tertiary" aria-hidden="true" />
                <span>
                  Giới hạn: &le; {challenge.timeout_ms}ms • {challenge.memory_limit_mb}MB
                </span>
              </div>
            )}
          </div>
        }
      />

      {loading && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-5 h-96 rounded-2xl bg-white border border-outline-variant/40 animate-pulse" />
          <div className="lg:col-span-7 h-96 rounded-2xl bg-white border border-outline-variant/40 animate-pulse" />
        </div>
      )}

      {!loading && !challenge && loadError && (
        <StatusAlertBanner
          variant="warning"
          title="Chưa có bài tập lập trình khả dụng"
          message={loadError}
          onRetry={refetch}
          actionSlot={
            <button
              type="button"
              onClick={onBackToRoadmap}
              className="px-3.5 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-bold cursor-pointer"
            >
              Quay về Lộ trình
            </button>
          }
        />
      )}

      {!loading && challenge && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* LEFT COLUMN (5 cols): Problem Spec & Public Test Cases */}
          <aside className="lg:col-span-5 flex flex-col gap-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-outline-variant/50 space-y-3.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-xs font-bold">
                <Code2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Thực hành Đọc &amp; Sửa lỗi ({challenge.language})</span>
              </span>

              <div>
                <h1 className="text-lg sm:text-xl font-headline font-extrabold text-on-surface leading-snug">
                  {challenge.title}
                </h1>
                <p className="mt-2 text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                  {challenge.prompt}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-outline-variant/50 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Bộ Kiểm thử Công khai ({challenge.public_test_cases.length})
                </h2>
                <span className="text-[11px] text-primary font-semibold">
                  + Kiểm thử biên tự động
                </span>
              </div>

              <div className="space-y-2">
                {challenge.public_test_cases.map((tc, idx) => (
                  <div
                    key={`${tc.name}-${idx}`}
                    className="p-3 rounded-xl bg-surface-container-low flex items-start gap-2.5"
                  >
                    <span className="w-5 h-5 rounded-full bg-primary text-on-primary flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <div className="text-xs min-w-0 flex-1 space-y-1">
                      <p className="font-semibold text-on-surface">{tc.name}</p>
                      <div className="font-mono text-[11px] text-on-surface-variant break-all">
                        <span>Đầu vào: </span>
                        <code className="bg-white px-1.5 py-0.5 rounded text-primary font-semibold border border-outline-variant/40">
                          {tc.call}
                        </code>
                        <span> → Kỳ vọng: </span>
                        <code className="bg-white px-1.5 py-0.5 rounded text-secondary font-semibold border border-outline-variant/40">
                          {JSON.stringify(tc.expected)}
                        </code>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          {/* RIGHT COLUMN (7 cols): Code Editor + Test Console */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="bg-[#0F172A] rounded-2xl overflow-hidden shadow-md border border-[#1E293B]">
              <div className="bg-[#1E293B] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#0F172A] text-slate-200 text-xs font-mono">
                    <FileCode2 className="w-3.5 h-3.5 text-secondary-fixed" aria-hidden="true" />
                    <span>
                      {conceptSlug}.{ext}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 hidden sm:inline">
                    Tab: thụt lề • Ctrl+Enter: chạy kiểm thử
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      clearCodeDraft()
                      setCode(challenge.buggy_starter_code)
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-700/70 hover:bg-slate-700 text-slate-200 text-xs font-medium cursor-pointer transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Khôi phục mã gốc</span>
                  </button>
                  <button
                    type="button"
                    disabled={!code.trim() || running}
                    onClick={() => void handleRunSandbox()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary-dim disabled:opacity-45 text-on-primary text-xs font-bold shadow-sm cursor-pointer transition-colors"
                    data-testid="run-code-sandbox-btn"
                  >
                    <Play className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{running ? 'Đang chạy...' : 'Chạy Kiểm thử & Nộp bài'}</span>
                  </button>
                </div>
              </div>

              <div className="p-4 font-mono text-xs leading-6 text-slate-100 flex h-[360px]">
                <div
                  ref={gutterRef}
                  className="select-none text-slate-500 text-right pr-3.5 border-r border-slate-800 overflow-hidden shrink-0"
                  aria-hidden="true"
                >
                  {Array.from({ length: lineCount }, (_, i) => (
                    <div key={i}>{String(i + 1).padStart(2, '0')}</div>
                  ))}
                </div>
                <textarea
                  ref={textareaRef}
                  id="sandbox-editor"
                  aria-label="Trình soạn thảo mã nguồn"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={handleEditorKeyDown}
                  onScroll={handleEditorScroll}
                  spellCheck={false}
                  wrap="off"
                  className="flex-1 w-full h-full bg-transparent text-slate-100 font-mono text-xs pl-4 leading-6 focus:outline-none resize-none overflow-auto"
                />
              </div>
            </div>

            {/* Test Console */}
            <div className="bg-white rounded-2xl shadow-sm border border-outline-variant/50 overflow-hidden">
              <div className="px-4 py-3 bg-surface-container-low border-b border-surface-container flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-on-surface flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-primary" aria-hidden="true" />
                  <span>Kết quả Kiểm thử</span>
                </h2>
                {result && (
                  <span className="font-mono text-[11px] font-semibold text-on-surface-variant">
                    Thời gian: <strong className="text-primary">{result.runtime_ms}ms</strong> /{' '}
                    {challenge.timeout_ms}ms • Bộ nhớ:{' '}
                    <strong className="text-primary">{result.memory_kb} KB</strong>
                  </span>
                )}
              </div>

              <div className="p-4 space-y-3" role="status" aria-live="polite">
                {running && (
                  <div className="p-4 rounded-xl bg-surface-container-low text-xs font-medium text-on-surface-variant animate-pulse">
                    Đang thực thi mã nguồn và đối chiếu các bộ kiểm thử...
                  </div>
                )}

                {!running && !result && !runError && (
                  <p className="text-xs text-on-surface-variant">
                    Nhấn &ldquo;Chạy Kiểm thử &amp; Nộp bài&rdquo; (hoặc phím tắt{' '}
                    <kbd className="px-1.5 py-0.5 rounded bg-surface-container font-mono text-[10px]">
                      Ctrl+Enter
                    </kbd>
                    ) để kiểm tra lời giải của bạn.
                  </p>
                )}

                {runError && <StatusAlertBanner variant="error" message={runError} />}

                {result && !running && (
                  <div className="space-y-3">
                    <div
                      className={`p-3.5 rounded-xl flex flex-wrap items-center justify-between gap-3 ${
                        result.code_score >= 1.0
                          ? 'bg-primary-container/45 border border-primary/30'
                          : 'bg-ai-sunlit-bg border border-ai-sunlit-border/50'
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
                            Vượt qua {result.passed_tests} / {result.total_tests} bài kiểm thử (
                            {Math.round(result.code_score * 100)}%)
                          </h3>
                          {result.code_score < 1.0 && (
                            <p className="text-[11px] text-ai-sunlit-text mt-0.5">
                              Cần vượt qua 100% kiểm thử để hoàn thiện kỹ năng thực hành chủ đề này.
                            </p>
                          )}
                        </div>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold font-mono ${
                          result.code_score >= 1.0
                            ? 'bg-primary text-on-primary'
                            : 'bg-tertiary text-on-tertiary'
                        }`}
                      >
                        {result.code_score >= 1.0 ? 'PASSED (100%)' : 'CHƯA ĐẠT ĐỦ'}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {result.test_results.map((tr, idx) => (
                        <div
                          key={`${tr.name}-${idx}`}
                          className="p-3 rounded-xl bg-surface-container-low flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div
                              className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                                tr.passed
                                  ? 'bg-primary/15 text-primary'
                                  : 'bg-error/15 text-error'
                              }`}
                            >
                              {tr.passed ? (
                                <Check className="w-3 h-3" aria-hidden="true" />
                              ) : (
                                <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <span className="font-mono text-xs font-semibold text-on-surface">
                                {tr.name}
                              </span>
                              {tr.error && (
                                <p className="font-mono text-[11px] text-error mt-1 break-all">
                                  {tr.error}
                                </p>
                              )}
                            </div>
                          </div>
                          <span
                            className={`font-mono text-[11px] font-bold shrink-0 ${
                              tr.passed ? 'text-primary' : 'text-error'
                            }`}
                          >
                            {tr.passed ? 'PASS' : 'FAIL'}
                          </span>
                        </div>
                      ))}
                    </div>

                    {result.code_score >= 1.0 && (
                      <div className="space-y-3">
                        <div className="p-4 rounded-xl bg-primary-container/35 border border-primary/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-xs font-bold text-on-primary-container">
                          <ShieldCheck className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
                          <span>
                            {result.updated_competency.depth_level_norm >= 1.0
                              ? `Xuất sắc! Bạn đã đạt Làm chủ (100% Mastery) cho khái niệm này.`
                              : `Đã vượt qua 100% Code Sandbox! Mức hiện tại: ${result.updated_competency.depth_label} (${Math.round(result.updated_competency.depth_level_norm * 100)}%). Hoàn thành Kiểm tra Đào sâu 5 tầng để đạt Làm chủ (100%).`}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2 shrink-0">
                          {result.updated_competency.depth_level_norm < 1.0 && onStartDepthProbe && (
                            <button
                              type="button"
                              onClick={() => onStartDepthProbe(conceptSlug)}
                              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-secondary hover:opacity-90 text-on-secondary text-xs font-bold cursor-pointer transition-opacity"
                            >
                              <span>Vào Kiểm tra Đào sâu 5 tầng để mở khóa Làm chủ (100%)</span>
                              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={onBackToRoadmap}
                            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary-dim text-on-primary text-xs font-bold cursor-pointer transition-colors"
                          >
                            <span>Hoàn thành &amp; Tiếp tục Lộ trình</span>
                            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                      <AdaptiveNextStepCard domainSlug={domainSlug} />
                    </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <PlaybookQuickDrawer
        isOpen={isPlaybookOpen}
        onClose={() => setIsPlaybookOpen(false)}
        domainSlug={domainSlug}
        conceptSlug={conceptSlug}
      />
    </section>
  )
}
