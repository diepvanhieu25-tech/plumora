import { useEffect, useState } from 'react'
import {
  BookOpen,
  Check,
  Code2,
  Copy,
  Layers,
  ShieldCheck,
  X,
} from 'lucide-react'
import type { DomainRoadmapNode } from '../types'

interface LessonPlaybookModalProps {
  node: DomainRoadmapNode | null
  onClose: () => void
  onStartDepthProbe: (slug: string) => void
  onStartCodeSandbox: (slug: string) => void
}

function renderInlineMarkdown(text: string): React.ReactNode[] {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g)
  return parts.map((part, idx) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 rounded bg-surface-container font-mono text-[12px] text-primary font-semibold"
        >
          {part.slice(1, -1)}
        </code>
      )
    }
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <strong key={idx} className="font-bold text-on-surface">
          {part.slice(2, -2)}
        </strong>
      )
    }
    return <span key={idx}>{part}</span>
  })
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    void navigator.clipboard?.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-outline-variant/30 bg-[#14241B] text-[#E9FFE7]">
      <div className="flex items-center justify-between px-3.5 py-2 bg-[#0C1711] text-[11px] font-mono text-[#98FBA9]">
        <span>{lang || 'code'}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3" aria-hidden="true" />
              <span>Đã chép</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" aria-hidden="true" />
              <span>Sao chép</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-4 text-xs font-mono overflow-x-auto leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  )
}

function PlaybookMarkdown({ markdown }: { markdown: string }) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const blocks: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Fenced code block
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      blocks.push(<CodeBlock key={`code-${i}`} lang={lang} code={codeLines.join('\n')} />)
      i++
      continue
    }

    // Markdown table
    if (line.trim().startsWith('|') && i + 1 < lines.length && lines[i + 1].includes('---')) {
      const parseRow = (row: string) =>
        row
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((c) => c.trim())

      const headers = parseRow(line)
      i += 2
      const rows: string[][] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(parseRow(lines[i]))
        i++
      }
      blocks.push(
        <div
          key={`tbl-${i}`}
          className="my-3 overflow-x-auto rounded-xl border border-outline-variant/30"
        >
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-surface-container text-on-surface font-bold">
              <tr>
                {headers.map((h, hIdx) => (
                  <th key={hIdx} className="py-2.5 px-3 border-b border-outline-variant/30">
                    {renderInlineMarkdown(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container bg-white">
              {rows.map((r, rIdx) => (
                <tr key={rIdx} className="hover:bg-surface-container-low/50">
                  {r.map((cell, cIdx) => (
                    <td key={cIdx} className="py-2.5 px-3 text-on-surface-variant leading-relaxed">
                      {renderInlineMarkdown(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      )
      continue
    }

    // Headings
    if (line.startsWith('## ')) {
      blocks.push(
        <h3
          key={`h2-${i}`}
          className="text-base font-headline font-extrabold text-on-surface mt-5 mb-2 pl-3 border-l-4 border-primary"
        >
          {renderInlineMarkdown(line.slice(3))}
        </h3>,
      )
      i++
      continue
    }
    if (line.startsWith('### ')) {
      blocks.push(
        <h4
          key={`h3-${i}`}
          className="text-sm font-headline font-bold text-primary mt-4 mb-1.5"
        >
          {renderInlineMarkdown(line.slice(4))}
        </h4>,
      )
      i++
      continue
    }

    // Bullet list
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      const items: string[] = []
      while (
        i < lines.length &&
        (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* '))
      ) {
        items.push(lines[i].trim().slice(2))
        i++
      }
      blocks.push(
        <ul key={`ul-${i}`} className="my-2 space-y-1.5 pl-4">
          {items.map((item, idx) => (
            <li
              key={idx}
              className="text-sm text-on-surface-variant leading-relaxed flex items-start gap-2"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
              <span>{renderInlineMarkdown(item)}</span>
            </li>
          ))}
        </ul>,
      )
      continue
    }

    if (line.trim() === '') {
      i++
      continue
    }

    blocks.push(
      <p key={`p-${i}`} className="text-sm text-on-surface-variant leading-relaxed my-2">
        {renderInlineMarkdown(line)}
      </p>,
    )
    i++
  }

  return <div className="space-y-1">{blocks}</div>
}

export function LessonPlaybookModal({
  node,
  onClose,
  onStartDepthProbe,
  onStartCodeSandbox,
}: LessonPlaybookModalProps) {
  useEffect(() => {
    if (!node) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [node, onClose])

  if (!node) return null

  const markdown =
    node.lesson_markdown && node.lesson_markdown.trim().length > 0
      ? node.lesson_markdown
      : `## ${node.title}\n\nNội dung bài học lý thuyết đang được cập nhật. Bạn có thể bắt đầu phần Đào sâu 5 tầng hoặc Thực hành Code để kiểm tra kiến thức.`

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="playbook-modal-title"
      className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6"
      data-testid="lesson-playbook-modal"
    >
      <div className="bg-surface-container-lowest w-full max-w-3xl max-h-[90vh] rounded-2xl shadow-2xl border border-outline-variant/30 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-surface-container-low border-b border-outline-variant/25 flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary-container text-on-primary-container font-bold">
                <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
                Playbook Lý thuyết
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-mono font-semibold">
                <Layers className="w-3 h-3" aria-hidden="true" />
                Tầng {node.tier} • {node.slug}
              </span>
            </div>
            <h2
              id="playbook-modal-title"
              className="text-lg sm:text-xl font-headline font-extrabold text-on-surface"
            >
              {node.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng bài học lý thuyết"
            className="w-10 h-10 rounded-xl bg-white border border-outline-variant/40 flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:border-primary cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 bg-white">
          <PlaybookMarkdown markdown={markdown} />
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-surface-container-low border-t border-outline-variant/25 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-white border border-outline-variant/40 text-xs font-bold text-on-surface-variant hover:text-on-surface cursor-pointer"
          >
            Đóng Playbook
          </button>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={!node.is_eligible}
              onClick={() => {
                onClose()
                onStartCodeSandbox(node.slug)
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-bold disabled:opacity-45 cursor-pointer"
            >
              <Code2 className="w-4 h-4 text-primary" aria-hidden="true" />
              Thực hành Code
            </button>
            <button
              type="button"
              disabled={!node.is_eligible}
              onClick={() => {
                onClose()
                onStartDepthProbe(node.slug)
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-dim text-on-primary text-xs font-bold shadow-sm disabled:opacity-45 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" aria-hidden="true" />
              Kiểm tra Đào sâu 5 tầng
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
