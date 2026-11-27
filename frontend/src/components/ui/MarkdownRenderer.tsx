import { useState } from 'react'
import { AlertTriangle, Check, Copy, Info, Lightbulb } from 'lucide-react'

const LATEX_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\\rightarrow|\\to\b/g, '→'],
  [/\\leftarrow/g, '←'],
  [/\\leftrightarrow/g, '↔'],
  [/\\ge\b|\\geq\b/g, '≥'],
  [/\\le\b|\\leq\b/g, '≤'],
  [/\\neq\b/g, '≠'],
  [/\\approx\b/g, '≈'],
  [/\\times\b/g, '×'],
  [/\\cdot\b/g, '·'],
  [/\\Delta\b/g, 'Δ'],
  [/\\alpha\b/g, 'α'],
  [/\\gamma\b/g, 'γ'],
  [/\\phi\b/g, 'φ'],
  [/\\delta\b/g, 'δ'],
  [/\\log\b/g, 'log'],
  [/\\textunderscore/g, '_'],
  [/\\text\{([^}]+)\}/g, '$1'],
  [/S_0/g, 'S₀'],
  [/S_\{new\}/g, 'S_new'],
  [/S_\{old\}/g, 'S_old'],
  [/\\_/g, '_'],
]

export function cleanMathText(raw: string): string {
  // Replace inline $...$ blocks with clean readable mathematical typography
  return raw.replace(/\$([^$]+)\$/g, (_match, inner: string) => {
    let cleaned = inner
    for (const [pat, rep] of LATEX_REPLACEMENTS) {
      cleaned = cleaned.replace(pat, rep)
    }
    return cleaned.replace(/[{}]/g, '').trim()
  })
}

function renderInlineMarkdown(rawText: string): React.ReactNode[] {
  const text = cleanMathText(rawText)
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g)
  return parts.map((part, idx) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 rounded bg-surface-container font-mono text-[13px] text-primary font-semibold"
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
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 3) {
      return (
        <em key={idx} className="italic text-on-surface">
          {part.slice(1, -1)}
        </em>
      )
    }
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (linkMatch) {
      const href = linkMatch[2]
      const isSafe =
        href.startsWith('http://') ||
        href.startsWith('https://') ||
        (href.startsWith('/') && !href.startsWith('//'))
      if (isSafe) {
        return (
          <a
            key={idx}
            href={href}
            target={href.startsWith('http') ? '_blank' : undefined}
            rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
            className="text-primary underline hover:text-primary-dim font-medium"
          >
            {linkMatch[1]}
          </a>
        )
      }
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
    <div className="my-4 rounded-xl overflow-hidden border border-outline-variant/30 bg-[#14241B] text-[#E9FFE7]">
      <div className="flex items-center justify-between px-4 py-2 bg-[#0C1711] text-[11px] font-mono text-[#98FBA9]">
        <span>{lang || 'code'}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-colors"
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
      <pre className="p-4 text-xs sm:text-[13px] font-mono overflow-x-auto leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  )
}

interface BulletNode {
  text: string
  children: string[]
}

function parseSectionAnchorId(headingText: string): string | undefined {
  const m = headingText.trim().match(/^(\d+)\.\s+/)
  return m ? `playbook-sec-${m[1]}` : undefined
}

interface MarkdownRendererProps {
  markdown: string
  className?: string
}

export function MarkdownRenderer({ markdown, className = '' }: MarkdownRendererProps) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const blocks: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim()
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

    if (trimmed.startsWith('|') && i + 1 < lines.length && lines[i + 1].includes('---')) {
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
          className="my-4 overflow-x-auto rounded-xl border border-outline-variant/40"
        >
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead className="bg-surface-container text-on-surface font-bold">
              <tr>
                {headers.map((h, hIdx) => (
                  <th key={hIdx} className="py-2.5 px-3.5 border-b border-outline-variant/40">
                    {renderInlineMarkdown(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container bg-white">
              {rows.map((r, rIdx) => (
                <tr key={rIdx} className="hover:bg-surface-container-low/50">
                  {r.map((cell, cIdx) => (
                    <td key={cIdx} className="py-2.5 px-3.5 text-on-surface-variant leading-relaxed">
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

    if (trimmed.startsWith('> ')) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('> ')) {
        quoteLines.push(lines[i].trim().slice(2))
        i++
      }
      const firstLine = quoteLines[0] ?? ''
      const calloutMatch = firstLine.match(/^\[!(TIP|NOTE|WARNING|IMPORTANT)\]\s*(.*)$/i)
      if (calloutMatch) {
        const kind = calloutMatch[1].toUpperCase()
        const restLines = [calloutMatch[2], ...quoteLines.slice(1)].filter((l) => l.trim().length > 0)
        const isWarn = kind === 'WARNING'
        const isTip = kind === 'TIP'
        const boxCls = isWarn
          ? 'border-[#F59E0B] bg-[#FFFBEB] text-[#78350F]'
          : isTip
            ? 'border-[#15803D] bg-[#F0FDF4] text-[#14532D]'
            : 'border-secondary bg-secondary-container/25 text-on-surface'
        const label = isWarn ? 'Lưu ý quan trọng' : isTip ? 'Mẹo thực chiến' : 'Ghi chú'
        blocks.push(
          <aside
            key={`callout-${i}`}
            className={`my-4 pl-4 pr-4 py-3 rounded-xl border-l-4 text-xs sm:text-sm leading-relaxed space-y-1 ${boxCls}`}
          >
            <div className="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wide">
              {isWarn ? (
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              ) : isTip ? (
                <Lightbulb className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              ) : (
                <Info className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              )}
              <span>{label}</span>
            </div>
            {restLines.map((ql, qIdx) => (
              <p key={qIdx}>{renderInlineMarkdown(ql)}</p>
            ))}
          </aside>,
        )
      } else {
        blocks.push(
          <blockquote
            key={`bq-${i}`}
            className="my-3 pl-4 pr-3 py-2.5 rounded-r-xl border-l-4 border-secondary bg-secondary-container/25 text-xs sm:text-sm text-on-surface leading-relaxed space-y-1"
          >
            {quoteLines.map((ql, qIdx) => (
              <p key={qIdx}>{renderInlineMarkdown(ql)}</p>
            ))}
          </blockquote>,
        )
      }
      continue
    }

    if (line.startsWith('# ')) {
      blocks.push(
        <h1
          key={`h1-${i}`}
          className="text-xl sm:text-2xl font-headline font-extrabold text-on-surface mt-6 mb-3"
        >
          {renderInlineMarkdown(line.slice(2))}
        </h1>,
      )
      i++
      continue
    }
    if (line.startsWith('## ')) {
      const headingText = line.slice(3)
      const anchorId = parseSectionAnchorId(headingText)
      blocks.push(
        <h2
          key={`h2-${i}`}
          id={anchorId}
          className="scroll-mt-24 text-lg font-headline font-extrabold text-on-surface mt-7 mb-2.5 pl-3 border-l-4 border-primary"
        >
          {renderInlineMarkdown(headingText)}
        </h2>,
      )
      i++
      continue
    }
    if (line.startsWith('### ')) {
      blocks.push(
        <h3
          key={`h3-${i}`}
          className="text-base font-headline font-bold text-primary mt-5 mb-2"
        >
          {renderInlineMarkdown(line.slice(4))}
        </h3>,
      )
      i++
      continue
    }
    if (line.startsWith('#### ')) {
      blocks.push(
        <h4
          key={`h4-${i}`}
          className="text-sm font-headline font-bold text-on-surface mt-4 mb-1.5"
        >
          {renderInlineMarkdown(line.slice(5))}
        </h4>,
      )
      i++
      continue
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const items: BulletNode[] = []
      while (
        i < lines.length &&
        (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* '))
      ) {
        const indent = lines[i].length - lines[i].trimStart().length
        const content = lines[i].trim().slice(2)
        if (indent >= 2 && items.length > 0) {
          items[items.length - 1].children.push(content)
        } else {
          items.push({ text: content, children: [] })
        }
        i++
      }
      blocks.push(
        <ul key={`ul-${i}`} className="my-2.5 space-y-2 pl-2">
          {items.map((item, idx) => (
            <li key={idx} className="text-sm sm:text-[15px] text-on-surface-variant leading-relaxed">
              <div className="flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
                <span>{renderInlineMarkdown(item.text)}</span>
              </div>
              {item.children.length > 0 && (
                <ul data-nested-list="true" className="mt-1.5 ml-6 space-y-1.5">
                  {item.children.map((sub, sIdx) => (
                    <li
                      key={sIdx}
                      className="text-xs sm:text-sm text-on-surface-variant leading-relaxed flex items-start gap-2"
                    >
                      <span className="w-1.5 h-1.5 rounded-full border border-primary mt-2 shrink-0" />
                      <span>{renderInlineMarkdown(sub)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>,
      )
      continue
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''))
        i++
      }
      blocks.push(
        <ol
          key={`ol-${i}`}
          className="my-2.5 space-y-2 pl-5 list-decimal text-sm sm:text-[15px] text-on-surface-variant leading-relaxed"
        >
          {items.map((item, idx) => (
            <li key={idx} className="pl-1">
              {renderInlineMarkdown(item)}
            </li>
          ))}
        </ol>,
      )
      continue
    }

    if (trimmed === '') {
      i++
      continue
    }

    blocks.push(
      <p
        key={`p-${i}`}
        className="text-sm sm:text-[15px] text-on-surface-variant leading-relaxed my-2.5 max-w-[68ch]"
      >
        {renderInlineMarkdown(line)}
      </p>,
    )
    i++
  }

  return <div className={`space-y-1 ${className}`}>{blocks}</div>
}
