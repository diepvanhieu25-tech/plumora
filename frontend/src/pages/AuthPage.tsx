import { ShieldCheck, SlidersHorizontal } from 'lucide-react'

const SEEDED_PROFILES = [
  {
    username: 'learner_new',
    label: 'Học viên Mới (0/12 Node)',
    desc: 'Khởi đầu từ 0% ở cả 12 node; mở khóa Tầng 1 (net-internet, os-basics)',
    presetKey: 'new_learner',
  },
  {
    username: 'learner_foundation',
    label: 'Học viên Nền tảng (4/12 Node)',
    desc: 'Đã đạt chuẩn >= 75% ở 4 bài nền tảng; DQN khuyến nghị học db-transactions',
    presetKey: 'foundation_ready',
  },
  {
    username: 'learner_api_stage',
    label: 'Học viên Tầng API (7/12 Node)',
    desc: 'Đã xong toàn bộ CSDL và REST cơ bản; DQN khuyến nghị api-validation',
    presetKey: 'api_stage_ready',
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
  return (
    <section
      aria-label="SCR-01 Đăng nhập và Tài khoản Học viên Mẫu"
      className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      data-testid="scr01-auth-section"
    >
      <div className="plumora-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#15803D]" aria-hidden="true" />
            <h2 className="text-lg font-bold">
              {authMode === 'login'
                ? 'Đăng nhập Học viên (Argon2id + HttpOnly Session)'
                : 'Đăng ký Tài khoản Học viên Mới'}
            </h2>
          </div>
          <button
            type="button"
            onClick={() =>
              setAuthMode(authMode === 'login' ? 'register' : 'login')
            }
            className="text-xs font-semibold text-[#15803D] underline"
          >
            {authMode === 'login' ? 'Chuyển sang Đăng ký' : 'Đã có tài khoản? Đăng nhập'}
          </button>
        </div>

        {authError ? (
          <div
            role="alert"
            className="mb-4 p-3 rounded-lg bg-[#FFF1F2] border border-[#FDA4AF] text-[#9F1239] text-xs font-medium"
          >
            {authError}
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label
              htmlFor="auth-username"
              className="block text-xs font-semibold text-[#3F5247] mb-1"
            >
              Tên đăng nhập (Username)
            </label>
            <input
              id="auth-username"
              type="text"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#D8E2D8] font-mono text-sm"
              required
            />
          </div>

          {authMode === 'register' ? (
            <div>
              <label
                htmlFor="auth-display-name"
                className="block text-xs font-semibold text-[#3F5247] mb-1"
              >
                Tên hiển thị (Display Name)
              </label>
              <input
                id="auth-display-name"
                type="text"
                value={displayNameInput}
                onChange={(e) => setDisplayNameInput(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[#D8E2D8] text-sm"
                required
              />
            </div>
          ) : null}

          <div>
            <label
              htmlFor="auth-password"
              className="block text-xs font-semibold text-[#3F5247] mb-1"
            >
              Mật khẩu (Password)
            </label>
            <input
              id="auth-password"
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#D8E2D8] font-mono text-sm"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="plumora-btn-primary w-full"
            data-testid="login-submit-btn"
          >
            <span>
              {authMode === 'login'
                ? 'Đăng nhập vào Lộ trình'
                : 'Tạo tài khoản & Khởi tạo 12 Node'}
            </span>
          </button>
        </form>
      </div>

      <div className="plumora-card">
        <div className="flex items-center gap-2 mb-2">
          <SlidersHorizontal className="w-5 h-5 text-[#15803D]" aria-hidden="true" />
          <h2 className="text-lg font-bold">
            Tài khoản Học viên Mẫu (Seeded trong PostgreSQL)
          </h2>
        </div>
        <p className="text-xs text-[#3F5247] mb-3">
          Đi qua luồng xác thực Argon2id, PostgreSQL SSoT và Redis State Cache thật 100% (không dùng privileged bypass):
        </p>
        <div className="space-y-2.5">
          {SEEDED_PROFILES.map((prof) => (
            <div
              key={prof.username}
              className="flex items-center justify-between gap-3 p-3 rounded-lg border border-[#D8E2D8] bg-[#F6F8F5]"
            >
              <div>
                <div className="font-mono text-sm font-bold text-[#14241B]">
                  {prof.username}
                </div>
                <div className="text-xs font-semibold text-[#15803D]">
                  {prof.label}
                </div>
                <div className="text-xs text-[#3F5247]">{prof.desc}</div>
              </div>
              <button
                type="button"
                onClick={() => onQuickPickSeedAccount(prof.username)}
                className="plumora-btn-outline text-xs shrink-0"
                data-testid={`seed-login-${prof.username}`}
              >
                Đăng nhập mẫu
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
