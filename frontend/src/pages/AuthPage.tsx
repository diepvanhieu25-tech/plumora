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
  onQuickPickSeedAccount?: (username: string) => Promise<void>
}

const BACKEND_TIERS_OVERVIEW = [
  {
    tier: 1,
    title: 'Tầng 1 — Nền tảng (Foundations)',
    concepts: ['Mạng Internet, IP, DNS', 'Hệ điều hành, Process, I/O'],
    color: 'border-l-[#15803D]',
  },
  {
    tier: 2,
    title: 'Tầng 2 — Giao thức & Cơ sở dữ liệu',
    concepts: ['Giao thức HTTP/HTTPS', 'CSDL Quan hệ & SQL', 'Transaction (ACID) & Index', 'CSDL NoSQL'],
    color: 'border-l-[#0D9488]',
  },
  {
    tier: 3,
    title: 'Tầng 3 — Thiết kế API & Trạng thái',
    concepts: ['Thiết kế RESTful API', 'Validation & Serialization', 'Kết nối DB & Query Patterns', 'Caching với Redis'],
    color: 'border-l-[#D97706]',
  },
  {
    tier: 4,
    title: 'Tầng 4 — Bảo mật Backend cơ bản',
    concepts: ['Xác thực JWT & Session', 'Bảo mật API (SQLi, Rate Limit)'],
    color: 'border-l-[#991B1B]',
  },
]

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
      aria-label="SCR-01 Đăng nhập và Đăng ký Học viên"
      className="w-full max-w-5xl mx-auto my-6 bg-white rounded-2xl border border-[#D8E2D8] shadow-sm overflow-hidden"
      data-testid="scr01-auth-section"
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
                    PL-AUTH-01 • XÁC THỰC PHIÊN HỌC VIÊN
                  </span>
                </div>
                <span className="text-xs text-[#57534E] font-medium block">
                  Hệ thống Lộ trình Học Backend Thích ứng AI
                </span>
              </div>
            </div>

            <h1 className="text-2xl md:text-3xl font-extrabold text-[#14241B] tracking-tight">
              {authMode === 'login' ? 'Chào mừng trở lại' : 'Tạo tài khoản học viên mới'}
            </h1>
            <p className="text-sm text-[#3F5247] mt-1.5 font-normal leading-relaxed">
              {authMode === 'login'
                ? 'Đăng nhập để tiếp tục lộ trình học tập cá nhân hóa với mô hình DQN.'
                : 'Đăng ký tài khoản để bắt đầu với tiến độ của riêng bạn (0/12 khái niệm).'}
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
                data-testid="tab-login-btn"
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
                data-testid="tab-register-btn"
              >
                Đăng ký học viên mới
              </button>
            </div>

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
                    : authMode === 'login'
                    ? 'Đăng nhập vào Lộ trình Học'
                    : 'Tạo tài khoản & Bắt đầu Lộ trình'}
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
              Chống CSRF &amp; Session Replay
            </span>
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
                Lộ trình 12 Khái niệm Backend &amp; Trí tuệ DQN
              </h2>
            </div>
            <p className="text-xs text-[#3F5247] font-normal leading-relaxed mb-4">
              Hệ thống được thiết kế theo mô hình đồ thị có hướng không chu trình (DAG), kết hợp giải thuật Học tăng cường (DQN) để định hướng lộ trình học thích ứng với năng lực thực tế của từng học viên:
            </p>

            {/* 4 Tier Overview Cards */}
            <div className="space-y-2.5">
              {BACKEND_TIERS_OVERVIEW.map((tier) => (
                <div
                  key={tier.tier}
                  className={`bg-white rounded-xl p-3 border border-[#D8E2D8] border-l-4 ${tier.color} shadow-2xs space-y-1`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-[#14241B]">{tier.title}</span>
                    <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-[#F6F8F5] text-[#57534E] border border-[#D8E2D8]">
                      {tier.concepts.length} khái niệm
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 text-[11px] text-[#57534E]">
                    {tier.concepts.map((c, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1">
                        <span className="text-[#15803D] font-bold">•</span>
                        <span>{c}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Pedagogical Feature Callouts */}
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="bg-white p-2.5 rounded-lg border border-[#D8E2D8] space-y-1">
                <div className="flex items-center gap-1 text-[#15803D] font-bold">
                  <Cpu className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>DQN Policy</span>
                </div>
                <p className="text-[11px] text-[#57534E] leading-snug">
                  Đánh giá vector 24 chiều để gợi ý bài học tối ưu theo điều kiện tiên quyết.
                </p>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-[#D8E2D8] space-y-1">
                <div className="flex items-center gap-1 text-[#0D9488] font-bold">
                  <Compass className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Tự do Lựa chọn</span>
                </div>
                <p className="text-[11px] text-[#57534E] leading-snug">
                  Người học hoàn toàn tự do khám phá bất kỳ khái niệm nào đã mở khóa.
                </p>
              </div>
            </div>

            {/* Collapsible Testing & Seed Accounts Drawer (Separated from normal learner flow) */}
            <details
              className="mt-4 bg-white rounded-xl border border-[#D8E2D8] p-3 text-xs"
              data-testid="dev-seed-accounts-details"
            >
              <summary className="font-bold text-[#57534E] hover:text-[#15803D] cursor-pointer flex items-center justify-between select-none">
                <div className="flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-[#15803D]" aria-hidden="true" />
                  <span>Tài khoản Học viên Mẫu (Seeded trong PostgreSQL)</span>
                </div>
                <span className="text-[10px] bg-[#F6F8F5] text-[#57534E] px-1.5 py-0.5 rounded border border-[#D8E2D8]">
                  Thử nghiệm
                </span>
              </summary>
              <p className="text-[11px] text-[#78716C] mt-2 mb-2 leading-relaxed">
                Các tài khoản kiểm thử đã khởi tạo sẵn để đánh giá thử nghiệm quyết định của mô hình DQN:
              </p>
              <div className="space-y-2 mt-2">
                {SEEDED_PROFILES.map((prof) => (
                  <div
                    key={prof.username}
                    className="p-2.5 rounded-lg border border-[#D8E2D8] bg-[#F6F8F5] flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-xs text-[#14241B]">
                          {prof.username}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-white text-[#15803D] border border-[#BBF7D0] font-semibold">
                          {prof.label}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#57534E]">{prof.desc}</p>
                    </div>
                    {onQuickPickSeedAccount && (
                      <button
                        type="button"
                        onClick={() => onQuickPickSeedAccount(prof.username)}
                        className="px-2.5 py-1 bg-white hover:bg-[#F0FDF4] border border-[#D8E2D8] hover:border-[#15803D] text-[#15803D] font-bold text-[11px] rounded transition-colors cursor-pointer"
                        data-testid={`seed-login-${prof.username}`}
                        title={`Đăng nhập với ${prof.username}`}
                      >
                        Chọn
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </details>
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
    </div>
  )
}
