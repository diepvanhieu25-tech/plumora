import { ArrowLeft, Lock } from 'lucide-react'

interface LockedAlertProps {
  lockedErrorInfo: {
    slug: string
    message: string
    missingPrerequisites: string[]
  } | null
  onBackToRoadmap: () => void
}

export function LockedAlert({
  lockedErrorInfo,
  onBackToRoadmap,
}: LockedAlertProps) {
  if (!lockedErrorInfo) return null

  return (
    <section
      role="alert"
      aria-label="SCR-08 Cảnh báo Khái niệm Đang Khóa"
      className="plumora-card border-2 border-[#FDA4AF] bg-[#FFF1F2] text-[#9F1239] space-y-3 shadow-xs"
      data-testid="scr08-locked-view"
    >
      <div className="flex items-center gap-2">
        <Lock className="w-5 h-5" aria-hidden="true" />
        <h2 className="text-lg font-bold">
          403 CONCEPT_LOCKED — Khái niệm &ldquo;{lockedErrorInfo.slug}&rdquo; đang khóa
        </h2>
      </div>
      <p className="text-sm">{lockedErrorInfo.message}</p>
      {lockedErrorInfo.missingPrerequisites.length > 0 ? (
        <p className="text-xs font-mono font-semibold">
          Các bài tiên quyết cần đạt &gt;= 75% trước:{' '}
          {lockedErrorInfo.missingPrerequisites.join(', ')}
        </p>
      ) : null}
      <button
        type="button"
        onClick={onBackToRoadmap}
        className="plumora-btn-outline text-xs"
        data-testid="back-to-roadmap-btn"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        <span>Quay về Bản đồ &amp; Học bài tiên quyết</span>
      </button>
    </section>
  )
}
