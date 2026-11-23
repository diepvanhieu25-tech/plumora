import { Award, Layers, Lock, ShieldCheck, Wrench } from 'lucide-react'

export interface DepthMeta {
  label: string
  shortLabel: string
  bgClass: string
  barClass: string
  Icon: typeof Award
}

export function getDepthMeta(depthNorm: number, isEligible: boolean = true): DepthMeta {
  if (depthNorm >= 1.0) {
    return {
      label: 'Làm chủ (100%)',
      shortLabel: 'Làm chủ',
      bgClass: 'bg-primary-container text-on-primary-container border border-primary/25',
      barClass: 'bg-primary',
      Icon: Award,
    }
  }
  if (depthNorm >= 0.75) {
    return {
      label: 'Hiểu bản chất (75%)',
      shortLabel: 'Hiểu bản chất',
      bgClass: 'bg-primary-container/60 text-on-primary-fixed-variant border border-primary/20',
      barClass: 'bg-primary',
      Icon: ShieldCheck,
    }
  }
  if (depthNorm >= 0.5) {
    return {
      label: 'Biết áp dụng (50%)',
      shortLabel: 'Biết áp dụng',
      bgClass: 'bg-secondary-container text-on-secondary-container border border-secondary/20',
      barClass: 'bg-secondary',
      Icon: Wrench,
    }
  }
  if (depthNorm >= 0.25) {
    return {
      label: 'Nắm khái niệm (25%)',
      shortLabel: 'Nắm khái niệm',
      bgClass: 'bg-surface-container text-on-surface-variant border border-outline-variant/60',
      barClass: 'bg-outline',
      Icon: Layers,
    }
  }
  return {
    label: isEligible ? 'Sẵn sàng học' : 'Chưa mở khóa',
    shortLabel: isEligible ? 'Mới mở' : 'Đang khóa',
    bgClass: 'bg-surface-container text-on-surface-variant border border-outline-variant/50',
    barClass: 'bg-outline-variant',
    Icon: isEligible ? Layers : Lock,
  }
}

interface DepthBadgeProps {
  depthNorm: number
  isEligible?: boolean
  compact?: boolean
  className?: string
}

export function DepthBadge({
  depthNorm,
  isEligible = true,
  compact = false,
  className = '',
}: DepthBadgeProps) {
  const meta = getDepthMeta(depthNorm, isEligible)
  const Icon = meta.Icon
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${meta.bgClass} ${className}`}
    >
      <Icon className="w-3 h-3 shrink-0" aria-hidden="true" />
      <span>{compact ? meta.shortLabel : meta.label}</span>
    </span>
  )
}
