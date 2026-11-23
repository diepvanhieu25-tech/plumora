import { useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Code2,
  Layers,
  Lock,
  ShieldCheck,
} from 'lucide-react'
import { apiCompletePlaybook, apiGetConceptPlaybook } from '../api'
import { DepthBadge } from '../components/ui/DepthBadge'
import { MarkdownRenderer } from '../components/ui/MarkdownRenderer'
import { PageContextBar } from '../components/ui/PageContextBar'
import { RetentionMeter } from '../components/ui/RetentionMeter'
import { StatusAlertBanner } from '../components/ui/StatusAlertBanner'
import { useAsyncQuery } from '../hooks/useAsyncQuery'
import type { DomainRoadmapNode } from '../types'
import { generateSubmissionId } from '../utils/submission'

interface LessonPlaybookPageProps {
  domainSlug: string
  conceptSlug: string
  initialNode?: DomainRoadmapNode | null
  onBackToRoadmap: () => void
  onStartDepthProbe: (slug: string) => void
  onStartCodeSandbox: (slug: string) => void
}

export function LessonPlaybookPage({
  domainSlug,
  conceptSlug,
  initialNode = null,
  onBackToRoadmap,
  onStartDepthProbe,
  onStartCodeSandbox,
}: LessonPlaybookPageProps) {
  const [completing, setCompleting] = useState(false)
  const [completeError, setCompleteError] = useState<string | null>(null)
  const [completedOverride, setCompletedOverride] = useState(false)
  const [selfCheckConfirmed, setSelfCheckConfirmed] = useState(false)

  const { data, loading, errorMessage, refetch } = useAsyncQuery(
    (signal) => apiGetConceptPlaybook(domainSlug, conceptSlug, signal),
    [domainSlug, conceptSlug],
    {
      initialData:
        initialNode && initialNode.slug === conceptSlug
          ? { domain_slug: domainSlug, domain_title: domainSlug, node: initialNode }
          : null,
    },
  )

  const node = data?.node ?? (initialNode && initialNode.slug === conceptSlug ? initialNode : null)
  const domainTitle = data?.domain_title ?? domainSlug
  const isPlaybookCompleted = Boolean(completedOverride || node?.playbook_completed)

  async function handleCompletePlaybook() {
    if (!node || completing) return
    setCompleting(true)
    setCompleteError(null)
    try {
      await apiCompletePlaybook(domainSlug, node.slug, generateSubmissionId())
      setCompletedOverride(true)
    } catch (err) {
      setCompleteError(
        err instanceof Error ? err.message : 'Không thể ghi nhận hoàn thành bài giảng',
      )
    } finally {
      setCompleting(false)
    }
  }

  const markdown =
    node?.lesson_markdown && node.lesson_markdown.trim().length > 0
      ? node.lesson_markdown
      : `## ${node?.title ?? conceptSlug}\n\nNội dung bài học lý thuyết đang được cập nhật.`

  const prereqItems =
    node?.prerequisite_titles && node.prerequisite_titles.length > 0
      ? node.prerequisite_titles
      : (node?.prerequisites ?? []).map((slug) => ({ slug, title: slug }))

  return (
    <section className="w-full pb-10 space-y-6" data-testid="lesson-playbook-page">
      <PageContextBar
        backLabel={`Quay về Lộ trình (${domainTitle})`}
        onBack={onBackToRoadmap}
        breadcrumbs={[
          { label: domainTitle, onClick: onBackToRoadmap },
          { label: node?.title ?? conceptSlug },
          { label: 'Bài giảng Lý thuyết', isCurrent: true },
        ]}
        rightSlot={
          node ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-container text-on-primary-container text-xs font-bold">
                <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Tầng {node.tier}</span>
              </span>
              <DepthBadge depthNorm={node.depth_level_norm} isEligible={node.is_eligible} />
            </div>
          ) : undefined
        }
      />

      {loading && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 h-96 rounded-2xl bg-white border border-outline-variant/40 animate-pulse" />
          <div className="lg:col-span-4 h-64 rounded-2xl bg-white border border-outline-variant/40 animate-pulse" />
        </div>
      )}

      {!loading && errorMessage && (
        <StatusAlertBanner variant="error" message={errorMessage} onRetry={refetch} />
      )}

      {!loading && !errorMessage && node && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Playbook Reader (8 cols) */}
          <article className="lg:col-span-8 bg-white rounded-2xl shadow-sm border border-outline-variant/50 p-6 sm:p-8 space-y-6">
            {!node.is_eligible && (
              <StatusAlertBanner
                variant="warning"
                title="Chủ đề này chưa mở khóa kiểm tra"
                message={`Bạn cần đạt mức Hiểu bản chất (75%) ở các bài tiên quyết (${prereqItems.map((p) => p.title).join(', ')}) trước khi làm bài đánh giá của chủ đề này.`}
                actionSlot={
                  <button
                    type="button"
                    onClick={onBackToRoadmap}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-tertiary text-white text-xs font-bold cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Về Lộ trình</span>
                  </button>
                }
              />
            )}

            <header className="pb-5 border-b border-surface-container space-y-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary-container/60 text-on-primary-container text-xs font-bold">
                <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Bước 1 • Bài giảng Lý thuyết &amp; Mô hình Tư duy</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-headline font-extrabold text-on-surface tracking-tight">
                {node.title}
              </h1>
            </header>

            <MarkdownRenderer markdown={markdown} />

            {/* End-of-Lesson Quick Self-Check & Playbook Completion Gate (INV-SEQ-01) */}
            <div className="mt-8 pt-6 border-t border-surface-container space-y-4">
              {completeError && (
                <StatusAlertBanner variant="error" message={completeError} />
              )}

              {isPlaybookCompleted ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="p-5 rounded-2xl bg-primary-container/40 border border-primary/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                    <div className="text-xs sm:text-sm space-y-0.5">
                      <p className="font-bold text-on-primary-container">
                        Bạn đã hoàn thành Bài giảng Lý thuyết!
                      </p>
                      <p className="text-xs text-on-surface-variant">
                        Sẵn sàng bước sang Kiểm tra Đào sâu 5 tầng để kiểm chứng và nâng bậc năng lực.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!node.is_eligible}
                    onClick={() => onStartDepthProbe(node.slug)}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary hover:bg-primary-dim text-on-primary text-xs sm:text-sm font-bold shadow-sm disabled:opacity-45 cursor-pointer shrink-0 transition-colors"
                    data-testid="proceed-to-depth-probe-btn"
                  >
                    <span>Vào Kiểm tra Đào sâu 5 tầng</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <div className="p-5 rounded-2xl bg-surface-container-low border border-outline-variant/60 space-y-4">
                  <div className="space-y-1">
                    <h2 className="text-sm font-bold text-on-surface">
                      Xác nhận nắm vững Lý thuyết trước khi kiểm tra
                    </h2>
                    <p className="text-xs text-on-surface-variant leading-relaxed">
                      Hãy đảm bảo bạn đã đọc kỹ cơ chế hoạt động, các ví dụ và cạm bẫy phổ biến ở trên trước khi bước vào đánh giá 5 tầng.
                    </p>
                  </div>

                  <label className="flex items-start gap-2.5 text-xs text-on-surface cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={selfCheckConfirmed}
                      onChange={(e) => setSelfCheckConfirmed(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-primary rounded cursor-pointer"
                      data-testid="playbook-selfcheck-checkbox"
                    />
                    <span className="leading-relaxed font-medium">
                      Tôi đã nắm được khái niệm cốt lõi, cơ chế vận hành và các lưu ý thực tế của chủ đề{' '}
                      <strong>{node.title}</strong>.
                    </span>
                  </label>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      disabled={!node.is_eligible || !selfCheckConfirmed || completing}
                      onClick={() => void handleCompletePlaybook()}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-dim text-on-primary text-xs sm:text-sm font-bold shadow-sm disabled:opacity-45 cursor-pointer transition-colors"
                      data-testid="complete-playbook-btn"
                    >
                      <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                      <span>
                        {completing ? 'Đang ghi nhận...' : 'Hoàn thành Bài học Lý thuyết'}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </article>

          {/* Sticky Sidebar (4 cols) */}
          <aside className="lg:col-span-4 space-y-5 lg:sticky lg:top-20">
            <div className="bg-white rounded-2xl shadow-sm border border-outline-variant/50 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" aria-hidden="true" />
                <h2 className="text-sm font-headline font-extrabold text-on-surface">
                  Tiến độ &amp; Bước tiếp theo
                </h2>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-container-low space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-on-surface-variant font-medium">Mức độ nắm vững</span>
                  <span className="font-mono font-bold text-primary">
                    {Math.round(node.depth_level_norm * 100)}%
                  </span>
                </div>
                <RetentionMeter
                  retention={node.retention_ebbinghaus}
                  needsReview={node.needs_review}
                  active={node.depth_level_norm >= 0.5}
                  nextReviewDueAt={node.next_review_due_at}
                  showSchedule
                />
              </div>

              <div className="text-xs text-on-surface-variant space-y-1">
                <span className="font-semibold text-on-surface block">Kiến thức nền liên quan:</span>
                <p>
                  {prereqItems.length > 0
                    ? prereqItems.map((p) => p.title).join(', ')
                    : 'Chủ đề nền tảng gốc (không yêu cầu bài trước)'}
                </p>
              </div>

              <div className="pt-2 space-y-2.5">
                <button
                  type="button"
                  disabled={!node.is_eligible}
                  onClick={() => onStartDepthProbe(node.slug)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary hover:bg-primary-dim text-on-primary text-xs sm:text-sm font-bold shadow-sm disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                  <span>Kiểm tra Đào sâu 5 tầng</span>
                </button>
                {node.has_code_challenge && (
                  <button
                    type="button"
                    disabled={!node.is_eligible}
                    onClick={() => onStartCodeSandbox(node.slug)}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-bold disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    <Code2 className="w-4 h-4 text-primary" aria-hidden="true" />
                    <span>Thực hành Lập trình</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onBackToRoadmap}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-outline-variant text-xs font-semibold text-on-surface-variant hover:text-on-surface cursor-pointer transition-colors"
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
