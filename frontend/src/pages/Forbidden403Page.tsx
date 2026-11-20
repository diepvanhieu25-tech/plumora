import { ArrowLeft, ShieldAlert } from 'lucide-react'
import type { LearnerUser, PortalKind } from '../types'

interface Forbidden403PageProps {
  userRole: LearnerUser['role']
  attemptedPortal: PortalKind
  onReturnToPortal: () => void
}

export function Forbidden403Page({
  userRole,
  attemptedPortal,
  onReturnToPortal,
}: Forbidden403PageProps) {
  const portalName =
    attemptedPortal === 'admin'
      ? 'Cổng Quản trị (Admin)'
      : attemptedPortal === 'expert'
        ? 'Cổng Chuyên gia (Expert)'
        : 'Cổng Học viên (Learner)'

  const roleName =
    userRole === 'admin' ? 'Admin' : userRole === 'expert' ? 'Chuyên gia' : 'Học viên'

  return (
    <section
      className="max-w-xl mx-auto my-12 bg-white rounded-2xl border border-[#FDA4AF] p-8 shadow-sm text-center space-y-5"
      data-testid="forbidden-403-page"
      role="alert"
    >
      <div className="w-14 h-14 rounded-2xl bg-[#FFF1F2] border border-[#FDA4AF] flex items-center justify-center mx-auto text-[#9F1239]">
        <ShieldAlert className="w-7 h-7" aria-hidden="true" />
      </div>

      <div className="space-y-2">
        <span className="inline-block text-xs font-mono font-bold px-3 py-1 rounded-full bg-[#FFF1F2] text-[#9F1239] border border-[#FDA4AF]">
          HTTP 403 • FORBIDDEN_ROLE
        </span>
        <h1 className="text-2xl font-extrabold text-[#14241B]">
          Không có quyền truy cập khu vực này
        </h1>
        <p className="text-sm text-[#3F5247] leading-relaxed">
          Tài khoản hiện tại có vai trò <strong>{roleName}</strong> nên không được phép truy cập{' '}
          <strong>{portalName}</strong>. Hệ thống phân tách nghiêm ngặt các cổng theo quy tắc RBAC.
        </p>
      </div>

      <button
        type="button"
        onClick={onReturnToPortal}
        className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#15803D] hover:bg-[#166534] text-white text-sm font-bold cursor-pointer transition-colors"
        data-testid="return-to-own-portal-btn"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        Quay về Cổng của tôi
      </button>
    </section>
  )
}
