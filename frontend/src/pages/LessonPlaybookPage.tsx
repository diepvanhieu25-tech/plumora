import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Check,
  ChevronRight,
  Code2,
  Copy,
  Layers,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import { apiGetDomainRoadmap } from '../api'
import type { DomainRoadmapNode } from '../types'

interface LessonPlaybookPageProps {
  domainSlug: string
  conceptSlug: string
  initialNode?: DomainRoadmapNode | null
  onBackToRoadmap: () => void
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
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#0C1711] text-[11px] font-mono text-[#98FBA9]">
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

function PlaybookMarkdown({ markdown }: { markdown: string }) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const blocks: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

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
          className="my-4 overflow-x-auto rounded-xl border border-outline-variant/30"
        >
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead className="bg-surface-container text-on-surface font-bold">
              <tr>
                {headers.map((h, hIdx) => (
                  <th key={hIdx} className="py-3 px-4 border-b border-outline-variant/30">
                    {renderInlineMarkdown(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container bg-white">
              {rows.map((r, rIdx) => (
                <tr key={rIdx} className="hover:bg-surface-container-low/50">
                  {r.map((cell, cIdx) => (
                    <td key={cIdx} className="py-3 px-4 text-on-surface-variant leading-relaxed">
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

    if (line.startsWith('## ')) {
      blocks.push(
        <h2
          key={`h2-${i}`}
          className="text-lg font-headline font-extrabold text-on-surface mt-6 mb-2.5 pl-3 border-l-4 border-primary"
        >
          {renderInlineMarkdown(line.slice(3))}
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
        <ul key={`ul-${i}`} className="my-2.5 space-y-2 pl-2">
          {items.map((item, idx) => (
            <li
              key={idx}
              className="text-sm sm:text-[15px] text-on-surface-variant leading-relaxed flex items-start gap-2.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0" />
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
      <p key={`p-${i}`} className="text-sm sm:text-[15px] text-on-surface-variant leading-relaxed my-2.5">
        {renderInlineMarkdown(line)}
      </p>,
    )
    i++
  }

  return <div className="space-y-1">{blocks}</div>
}

export function LessonPlaybookPage({
  domainSlug,
  conceptSlug,
  initialNode = null,
  onBackToRoadmap,
  onStartDepthProbe,
  onStartCodeSandbox,
}: LessonPlaybookPageProps) {
  const [node, setNode] = useState<DomainRoadmapNode | null>(
    initialNode && initialNode.slug === conceptSlug ? initialNode : null,
  )
  const [domainTitle, setDomainTitle] = useState<string>(domainSlug)
  const [loading, setLoading] = useState<boolean>(
    !(initialNode && initialNode.slug === conceptSlug),
  )
  const [error, setError] = useState<string | null>(null)

  const loadNode = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rm = await apiGetDomainRoadmap(domainSlug)
      setDomainTitle(rm.domain_title)
      const found = rm.nodes.find((n) => n.slug === conceptSlug) ?? null
      if (!found) {
        setError('Không tìm thấy bài học lý thuyết cho chủ đề này.')
      }
      setNode(found)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể tải nội dung bài học')
    } finally {
      setLoading(false)
    }
  }, [domainSlug, conceptSlug])

  useEffect(() => {
    if (initialNode && initialNode.slug === conceptSlug) {
      setNode(initialNode)
      setLoading(false)
      return
    }
    void loadNode()
  }, [initialNode, conceptSlug, loadNode])

  const depthPct = node ? Math.round(node.depth_level_norm * 100) : 0
  const retentionPct = node ? Math.round(node.retention_ebbinghaus * 100) : 0
  const markdown =
    node?.lesson_markdown && node.lesson_markdown.trim().length > 0
      ? node.lesson_markdown
      : `## ${node?.title ?? conceptSlug}\n\nNội dung bài học lý thuyết đang được cập nhật.`

  return (
    <section
      className="w-full max-w-7xl mx-auto pb-10 space-y-6"
      data-testid="lesson-playbook-page"
    >
      {/* Top Breadcrumb Bar */}
      <div className="p-4 sm:p-5 rounded-2xl bg-surface-container-lowest shadow-sm border border-outline-variant/20 flex flex-wrap items-center justify-between gap-3">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-2 text-xs font-label text-on-surface-variant flex-wrap"
        >
          <button
            type="button"
            onClick={onBackToRoadmap}
            className="inline-flex items-center gap-1.5 text-primary font-bold hover:underline cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            Quay về Lộ trình ({domainTitle})
          </button>
          <ChevronRight className="w-3.5 h-3.5 text-outline-variant" aria-hidden="true" />
          <span className="font-mono text-on-surface">{conceptSlug}</span>
          <ChevronRight className="w-3.5 h-3.5 text-outline-variant" aria-hidden="true" />
          <span className="font-semibold text-primary">Playbook Lý thuyết</span>
        </nav>

        {node && (
          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-container text-on-primary-container font-bold">
              <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
              Tầng {node.tier}
            </span>
          </div>
        )}
      </div>

      {loading && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 h-96 rounded-2xl bg-surface-container-lowest animate-pulse" />
          <div className="lg:col-span-4 h-64 rounded-2xl bg-surface-container-lowest animate-pulse" />
        </div>
      )}

      {!loading && error && (
        <div
          role="alert"
          className="p-5 rounded-2xl bg-[#FEF2F2] border border-[#FECACA] text-xs font-bold text-[#991B1B] flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadNode()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#FECACA] cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            Thử lại
          </button>
        </div>
      )}

      {!loading && !error && node && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Playbook Reader (8 cols) */}
          <article className="lg:col-span-8 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/20 p-6 sm:p-8 space-y-6">
            <header className="pb-5 border-b border-surface-container space-y-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
                <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Playbook Lý thuyết Trọng tâm</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-headline font-extrabold text-on-surface tracking-tight">
                {node.title}
              </h1>
            </header>

            <PlaybookMarkdown markdown={markdown} />
          </article>

          {/* Sticky Sidebar (4 cols) */}
          <aside className="lg:col-span-4 space-y-5 lg:sticky lg:top-20">
            <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/20 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" aria-hidden="true" />
                <h2 className="text-sm font-headline font-extrabold text-on-surface">
                  Tiến độ &amp; Hành động Tiếp theo
                </h2>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-surface-container-low p-3.5 rounded-xl text-xs">
                <div>
                  <span className="text-on-surface-variant block mb-0.5">Độ sâu nắm vững</span>
                  <span className="text-lg font-extrabold text-primary font-mono">{depthPct}%</span>
                </div>
                <div>
                  <span className="text-on-surface-variant block mb-0.5">Độ nhớ</span>
                  <span className="text-lg font-extrabold text-secondary font-mono">
                    {node.depth_level_norm >= 0.5 ? `${retentionPct}%` : '—'}
                  </span>
                </div>
              </div>

              <div className="text-xs text-on-surface-variant space-y-1">
                <span className="font-semibold text-on-surface block">Kiến thức nền liên quan:</span>
                <p>
                  {node.prerequisites.length > 0
                    ? node.prerequisites.join(', ')
                    : 'Chủ đề nền tảng gốc (không yêu cầu bài trước)'}
                </p>
              </div>

              <div className="pt-2 space-y-2.5">
                <button
                  type="button"
                  disabled={!node.is_eligible}
                  onClick={() => onStartDepthProbe(node.slug)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary hover:bg-primary-dim text-on-primary text-xs sm:text-sm font-headline font-bold shadow-sm disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                  <span>Kiểm tra Đào sâu 5 tầng</span>
                </button>
                <button
                  type="button"
                  disabled={!node.is_eligible}
                  onClick={() => onStartCodeSandbox(node.slug)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-bold disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  <Code2 className="w-4 h-4 text-primary" aria-hidden="true" />
                  <span>Thực hành Code</span>
                </button>
                <button
                  type="button"
                  onClick={onBackToRoadmap}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-outline-variant/40 text-xs font-semibold text-on-surface-variant hover:text-on-surface cursor-pointer transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Quay về Bản đồ Lộ trình</span>
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </section>
  )
}
