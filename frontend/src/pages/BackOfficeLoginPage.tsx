import { useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  ShieldCheck,
  Sprout,
  User,
} from 'lucide-react'

export interface BackOfficeLoginPageProps {
  usernameInput: string
  setUsernameInput: (val: string) => void
  passwordInput: string
  setPasswordInput: (val: string) => void
  authError: string | null
  isLoading: boolean
  onSubmit: (e: React.FormEvent) => Promise<void>
  portalHint?: 'admin' | 'expert'
}

export function BackOfficeLoginPage({
  usernameInput,
  setUsernameInput,
  passwordInput,
  setPasswordInput,
  authError,
  isLoading,
  onSubmit,
  portalHint = 'admin',
}: BackOfficeLoginPageProps) {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div
      className="min-h-screen bg-[#F6F8F5] text-[#14241B] flex items-center justify-center p-4 sm:p-6"
      data-testid="backoffice-login-page"
    >
      <div className="w-full max-w-md bg-white rounded-2xl border border-[#D8E2D8] shadow-sm overflow-hidden">
        <div className="p-7 sm:p-8 space-y-6">
          {/* Header Brand */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#F0FDF4] border border-[#16A34A] flex items-center justify-center text-[#15803D] shrink-0">
                <Sprout className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#15803D] block">
                  Plumora Back-Office Console
                </span>
                <span className="text-xs text-[#57534E]">
                  {portalHint === 'expert'
                    ? 'Không gian Biên soạn Học liệu & Đồ thị Tri thức'
                    : 'Hệ thống Quản trị Nội dung, Học viên & MLOps'}
                </span>
              </div>
            </div>

            <div>
              <h1 className="text-2xl font-extrabold text-[#14241B] tracking-tight">
                Đăng nhập Nhân sự Nội bộ
              </h1>
              <p className="text-xs text-[#3F5247] mt-1 leading-relaxed">
                Sử dụng tài khoản Chuyên gia Nội dung hoặc Quản trị viên đã được cấp quyền để truy cập bảng điều khiển.
              </p>
            </div>
          </div>

          {/* Audit Security Notice */}
          <div
            className="p-3 rounded-xl bg-[#FFFBEB] border border-[#F59E0B] text-xs text-[#78350F] flex items-start gap-2.5"
            data-testid="staff-portal-notice"
          >
            <ShieldCheck className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              Khu vực nội bộ áp dụng kiểm soát vai trò nghiêm ngặt (RBAC). Mọi phiên đăng nhập và thao tác thay đổi đều được ghi nhật ký kiểm toán.
            </span>
          </div>

          {authError && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-[#FFF1F2] border border-[#FDA4AF] text-xs font-semibold text-[#9F1239] flex items-start gap-2"
              data-testid="auth-error-banner"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{authError}</span>
            </div>
          )}

          {/* Staff Credentials Form (ZERO demo quick-fill buttons, ZERO public register tab) */}
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="backoffice-username"
                className="block text-xs font-semibold text-[#14241B] mb-1.5"
              >
                Tên đăng nhập nhân sự
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                  <User className="w-4 h-4 text-[#57534E]" aria-hidden="true" />
                </div>
                <input
                  id="backoffice-username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="Nhập tên đăng nhập"
                  required
                  data-testid="input-username"
                  className="block w-full rounded-lg border border-[#D8E2D8] bg-[#F6F8F5] pl-10 pr-3.5 py-2.5 text-sm text-[#14241B] placeholder:text-[#57534E] focus:border-[#15803D] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#15803D]/20"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="backoffice-password"
                className="block text-xs font-semibold text-[#14241B] mb-1.5"
              >
                Mật khẩu
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                  <Lock className="w-4 h-4 text-[#57534E]" aria-hidden="true" />
                </div>
                <input
                  id="backoffice-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Nhập mật khẩu"
                  required
                  data-testid="input-password"
                  className="block w-full rounded-lg border border-[#D8E2D8] bg-[#F6F8F5] pl-10 pr-10 py-2.5 text-sm text-[#14241B] placeholder:text-[#57534E] focus:border-[#15803D] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#15803D]/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-[#57534E] hover:text-[#14241B] cursor-pointer"
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Eye className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              data-testid="login-submit-btn"
              className="w-full h-11 rounded-lg bg-[#15803D] hover:bg-[#166534] disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
            >
              <span>{isLoading ? 'Đang xác thực...' : 'Đăng nhập Back-Office'}</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </form>
        </div>

        <div className="px-7 py-3.5 bg-[#F6F8F5] border-t border-[#D8E2D8] flex items-center justify-between text-[11px] text-[#57534E]">
          <span>Phiên xác thực HTTP-Only Cookie</span>
          <span className="font-mono">RBAC: Expert / Admin</span>
        </div>
      </div>
    </div>
  )
}
