import React, { useState } from 'react'
import { Check, CheckCircle2, Copy, FileCode2, Terminal } from 'lucide-react'

interface MarkdownRendererProps {
  content: string
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(code)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      // Fallback ignore if clipboard permission denied
    }
  }

  const displayLang = (language || 'CODE').toUpperCase()

  return (
    <div className="my-5 rounded-xl overflow-hidden border border-[#27272A] bg-[#18181B] shadow-sm">
      {/* Terminal Title Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#27272A] border-b border-[#3F3F46] text-xs font-mono">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]/80"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]/80"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]/80"></span>
          </div>
          <div className="flex items-center gap-1 text-[#A1A1AA] ml-2">
            <Terminal className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="font-semibold text-[11px] text-[#E4E4E7]">{displayLang}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#3F3F46] hover:bg-[#52525B] text-[#D4D4D8] hover:text-white transition-colors cursor-pointer text-[11px]"
          title="Sao chép khối lệnh"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-[#4ADE80]" aria-hidden="true" />
              <span className="text-[#4ADE80] font-semibold">Đã chép</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-[#A1A1AA]" aria-hidden="true" />
              <span>Sao chép</span>
            </>
          )}
        </button>
      </div>

      {/* Code Content */}
      <pre className="p-4 text-xs font-mono text-[#F4F4F5] overflow-x-auto leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  )
}

function renderInlineText(text: string): React.ReactNode[] {
  // Regex to split on `code` or **bold**
  const regex = /(`[^`]+`|\*\*[^*]+\*\*)/g
  const parts = text.split(regex)

  return parts.map((part, idx) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      const code = part.slice(1, -1)
      return (
        <code
          key={idx}
          className="font-mono text-xs px-1.5 py-0.5 rounded bg-[#F5F5F4] text-[#14532D] font-semibold border border-[#E7E5E4]"
        >
          {code}
        </code>
      )
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      const boldText = part.slice(2, -2)
      return (
        <strong key={idx} className="font-bold text-[#14241B]">
          {boldText}
        </strong>
      )
    }
    return <span key={idx}>{part}</span>
  })
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  if (!content) return null

  const lines = content.split('\n')
  const blocks: React.ReactNode[] = []

  let i = 0
  let blockKey = 0

  while (i < lines.length) {
    const line = lines[i]

    // 1. Code Block: ```lang
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      i++ // skip closing ```
      blocks.push(
        <CodeBlock
          key={`code-${blockKey++}`}
          code={codeLines.join('\n')}
          language={lang}
        />
      )
      continue
    }

    // 2. Table: lines starting and ending with |
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const tableLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim())
        i++
      }

      // Filter out divider lines like | --- | --- |
      const dataRows = tableLines.filter((l) => !/^\|[\s\-:|]+\|$/.test(l))
      if (dataRows.length > 0) {
        const headerRow = dataRows[0]
          .slice(1, -1)
          .split('|')
          .map((c) => c.trim())
        const bodyRows = dataRows.slice(1).map((r) =>
          r
            .slice(1, -1)
            .split('|')
            .map((c) => c.trim())
        )

        blocks.push(
          <div key={`table-${blockKey++}`} className="my-5 overflow-x-auto rounded-xl border border-[#D8E2D8] shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#F6F8F5] border-b border-[#D8E2D8] text-[#14241B]">
                <tr>
                  {headerRow.map((h, colIdx) => (
                    <th key={colIdx} className="px-4 py-3 font-bold text-[#14241B] tracking-wide">
                      {renderInlineText(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E5E4] bg-white">
                {bodyRows.map((row, rowIdx) => (
                  <tr
                    key={rowIdx}
                    className="hover:bg-[#F9FAF8] transition-colors"
                  >
                    {row.map((cell, cellIdx) => (
                      <td key={cellIdx} className="px-4 py-3 text-[#3F5247] leading-relaxed">
                        {renderInlineText(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
      continue
    }

    // 3. Headings: ## or ###
    if (line.startsWith('## ')) {
      const headingText = line.slice(3).trim()
      blocks.push(
        <div key={`h2-${blockKey++}`} className="pt-6 pb-2 border-b border-[#E7E5E4] my-4">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-5 rounded-full bg-[#15803D]"></span>
            <h2 className="text-lg sm:text-xl font-bold text-[#14241B] tracking-tight">
              {renderInlineText(headingText)}
            </h2>
          </div>
        </div>
      )
      i++
      continue
    }

    if (line.startsWith('### ')) {
      const headingText = line.slice(4).trim()
      blocks.push(
        <h3
          key={`h3-${blockKey++}`}
          className="text-base font-bold text-[#14241B] mt-5 mb-2 flex items-center gap-2"
        >
          <FileCode2 className="w-4 h-4 text-[#15803D]" aria-hidden="true" />
          <span>{renderInlineText(headingText)}</span>
        </h3>
      )
      i++
      continue
    }

    // 4. Blockquotes: > ...
    if (line.startsWith('> ')) {
      const quoteText = line.slice(2).trim()
      blocks.push(
        <blockquote
          key={`quote-${blockKey++}`}
          className="my-4 p-4 rounded-xl bg-[#F0FDF4] border-l-4 border-[#15803D] text-xs sm:text-sm text-[#14532D] leading-relaxed shadow-2xs"
        >
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0 mt-0.5" aria-hidden="true" />
            <div>{renderInlineText(quoteText)}</div>
          </div>
        </blockquote>
      )
      i++
      continue
    }

    // 5. Unordered List Items: - or *
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      const listItems: string[] = []
      while (
        i < lines.length &&
        (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* '))
      ) {
        listItems.push(lines[i].trim().slice(2).trim())
        i++
      }

      blocks.push(
        <ul key={`ul-${blockKey++}`} className="space-y-2.5 my-4 pl-1">
          {listItems.map((item, itemIdx) => (
            <li key={itemIdx} className="flex items-start gap-2.5 text-xs sm:text-sm text-[#3F5247] leading-relaxed">
              <span className="w-1.5 h-1.5 rounded-full bg-[#15803D] mt-2 shrink-0"></span>
              <div className="flex-1 min-w-0">{renderInlineText(item)}</div>
            </li>
          ))}
        </ul>
      )
      continue
    }

    // 6. Empty Line
    if (!line.trim()) {
      i++
      continue
    }

    // 7. Normal Paragraph
    blocks.push(
      <p key={`p-${blockKey++}`} className="text-xs sm:text-sm text-[#3F5247] leading-relaxed my-2.5">
        {renderInlineText(line.trim())}
      </p>
    )
    i++
  }

  return (
    <div className="lesson-markdown-content space-y-2" data-testid="lesson-markdown-body">
      {blocks}
    </div>
  )
}
