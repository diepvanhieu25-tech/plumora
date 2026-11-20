import { useState } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  Compass,
  Cpu,
  Database,
  Eye,
  EyeOff,
  Layers,
  Lock,
  ShieldCheck,
  User,
} from 'lucide-react'
import type { PortalKind } from '../types'

interface AuthPageProps {
  portal?: PortalKind
  onSwitchPortal?: (portal: PortalKind) => void
  authMode: 'login' | 'register'
  setAuthMode: (mode: 'login' | 'register') => void
  usernameInput: string
  setUsernameInput: (val: string) => void
  displayNameInput: string
  setDisplayNameInput: (val: string) => void
  passwordInput: string
  setPasswordInput: (val: string) => void
  authError: string | null
  isLoading: boolean
  onSubmit: (e: React.FormEvent) => Promise<void>
}

const PHASE3_DOMAINS_OVERVIEW = [
  {
    title: 'Backend Engineering',
    count: '12 khái niệm',
    summary: 'Mạng, OS, HTTP, SQL/ACID, NoSQL, REST API, Redis & Bảo mật JWT/API',
    color: 'border-l-[#15803D]',
  },
  {
    title: 'Frontend Engineering',
    count: '10 khái niệm',
    summary: 'HTML/DOM, CSS Layout, JS Async, React State, Auth & Performance',
    color: 'border-l-[#0D9488]',
  },
  {
    title: 'DevOps & Cloud',
    count: '9 khái niệm',
    summary: 'Linux/Networking, Docker, CI/CD, Kubernetes, Observability & Security',
    color: 'border-l-[#D97706]',
  },
]

export function AuthPage({
  portal = 'learner',
  onSwitchPortal,
  authMode,
  setAuthMode,
  usernameInput,
  setUsernameInput,
  displayNameInput,
  setDisplayNameInput,
  passwordInput,
  setPasswordInput,
  authError,
  isLoading,
  onSubmit,
}: AuthPageProps) {
  const [showPassword, setShowPassword] = useState(false)
  const isStaffPortal = portal === 'admin' || portal === 'expert'
  const effectiveMode = isStaffPortal ? 'login' : authMode

  const portalBadge =
    portal === 'admin'
      ? 'ADMIN PORTAL • QUẢN TRỊ HỆ THỐNG & ONLINE RL'
      : portal === 'expert'
        ? 'EXPERT PORTAL • BIÊN SOẠN KNOWLEDGE GRAPH & RUBRIC'
        : 'PL-AUTH-01 • CỔNG HỌC VIÊN THÍCH ỨNG'

  const portalHeading =
    portal === 'admin'
      ? 'Đăng nhập Cổng Quản trị'
      : portal === 'expert'
        ? 'Đăng nhập Cổng Chuyên gia'
        : effectiveMode === 'login'
          ? 'Chào mừng trở lại'
          : 'Tạo tài khoản học viên mới'

  const portalSubtitle =
    portal === 'admin'
      ? 'Khu vực dành riêng cho Quản trị viên vận hành Safe Online RL, Safety Gate và cụm Microservices.'
      : portal === 'expert'
        ? 'Khu vực dành riêng cho Chuyên gia thiết kế đồ thị DAG, câu hỏi 5 tầng và Code Sandbox.'
        : effectiveMode === 'login'
          ? 'Đăng nhập để tiếp tục lộ trình đa ngành với mô hình GNN-PPO.'
          : 'Đăng ký tài khoản học viên để bắt đầu chẩn đoán năng lực và lộ trình cá nhân hóa.'

  return (
    <main
      aria-label="SCR-01 Đăng nhập"
      className="w-full max-w-5xl mx-auto my-6 bg-white rounded-2xl border border-[#D8E2D8] shadow-sm overflow-hidden"
      data-testid="scr01-auth-section"
      data-portal={portal}
    >
      <div className="grid grid-cols-1 lg:grid-cols-12">
        {/* Left Column: Standard Authentication Form (PL-AUTH-01) */}
        <div className="lg:col-span-6 p-8 md:p-10 flex flex-col justify-between bg-white border-b lg:border-b-0 lg:border-r border-[#D8E2D8]">
          <div>
            {/* Header Sub-cluster with Plumora Brand Logo */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#F0FDF4] border border-[#16A34A] flex items-center justify-center shadow-2xs overflow-hidden p-1 shrink-0">
                <img
                  src="/Logo_Secondary.webp"
                  alt="Plumora Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="p-0.5 rounded bg-[#F0FDF4] text-[#15803D]">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#15803D]" aria-hidden="true" />
                  </span>
                  <span className="text-[11px] font-mono font-bold text-[#15803D] uppercase tracking-wider">
                    {portalBadge}
                  </span>
                </div>
                <span className="text-xs text-[#57534E] font-medium block">
                  Nền tảng Học thích ứng Đa ngành &amp; Đánh giá 5 tầng
                </span>
              </div>
            </div>

            <h1 className="text-2xl md:text-3xl font-extrabold text-[#14241B] tracking-tight">
              {portalHeading}
            </h1>
            <p className="text-sm text-[#3F5247] mt-1.5 font-normal leading-relaxed">
              {portalSubtitle}
            </p>

            {/* Segmented Toggle Tab — ONLY on Learner Portal */}
            {!isStaffPortal ? (
              <div className="mt-6 p-1 bg-[#F6F8F5] rounded-xl border border-[#D8E2D8] flex items-center">
                <button
                  type="button"
                  onClick={() => setAuthMode('login')}
                  className={`flex-1 py-2 px-3 text-xs sm:text-sm font-semibold rounded-lg text-center transition-all cursor-pointer ${
                    effectiveMode === 'login'
                      ? 'bg-[#15803D] text-white shadow-xs'
                      : 'text-[#3F5247] hover:text-[#14241B]'
                  }`}
                  data-testid="tab-login-btn"
                >
                  Đăng nhập
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('register')}
                  className={`flex-1 py-2 px-3 text-xs sm:text-sm font-semibold rounded-lg text-center transition-all cursor-pointer ${
                    effectiveMode === 'register'
                      ? 'bg-[#15803D] text-white shadow-xs'
                      : 'text-[#3F5247] hover:text-[#14241B]'
                  }`}
                  data-testid="tab-register-btn"
                >
                  Đăng ký học viên mới
                </button>
              </div>
            ) : (
              <div
                className="mt-5 p-3 rounded-xl bg-[#FFFBEB] border border-[#F59E0B] text-xs text-[#92400E] font-medium"
                data-testid="staff-portal-notice"
              >
                Cổng nội bộ không hỗ trợ tự đăng ký tài khoản. Hệ thống từ chối đăng nhập sai vai trò với mã HTTP 403.
              </div>
            )}

            {/* Auth Error Banner */}
            {authError ? (
              <div
                role="alert"
                className="mt-4 p-3 rounded-lg bg-[#FFF1F2] border border-[#FDA4AF] text-xs font-medium text-[#9F1239]"
                data-testid="auth-error-banner"
              >
                {authError}
              </div>
            ) : null}

            {/* Auth Form Fields */}
            <form onSubmit={onSubmit} className="mt-5 space-y-4">
              {/* Username Field */}
              <div>
                <label
                  htmlFor="auth-username"
                  className="block text-xs font-semibold text-[#14241B] mb-1.5"
                >
                  Tên đăng nhập (Username)
                </label>
                <div className="relative rounded-lg">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                    <User className="w-4 h-4 text-[#57534E]" aria-hidden="true" />
                  </div>
                  <input
                    id="auth-username"
                    name="username"
                    type="text"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    placeholder="ví dụ: learner_alex"
                    className="block w-full rounded-lg border border-[#D8E2D8] bg-[#F6F8F5] pl-10 pr-3.5 py-2.5 text-sm font-mono text-[#14241B] placeholder:text-[#57534E] focus:border-[#15803D] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#15803D]/20 transition-all"
                    required
                    data-testid="input-username"
                  />
                </div>
              </div>

              {/* Display Name Field (Register Mode) */}
              {effectiveMode === 'register' ? (
                <div>
                  <label
                    htmlFor="auth-display-name"
                    className="block text-xs font-semibold text-[#14241B] mb-1.5"
                  >
                    Tên hiển thị (Display Name)
                  </label>
                  <input
                    id="auth-display-name"
                    type="text"
                    value={displayNameInput}
                    onChange={(e) => setDisplayNameInput(e.target.value)}
                    placeholder="ví dụ: Alex Nguyễn"
                    className="block w-full rounded-lg border border-[#D8E2D8] bg-[#F6F8F5] px-3.5 py-2.5 text-sm text-[#14241B] focus:border-[#15803D] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#15803D]/20 transition-all"
                    required
                    data-testid="input-display-name"
                  />
                </div>
              ) : null}

              {/* Password Field */}
              <div>
                <label
                  htmlFor="auth-password"
                  className="block text-xs font-semibold text-[#14241B] mb-1.5"
                >
                  Mật khẩu (Password)
                </label>
                <div className="relative rounded-lg">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                    <Lock className="w-4 h-4 text-[#57534E]" aria-hidden="true" />
                  </div>
                  <input
                    id="auth-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Nhập mật khẩu an toàn"
                    className="block w-full rounded-lg border border-[#D8E2D8] bg-[#F6F8F5] pl-10 pr-10 py-2.5 text-sm font-mono text-[#14241B] placeholder:text-[#57534E] focus:border-[#15803D] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#15803D]/20 transition-all"
                    required
                    data-testid="input-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-[#57534E] hover:text-[#14241B] transition-colors cursor-pointer"
                    title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" aria-hidden="true" />
                    ) : (
                      <Eye className="w-4 h-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
                <p className="mt-1.5 text-[11px] text-[#3F5247] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D]" aria-hidden="true" />
                  <span>Băm bảo mật bằng Argon2id, phiên lưu trữ HttpOnly Cookie an toàn.</span>
                </p>
              </div>

              {/* Submit CTA Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 bg-[#15803D] hover:bg-[#166534] disabled:bg-[#D8E2D8] disabled:text-[#57534E] text-white font-bold h-11 rounded-lg flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                data-testid="login-submit-btn"
              >
                <span>
                  {isLoading
                    ? 'Đang xử lý...'
                    : effectiveMode === 'login'
                    ? portal === 'admin'
                      ? 'Đăng nhập Cổng Quản trị'
                      : portal === 'expert'
                        ? 'Đăng nhập Cổng Chuyên gia'
                        : 'Đăng nhập vào Lộ trình Học'
                    : 'Tạo tài khoản & Bắt đầu Lộ trình'}
                </span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </form>
          </div>

          {/* Security Badge & Portal Switcher at Card Footing */}
          <div className="mt-8 pt-4 border-t border-[#D8E2D8] space-y-3 text-xs text-[#3F5247]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#15803D]" aria-hidden="true" />
                <span className="font-medium">Chuẩn xác thực D-11 • Session HttpOnly</span>
              </div>
              <span className="font-mono text-[#57534E] text-[11px]">
                Chống CSRF &amp; Replay
              </span>
            </div>
            {onSwitchPortal && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#F1F5F9] text-[11px]">
                <span className="text-[#57534E] font-medium">Chuyển cổng:</span>
                <button
                  type="button"
                  onClick={() => onSwitchPortal('learner')}
                  className={`min-h-[44px] px-3 py-2 rounded-lg border cursor-pointer ${
                    portal === 'learner'
                      ? 'bg-[#F0FDF4] text-[#15803D] border-[#86EFAC] font-bold'
                      : 'bg-white text-[#57534E] border-[#D8E2D8] hover:text-[#14241B]'
                  }`}
                >
                  Học viên (/)
                </button>
                <button
                  type="button"
                  onClick={() => onSwitchPortal('expert')}
                  className={`min-h-[44px] px-3 py-2 rounded-lg border cursor-pointer ${
                    portal === 'expert'
                      ? 'bg-[#EFF6FF] text-[#1D4ED8] border-[#93C5FD] font-bold'
                      : 'bg-white text-[#57534E] border-[#D8E2D8] hover:text-[#14241B]'
                  }`}
                >
                  Chuyên gia (/expert/login)
                </button>
                <button
                  type="button"
                  onClick={() => onSwitchPortal('admin')}
                  className={`min-h-[44px] px-3 py-2 rounded-lg border cursor-pointer ${
                    portal === 'admin'
                      ? 'bg-[#FFFBEB] text-[#B45309] border-[#F59E0B] font-bold'
                      : 'bg-white text-[#57534E] border-[#D8E2D8] hover:text-[#14241B]'
                  }`}
                >
                  Quản trị (/admin/login)
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Pedagogical Overview of 12 Backend Concepts & DQN Engine */}
        <div className="lg:col-span-6 bg-[#F6F8F5] p-8 md:p-10 flex flex-col justify-between">
          <div>
            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
              <span className="p-1.5 rounded-lg bg-white text-[#15803D] border border-[#D8E2D8]">
                <Layers className="w-4 h-4 text-[#15803D]" aria-hidden="true" />
              </span>
              <h2 className="text-base font-extrabold text-[#14241B]">
                Đồ thị Tri thức Đa ngành &amp; Trí tuệ GNN-PPO
              </h2>
            </div>
            <p className="text-xs text-[#3F5247] font-normal leading-relaxed mb-4">
              Hệ thống đánh giá năng lực 5 tầng, chấm Code Sandbox cô lập và đồng bộ trí nhớ Ebbinghaus qua 3 lĩnh vực liên thông (7 khái niệm giao thoa):
            </p>

            {/* 3 Domain Overview Cards */}
            <div className="space-y-2.5">
              {PHASE3_DOMAINS_OVERVIEW.map((domain) => (
                <div
                  key={domain.title}
                  className={`bg-white rounded-xl p-3 border border-[#D8E2D8] border-l-4 ${domain.color} shadow-2xs space-y-1`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-[#14241B]">{domain.title}</span>
                    <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-[#F6F8F5] text-[#57534E] border border-[#D8E2D8]">
                      {domain.count}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#57534E] leading-snug">{domain.summary}</p>
                </div>
              ))}
            </div>

            {/* Pedagogical Feature Callouts */}
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="bg-white p-2.5 rounded-lg border border-[#D8E2D8] space-y-1">
                <div className="flex items-center gap-1 text-[#15803D] font-bold">
                  <Cpu className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>GNN-PPO + Guardrail</span>
                </div>
                <p className="text-[11px] text-[#57534E] leading-snug">
                  Mạng GNN-PPO 3 lớp gợi ý khái niệm tối ưu và bảo toàn Zero-shot giữa các ngành.
                </p>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-[#D8E2D8] space-y-1">
                <div className="flex items-center gap-1 text-[#0D9488] font-bold">
                  <Compass className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Đánh giá 5 tầng &amp; Sandbox</span>
                </div>
                <p className="text-[11px] text-[#57534E] leading-snug">
                  Kiểm tra từ Nhận biết đến Kiến trúc, chấm Rubric AI &amp; Code Sandbox cô lập.
                </p>
              </div>
            </div>

            {/* Role Access Summary */}
            <div className="mt-4 bg-white rounded-xl border border-[#D8E2D8] p-3 text-xs space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-[#14241B]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#15803D]" aria-hidden="true" />
                <span>Điều hướng Phân quyền Tự động (RBAC)</span>
              </div>
              <p className="text-[11px] text-[#57534E] leading-relaxed">
                Hệ thống tự động định tuyến theo vai trò tài khoản sau khi xác thực: Học viên (Lộ trình &amp; Đánh giá), Chuyên gia (Quản trị KG &amp; Rubric), hoặc Quản trị (Safe Online RL &amp; Cụm dịch vụ).
              </p>
            </div>
          </div>

          {/* Bottom Backend Runtime Verification */}
          <div className="mt-6 border border-[#BBF7D0] bg-white rounded-xl p-3 flex items-start gap-2.5 shadow-2xs">
            <Database className="w-4 h-4 text-[#15803D] shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-xs text-[#14532D] font-mono leading-relaxed">
              <span className="font-bold">Hệ thống Lưu trữ &amp; Trạng thái:</span> PostgreSQL 16 ACID SSoT • Redis 7 Cache • Độc lập trên từng tài khoản học viên.
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
