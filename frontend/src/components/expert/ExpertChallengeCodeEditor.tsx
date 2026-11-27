import { useState } from 'react'
import { CheckCircle2, Code2 } from 'lucide-react'

export interface ExpertChallengeCodeEditorProps {
  starterCode: string
  solutionCode: string
  onStarterCodeChange: (val: string) => void
  onSolutionCodeChange: (val: string) => void
}

export function ExpertChallengeCodeEditor({
  starterCode,
  solutionCode,
  onStarterCodeChange,
  onSolutionCodeChange,
}: ExpertChallengeCodeEditorProps) {
  const [activeEditorTab, setActiveEditorTab] = useState<'starter' | 'solution'>('starter')
  const activeCode = activeEditorTab === 'starter' ? starterCode : solutionCode
  const lineCount = Math.max(10, activeCode.split('\n').length)

  return (
    <div className="lg:col-span-6 bg-white rounded-2xl border border-[#D8E2D8] overflow-hidden shadow-xs">
      <div className="flex items-center justify-between bg-[#F6F8F5] px-4 pt-3 border-b border-[#D8E2D8]">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveEditorTab('starter')}
            className={`px-3.5 py-2 text-xs rounded-t-lg font-bold inline-flex items-center gap-1.5 cursor-pointer ${
              activeEditorTab === 'starter'
                ? 'bg-[#0F172A] text-amber-400'
                : 'text-[#57534E] hover:text-[#14241B]'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Buggy Starter Code (Phải Fail &ge; 1 test)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveEditorTab('solution')}
            className={`px-3.5 py-2 text-xs rounded-t-lg font-bold inline-flex items-center gap-1.5 cursor-pointer ${
              activeEditorTab === 'solution'
                ? 'bg-[#0F172A] text-emerald-400'
                : 'text-[#57534E] hover:text-[#14241B]'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Reference Solution (Phải Pass 100%)</span>
          </button>
        </div>
      </div>

      <div className="bg-[#0F172A] p-4 flex font-mono text-xs leading-6">
        <div
          className="select-none text-slate-500 text-right pr-3 border-r border-slate-800"
          aria-hidden="true"
        >
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i}>{String(i + 1).padStart(2, '0')}</div>
          ))}
        </div>
        {activeEditorTab === 'starter' ? (
          <textarea
            aria-label="Buggy Starter Code"
            rows={12}
            value={starterCode}
            onChange={(e) => onStarterCodeChange(e.target.value)}
            spellCheck={false}
            className="flex-1 w-full bg-transparent text-slate-100 pl-3 font-mono text-xs leading-6 focus:outline-none resize-y"
          />
        ) : (
          <textarea
            aria-label="Reference Solution Code"
            rows={12}
            value={solutionCode}
            onChange={(e) => onSolutionCodeChange(e.target.value)}
            spellCheck={false}
            className="flex-1 w-full bg-transparent text-emerald-300 pl-3 font-mono text-xs leading-6 focus:outline-none resize-y"
          />
        )}
      </div>
    </div>
  )
}
