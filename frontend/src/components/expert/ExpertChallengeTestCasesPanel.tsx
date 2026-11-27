import type { Dispatch, SetStateAction } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Lock,
  Plus,
  ShieldCheck,
  Trash2,
  XCircle,
} from 'lucide-react'
import type { CodeLanguage, SandboxTestResultItem } from '../../types/expert'

export interface TestCaseRow {
  name: string
  call: string
  expected: string
  is_hidden: boolean
}

export interface ExpertChallengeTestCasesPanelProps {
  conceptSlug: string
  language: CodeLanguage
  testCases: TestCaseRow[]
  onTestCasesChange: Dispatch<SetStateAction<TestCaseRow[]>>
  errorMsg: string | null
  statusMsg: string | null
  verificationResults: SandboxTestResultItem[]
  verificationMeta: {
    runtimeMs: number
    memoryKb: number
    starterFailed: boolean
  } | null
  dryRunning: boolean
  submitting: boolean
  onDryRun: () => void
  onPublish: () => void
}

export function ExpertChallengeTestCasesPanel({
  conceptSlug,
  language,
  testCases,
  onTestCasesChange,
  errorMsg,
  statusMsg,
  verificationResults,
  verificationMeta,
  dryRunning,
  submitting,
  onDryRun,
  onPublish,
}: ExpertChallengeTestCasesPanelProps) {
  return (
    <div className="lg:col-span-6 space-y-4">
      <div className="bg-white rounded-2xl border border-[#D8E2D8] p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-extrabold text-[#14241B]">
            Bộ Kiểm thử Tự động ({testCases.length} Test Cases)
          </h2>
          <button
            type="button"
            onClick={() =>
              onTestCasesChange((prev) => [
                ...prev,
                {
                  name: `Test ${prev.length + 1}`,
                  call: language === 'sql' ? 'query' : 'solve(0)',
                  expected: language === 'sql' ? '[]' : '0',
                  is_hidden: true,
                },
              ])
            }
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#F6F8F5] border border-[#D8E2D8] text-xs font-bold text-[#15803D] cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Thêm Test Case</span>
          </button>
        </div>

        <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
          {testCases.map((tc, idx) => (
            <div
              key={idx}
              className="p-3 rounded-xl bg-[#F6F8F5] border border-[#D8E2D8] space-y-2 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono font-bold inline-flex items-center gap-1.5">
                  {tc.is_hidden ? (
                    <Lock className="w-3.5 h-3.5 text-[#D97706]" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D]" aria-hidden="true" />
                  )}
                  Test #{idx + 1}
                </span>
                <button
                  type="button"
                  disabled={testCases.length <= 1}
                  onClick={() => onTestCasesChange((prev) => prev.filter((_, i) => i !== idx))}
                  className="p-1 text-[#9F1239] disabled:opacity-30 cursor-pointer"
                  aria-label="Xóa test case"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                <input
                  value={tc.name}
                  onChange={(e) =>
                    onTestCasesChange((prev) =>
                      prev.map((r, i) => (i === idx ? { ...r, name: e.target.value } : r)),
                    )
                  }
                  placeholder="Tên test"
                  className="sm:col-span-3 rounded-lg border border-[#D8E2D8] bg-white px-2 py-1.5"
                />
                <input
                  value={tc.call}
                  onChange={(e) =>
                    onTestCasesChange((prev) =>
                      prev.map((r, i) => (i === idx ? { ...r, call: e.target.value } : r)),
                    )
                  }
                  placeholder="Lời gọi hàm"
                  className="sm:col-span-4 rounded-lg border border-[#D8E2D8] bg-white px-2 py-1.5 font-mono"
                />
                <input
                  value={tc.expected}
                  onChange={(e) =>
                    onTestCasesChange((prev) =>
                      prev.map((r, i) => (i === idx ? { ...r, expected: e.target.value } : r)),
                    )
                  }
                  placeholder="Expected JSON"
                  className="sm:col-span-3 rounded-lg border border-[#D8E2D8] bg-white px-2 py-1.5 font-mono"
                />
                <label className="sm:col-span-2 inline-flex items-center gap-1 text-[11px] font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tc.is_hidden}
                    onChange={(e) =>
                      onTestCasesChange((prev) =>
                        prev.map((r, i) =>
                          i === idx ? { ...r, is_hidden: e.target.checked } : r,
                        ),
                      )
                    }
                    className="accent-[#15803D]"
                  />
                  <span>Ẩn</span>
                </label>
              </div>
            </div>
          ))}
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

      {/* Per-Test-Case Dual Sandbox Verification Table */}
      {verificationResults.length > 0 && (
        <div
          className="bg-white rounded-2xl border border-[#D8E2D8] p-4 shadow-xs space-y-2.5"
          data-testid="dual-sandbox-verification-table"
        >
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="inline-flex items-center gap-1.5 text-[#14241B]">
              <ShieldCheck className="w-4 h-4 text-[#15803D]" aria-hidden="true" />
              <span>Chi tiết Kiểm chứng Sandbox ({verificationResults.length} test cases)</span>
            </span>
            {verificationMeta && (
              <span className="font-mono text-[11px] text-[#57534E]">
                {verificationMeta.runtimeMs}ms • {verificationMeta.memoryKb}KB
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px] font-mono">
              <thead>
                <tr className="bg-[#F6F8F5] text-[#57534E]">
                  <th className="py-1.5 px-2">Test Case</th>
                  <th className="py-1.5 px-2">Trạng thái</th>
                  <th className="py-1.5 px-2">Actual / Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7EFE7]">
                {verificationResults.map((tr, i) => (
                  <tr key={i}>
                    <td className="py-1.5 px-2 font-bold">{tr.name}</td>
                    <td className="py-1.5 px-2">
                      {tr.passed ? (
                        <span className="inline-flex items-center gap-1 text-[#15803D] font-bold">
                          <CheckCircle2 className="w-3 h-3" aria-hidden="true" /> PASS
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[#9F1239] font-bold">
                          <XCircle className="w-3 h-3" aria-hidden="true" /> FAIL
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 px-2 text-[#57534E] truncate max-w-[200px]">
                      {tr.error ? tr.error : JSON.stringify(tr.actual)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Publish Action Bar */}
      <div className="bg-white rounded-2xl border border-[#D8E2D8] p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-[#57534E]">
          Kiểm chứng kép: Solution Pass 100% &amp; Starter Code Fail &ge; 1 test.
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={dryRunning || submitting || !conceptSlug}
            onClick={onDryRun}
            data-testid="dry-run-sandbox-btn"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#F0FDF4] border border-[#86EFAC] hover:bg-[#DCFCE7] disabled:opacity-45 text-[#14532D] text-xs font-bold cursor-pointer"
          >
            {dryRunning ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-[#15803D]" aria-hidden="true" />
            )}
            <span>{dryRunning ? 'Đang chạy Dry-Run...' : 'Chạy thử Sandbox (Dry-Run)'}</span>
          </button>
          <button
            type="button"
            disabled={submitting || dryRunning || !conceptSlug}
            onClick={onPublish}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#15803D] hover:bg-[#166534] disabled:opacity-45 text-white text-xs font-bold cursor-pointer"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
            )}
            <span>
              {submitting ? 'Đang chạy Kiểm chứng Kép...' : 'Chạy Kiểm chứng Kép & Xuất bản'}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
