import { useEffect, useState } from 'react'
import { ArrowRight, CheckCircle2, Compass, Sparkles } from 'lucide-react'
import { apiGetV2Recommendation } from '../../api'
import type { V2RecommendationResponse } from '../../types'

interface AdaptiveNextStepCardProps {
  domainSlug: string
  onAction?: (conceptSlug: string, learningMode: string) => void
}

const MODE_LABELS: Record<string, { label: string; cta: string }> = {
  Learn_New: { label: 'Học Playbook mới', cta: 'Mở Bài giảng Lý thuyết' },
  Deep_Probe: { label: 'Luyện tập Đào sâu 5 cấp độ', cta: 'Vào Luyện tập Đào sâu' },
  Code_Practice: { label: 'Thực hành Code Sandbox', cta: 'Mở Phòng Thực hành Code' },
  Spaced_Review: { label: 'Ôn tập Củng cố Trí nhớ', cta: 'Ôn tập nhanh ngay' },
}

export function AdaptiveNextStepCard({ domainSlug, onAction }: AdaptiveNextStepCardProps) {
  const [rec, setRec] = useState<V2RecommendationResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    apiGetV2Recommendation(domainSlug)
      .then((res) => {
        if (active) setRec(res)
      })
      .catch(() => {
        if (active) setRec(null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [domainSlug])

  if (loading) {
    return (
      <div className="p-4 rounded-2xl bg-ai-sunlit-bg/60 border border-ai-sunlit-border/40 animate-pulse text-xs text-ai-sunlit-text">
        Đang cập nhật lộ trình thích ứng theo kết quả vừa hoàn thành...
      </div>
    )
  }

  if (!rec) return null

  if (rec.status === 'completed' || !rec.recommended_action) {
    return (
      <div
        className="p-4 rounded-2xl bg-primary-container/40 border border-primary/30 flex items-center gap-3 text-xs"
        data-testid="adaptive-next-step-card"
      >
        <CheckCircle2 className="w-5 h-5 text-primary shrink-0" aria-hidden="true" />
        <div>
          <p className="font-bold text-on-primary-container">
            Bạn đã đạt chuẩn Hiểu bản chất toàn bộ chuyên ngành này!
          </p>
          <p className="text-on-surface-variant mt-0.5">
            Hệ thống sẽ tự động nhắc bạn khi có chủ đề đến hạn ôn tập củng cố trí nhớ.
          </p>
        </div>
      </div>
    )
  }

  const act = rec.recommended_action
  const meta = MODE_LABELS[act.learning_mode] ?? MODE_LABELS.Learn_New
  const factors = rec.decision_factors ?? []

  return (
    <div
      className="p-4 rounded-2xl bg-ai-sunlit-bg border border-ai-sunlit-border/70 space-y-3"
      data-testid="adaptive-next-step-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-tertiary text-on-tertiary text-[11px] font-bold">
          <Compass className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Lộ trình vừa được AI điều chỉnh</span>
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-ai-sunlit-text">
          <Sparkles className="w-3.5 h-3.5 text-tertiary" aria-hidden="true" />
          <span>{meta.label}</span>
        </span>
      </div>

      <div className="space-y-1">
        <h3 className="text-sm font-headline font-extrabold text-on-surface">
          Bước tối ưu tiếp theo: {act.title}
        </h3>
        <p className="text-xs text-on-surface-variant leading-relaxed">{act.reason_vi}</p>
      </div>

      {factors.length > 0 && (
        <ul className="space-y-1 text-[11px] text-on-surface-variant">
          {factors.map((f, idx) => (
            <li key={idx} className="flex items-start gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      )}

      {onAction && (
        <button
          type="button"
          onClick={() => onAction(act.concept_slug, act.learning_mode)}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-tertiary hover:bg-tertiary-dim text-on-tertiary text-xs font-bold cursor-pointer transition-colors"
        >
          <span>{meta.cta}</span>
          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
