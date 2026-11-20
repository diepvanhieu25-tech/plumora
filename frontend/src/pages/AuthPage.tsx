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
              <div className="pt-2.5 border-t border-[#F1F5F9] space-y-2 text-[11px]">
                <span className="text-[#57534E] font-medium block">Chuyển cổng đăng nhập:</span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => onSwitchPortal('learner')}
                    className={`min-h-[40px] px-2 py-1.5 rounded-lg border text-center cursor-pointer transition-colors ${
                      portal === 'learner'
                        ? 'bg-[#F0FDF4] text-[#15803D] border-[#86EFAC] font-bold'
                        : 'bg-white text-[#57534E] border-[#D8E2D8] hover:text-[#14241B]'
                    }`}
                  >
                    Học viên
                  </button>
                  <button
                    type="button"
                    onClick={() => onSwitchPortal('expert')}
                    className={`min-h-[40px] px-2 py-1.5 rounded-lg border text-center cursor-pointer transition-colors ${
                      portal === 'expert'
                        ? 'bg-[#EFF6FF] text-[#1D4ED8] border-[#93C5FD] font-bold'
                        : 'bg-white text-[#57534E] border-[#D8E2D8] hover:text-[#14241B]'
                    }`}
                  >
                    Chuyên gia
                  </button>
                  <button
                    type="button"
                    onClick={() => onSwitchPortal('admin')}
                    className={`min-h-[40px] px-2 py-1.5 rounded-lg border text-center cursor-pointer transition-colors ${
                      portal === 'admin'
                        ? 'bg-[#FFFBEB] text-[#B45309] border-[#F59E0B] font-bold'
                        : 'bg-white text-[#57534E] border-[#D8E2D8] hover:text-[#14241B]'
                    }`}
                  >
                    Quản trị
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Interactive Seeded Demo Accounts & Runtime Status (Stitch SCR-01) */}
        <div className="lg:col-span-6 bg-[#F6F8F5] p-8 md:p-10 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="p-1.5 rounded-lg bg-white text-[#15803D] border border-[#D8E2D8]">
                <Layers className="w-4 h-4 text-[#15803D]" aria-hidden="true" />
              </span>
              <h2 className="text-base font-extrabold text-[#14241B]">
                {portal === 'admin'
                  ? 'Tài khoản Quản trị Mẫu (Seeded)'
                  : portal === 'expert'
                    ? 'Tài khoản Chuyên gia Mẫu (Seeded)'
                    : 'Tài khoản Học viên Mẫu (Seeded trong PostgreSQL)'}
              </h2>
            </div>
            <p className="text-xs text-[#3F5247] font-normal leading-relaxed mb-4">
              {portal === 'learner'
                ? 'Chọn nhanh 1 trong 3 tài khoản học viên thật (đi qua luồng xác thực & lưu trữ thật 100%, không dùng bypass) để kiểm thử GNN-PPO & đánh giá 5 tầng:'
                : 'Chọn nhanh tài khoản nội bộ mẫu để điền vào form đăng nhập (xác thực Argon2id + HttpOnly Cookie thật 100%):'}
            </p>

            {portal === 'learner' ? (
              <div className="space-y-3">
                {[
                  {
                    username: 'learner_new',
                    badge: 'Học viên Mới bắt đầu',
                    progress: '0/12 khái niệm Backend • Phù hợp test Adaptive Placement',
                    hint: 'Tầng 1 mở khóa sẵn (net-internet, os-basics)',
                    tone: 'bg-[#F6F8F5] text-[#3F5247] border-[#D8E2D8]',
                  },
                  {
                    username: 'learner_foundation',
                    badge: 'Đã hoàn thành Nền tảng',
                    progress: '4/12 khái niệm Backend • Liên thông Frontend & DevOps',
                    hint: 'GNN-PPO đề xuất: db-transactions (Đào sâu 5 tầng)',
                    tone: 'bg-[#FFFBEB] text-[#92400E] border-[#FCD34D]',
                  },
                  {
                    username: 'learner_api_stage',
                    badge: 'Đang học Tầng 3 API',
                    progress: '7/12 khái niệm Backend • Mở khóa nhiều node nâng cao',
                    hint: 'Sẵn sàng thử thách Code Sandbox & Ebbinghaus Review',
                    tone: 'bg-[#F0FDFA] text-[#115E59] border-[#99F6E4]',
                  },
                ].map((acc) => {
                  const selected = usernameInput === acc.username
                  return (
                    <button
                      key={acc.username}
                      type="button"
                      onClick={() => {
                        setAuthMode('login')
                        setUsernameInput(acc.username)
                        setPasswordInput('PlumoraDemo#2026')
                      }}
                      className={`w-full text-left rounded-xl p-3.5 border transition-all cursor-pointer space-y-1.5 ${
                        selected
                          ? 'bg-white border-2 border-[#15803D] shadow-sm'
                          : 'bg-white border-[#D8E2D8] hover:border-[#15803D]/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono font-bold text-xs text-[#14241B]">
                            {acc.username}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F1F5F1] text-[#3F5247]">
                            {acc.badge}
                          </span>
                        </div>
                        <span
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            selected ? 'border-[#15803D]' : 'border-[#ACB4AF]'
                          }`}
                        >
                          {selected && <span className="w-2 h-2 rounded-full bg-[#15803D]" />}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#3F5247]">{acc.progress}</p>
                      <div className={`text-[11px] px-2.5 py-1 rounded-lg border ${acc.tone}`}>
                        {acc.hint}
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    setUsernameInput(portal === 'admin' ? 'admin_demo' : 'expert_demo')
                    setPasswordInput('PlumoraDemo#2026')
                  }}
                  className={`w-full text-left rounded-xl p-4 border transition-all cursor-pointer space-y-1.5 ${
                    usernameInput === (portal === 'admin' ? 'admin_demo' : 'expert_demo')
                      ? 'bg-white border-2 border-[#15803D] shadow-sm'
                      : 'bg-white border-[#D8E2D8] hover:border-[#15803D]/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-xs text-[#14241B]">
                      {portal === 'admin' ? 'admin_demo' : 'expert_demo'}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#DCFCE7] text-[#14532D]">
                      Bấm để điền vào form
                    </span>
                  </div>
                  <p className="text-xs text-[#3F5247]">
                    {portal === 'admin'
                      ? 'Quản trị Safe Micro-batch Online RL, Safety Evaluation Gate, 1-Click Rollback & Cụm 4 Microservices.'
                      : 'Quản trị Knowledge Graph đa ngành (Kahn DAG), Ngân hàng Đề 5 Tầng & Rubric, Code Challenge Sandbox.'}
                  </p>
                </button>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div className="bg-white p-3 rounded-xl border border-[#D8E2D8] space-y-1">
                    <div className="flex items-center gap-1.5 text-[#15803D] font-bold">
                      <Cpu className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>GNN-PPO + Guardrail</span>
                    </div>
                    <p className="text-[11px] text-[#57534E] leading-snug">
                      Suy luận đồ thị 3 lớp và bảo toàn Zero-shot giữa 3 ngành.
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-[#D8E2D8] space-y-1">
                    <div className="flex items-center gap-1.5 text-[#0D9488] font-bold">
                      <Compass className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>4 Schema Cô lập</span>
                    </div>
                    <p className="text-[11px] text-[#57534E] leading-snug">
                      auth_svc • content_svc • assess_svc • rec_ai_svc.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Backend Runtime Verification */}
          <div className="mt-6 border border-[#BBF7D0] bg-[#F0FDF4] rounded-xl p-3.5 flex items-start gap-2.5 shadow-2xs">
            <Database className="w-4 h-4 text-[#15803D] shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-xs text-[#14532D] leading-relaxed">
              <span className="font-bold">Runtime Đang Chạy:</span> PostgreSQL 16 (SSoT) • Redis 7 State Cache • GNN-PPO Checkpoint Verified.
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
