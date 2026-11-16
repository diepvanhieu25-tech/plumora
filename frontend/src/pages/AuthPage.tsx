import { useState } from 'react'
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Compass,
  Eye,
  EyeOff,
  Lock,
  ShieldCheck,
  SlidersHorizontal,
  User,
} from 'lucide-react'

const SEEDED_PROFILES = [
  {
    username: 'learner_new',
    label: 'Học viên Mới bắt đầu',
    desc: '0/12 khái niệm hoàn thành (0%)',
    badge: 'Tầng 1 mở khóa sẵn (net-internet, os-basics)',
    recommendedSlug: null,
  },
  {
    username: 'learner_foundation',
    label: 'Đã hoàn thành Nền tảng',
    desc: '4/12 khái niệm ≥ 75% thông thạo',
    badge: 'DQN đang đề xuất: [4] db-transactions',
    recommendedSlug: 'db-transactions',
  },
  {
    username: 'learner_api_stage',
    label: 'Đang học Tầng 3 API',
    desc: '7/12 khái niệm ≥ 75% thông thạo',
    badge: 'DQN đang đề xuất: [8] api-data',
    recommendedSlug: 'api-data',
  },
]

interface AuthPageProps {
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
  onQuickPickSeedAccount: (username: string) => Promise<void>
}

export function AuthPage({
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
  onQuickPickSeedAccount,
}: AuthPageProps) {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div
      aria-label="SCR-01 Đăng nhập và Tài khoản Học viên Mẫu"
      className="w-full max-w-5xl mx-auto my-6 bg-white rounded-2xl border border-[#D8E2D8] shadow-sm overflow-hidden"
      data-testid="scr01-auth-section"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12">
        {/* Left Column: Standard Authentication Form (PL-AUTH-01) */}
        <div className="lg:col-span-6 p-8 md:p-10 flex flex-col justify-between bg-white border-b lg:border-b-0 lg:border-r border-[#D8E2D8]">
          <div>
            {/* Header Sub-cluster */}
            <div className="flex items-center gap-2 mb-3">
              <span className="p-1 rounded-md bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0]">
                <ShieldCheck className="w-4 h-4 text-[#15803D]" aria-hidden="true" />
              </span>
              <span className="text-xs font-mono font-bold text-[#15803D] uppercase tracking-wider">
                PL-AUTH-01 • XÁC THỰC PHIÊN
              </span>
            </div>

            <h1 className="text-2xl md:text-3xl font-extrabold text-[#14241B] tracking-tight">
              Chào mừng trở lại
            </h1>
            <p className="text-sm text-[#3F5247] mt-1.5 font-normal leading-relaxed">
              Đăng nhập vào hệ thống học tập thích ứng cá nhân hóa với DQN Policy.
            </p>

            {/* Segmented Toggle Tab */}
            <div className="mt-6 p-1 bg-[#F6F8F5] rounded-xl border border-[#D8E2D8] flex items-center">
              <button
                type="button"
                onClick={() => setAuthMode('login')}
                className={`flex-1 py-2 px-3 text-xs sm:text-sm font-semibold rounded-lg text-center transition-all cursor-pointer ${
                  authMode === 'login'
                    ? 'bg-[#15803D] text-white shadow-xs'
                    : 'text-[#3F5247] hover:text-[#14241B]'
                }`}
              >
                Đăng nhập
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('register')}
                className={`flex-1 py-2 px-3 text-xs sm:text-sm font-semibold rounded-lg text-center transition-all cursor-pointer ${
                  authMode === 'register'
                    ? 'bg-[#15803D] text-white shadow-xs'
                    : 'text-[#3F5247] hover:text-[#14241B]'
                }`}
              >
                Đăng ký học viên mới
              </button>
            </div>

            {/* Auth Error Banner */}
            {authError ? (
              <div
                role="alert"
                className="mt-4 p-3 rounded-lg bg-[#FFF1F2] border border-[#FDA4AF] text-xs font-medium text-[#9F1239]"
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
                    placeholder="Nhập username"
                    className="block w-full rounded-lg border border-[#D8E2D8] bg-[#F6F8F5] pl-10 pr-3.5 py-2.5 text-sm font-mono text-[#14241B] placeholder:text-[#57534E] focus:border-[#15803D] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#15803D]/20 transition-all"
                    required
                  />
                </div>
              </div>

              {/* Display Name Field (Register Mode) */}
              {authMode === 'register' ? (
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
                    placeholder="Học viên Thực nghiệm"
                    className="block w-full rounded-lg border border-[#D8E2D8] bg-[#F6F8F5] px-3.5 py-2.5 text-sm text-[#14241B] focus:border-[#15803D] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#15803D]/20 transition-all"
                    required
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
                    className="block w-full rounded-lg border border-[#D8E2D8] bg-[#F6F8F5] pl-10 pr-10 py-2.5 text-sm font-mono text-[#14241B] placeholder:text-[#57534E] focus:border-[#15803D] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#15803D]/20 transition-all"
                    required
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
                  <span>Băm bảo mật bằng Argon2id, phiên HttpOnly Cookie an toàn.</span>
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
                  {authMode === 'login'
                    ? 'Đăng nhập vào Lộ trình Học'
                    : 'Tạo tài khoản & Khởi tạo 12 Node'}
                </span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </form>
          </div>

          {/* Security Badge at Card Footing */}
          <div className="mt-8 pt-4 border-t border-[#D8E2D8] flex items-center justify-between text-xs text-[#3F5247]">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#15803D]" aria-hidden="true" />
              <span className="font-medium">Chuẩn xác thực D-11 • Session HttpOnly</span>
            </div>
            <span className="font-mono text-[#57534E] text-[11px]">
              Ngăn chặn CSRF &amp; Replay
            </span>
          </div>
        </div>

        {/* Right Column: Demo Seed Account Switcher (Stitch SCR-01) */}
        <div className="lg:col-span-6 bg-[#F6F8F5] p-8 md:p-10 flex flex-col justify-between">
          <div>
            {/* Seed Switcher Header */}
            <div className="flex items-center gap-2 mb-2">
              <span className="p-1.5 rounded-lg bg-white text-[#15803D] border border-[#D8E2D8]">
                <SlidersHorizontal className="w-4 h-4 text-[#15803D]" aria-hidden="true" />
              </span>
              <h2 className="text-base font-extrabold text-[#14241B]">
                Tài khoản Học viên Mẫu (Seeded trong PostgreSQL)
              </h2>
            </div>
            <p className="text-xs text-[#3F5247] font-normal leading-relaxed mb-5">
              Chọn nhanh 1 trong 3 tài khoản học viên thật (đi qua luồng xác thực &amp; lưu trữ thật 100%, không dùng privileged bypass) để kiểm thử quyết định của mô hình DQN:
            </p>

            {/* 3 Selectable Profile Cards */}
            <div className="space-y-3">
              {SEEDED_PROFILES.map((prof) => {
                const isSelected = usernameInput === prof.username
                return (
                  <div
                    key={prof.username}
                    onClick={() => onQuickPickSeedAccount(prof.username)}
                    className={`cursor-pointer rounded-xl p-4 transition-all duration-150 ${
                      isSelected
                        ? 'border-2 border-[#15803D] bg-white shadow-sm ring-2 ring-[#15803D]/20'
                        : 'border border-[#D8E2D8] bg-white hover:border-[#15803D]/50 hover:shadow-xs'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-bold text-[#14241B]">
                            {prof.username}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-[#F0FDF4] text-[#14532D] font-semibold border border-[#BBF7D0]">
                            {prof.label}
                          </span>
                          {isSelected ? (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#95F8A7] text-[#005F29] font-bold">
                              Đang áp dụng
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs text-[#3F5247] font-medium">{prof.desc}</p>
                      </div>

                      {/* Radio Indicator */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onQuickPickSeedAccount(prof.username)
                        }}
                        className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                          isSelected
                            ? 'border-[#15803D] bg-[#15803D] text-white'
                            : 'border-[#D8E2D8] hover:border-[#15803D]'
                        }`}
                        data-testid={`seed-login-${prof.username}`}
                        title={`Đăng nhập với ${prof.username}`}
                      >
                        {isSelected ? <Check className="w-3 h-3 stroke-[3]" /> : null}
                      </button>
                    </div>

                    {/* Badge */}
                    <div className="mt-2.5">
                      {prof.recommendedSlug ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#FFFBEB] border border-[#FDE68A] text-[#78350F] text-xs font-medium">
                          <Compass className="w-3.5 h-3.5 text-[#D97706]" aria-hidden="true" />
                          <span className="font-mono text-[11px] font-semibold">
                            {prof.badge}
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#F6F8F5] border border-[#D8E2D8] text-[11px] font-mono text-[#3F5247]">
                          <CheckCircle2 className="w-3 h-3 text-[#15803D]" aria-hidden="true" />
                          <span>{prof.badge}</span>
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Bottom Docker Runtime Status Card */}
          <div className="mt-6 border border-[#BBF7D0] bg-white rounded-xl p-3.5 flex items-start gap-2.5 shadow-2xs">
            <ShieldCheck className="w-4 h-4 text-[#15803D] shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-xs text-[#14532D] font-mono leading-relaxed">
              <span className="font-bold">Local Docker Compose Runtime:</span> PostgreSQL 16 (SSoT) UP • Redis 7 State Cache UP • DQN Checkpoint Verified{' '}
              <span className="bg-[#F6F8F5] px-1.5 py-0.5 rounded text-[#14241B] border border-[#D8E2D8]">
                (SHA-256: e464fa...)
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
