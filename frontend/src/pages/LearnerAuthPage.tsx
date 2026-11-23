import { useState } from 'react'
import {
  ArrowRight,
  BookOpen,
  Code2,
  Compass,
  Eye,
  EyeOff,
  History,
  Layers,
  Lock,
  ShieldCheck,
  Sprout,
  User,
} from 'lucide-react'
import { StatusAlertBanner } from '../components/ui/StatusAlertBanner'

interface LearnerAuthPageProps {
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

export function LearnerAuthPage({
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
}: LearnerAuthPageProps) {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <main
      aria-label="Đăng nhập không gian học tập Plumora"
      className="w-full max-w-5xl mx-auto my-8 bg-white rounded-2xl border border-outline-variant/70 shadow-sm overflow-hidden"
      data-testid="learner-auth-page"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12">
        {/* Left Column: Clean Learner Login / Register Form */}
        <div className="lg:col-span-6 p-8 md:p-10 flex flex-col justify-between bg-white border-b lg:border-b-0 lg:border-r border-outline-variant/60">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-primary-container border border-primary/40 flex items-center justify-center text-primary shrink-0">
                <Sprout className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <span className="text-xs font-extrabold text-primary uppercase tracking-wider block">
                  Plumora Learning
                </span>
                <span className="text-xs text-on-surface-variant font-medium">
                  Học đúng trọng tâm, vững chắc từ nền tảng
                </span>
              </div>
            </div>

            <h1 className="text-2xl md:text-3xl font-headline font-extrabold text-on-surface tracking-tight">
              {authMode === 'login' ? 'Chào mừng trở lại' : 'Tạo tài khoản học viên'}
            </h1>
            <p className="text-sm text-on-surface-variant mt-1.5 leading-relaxed">
              {authMode === 'login'
                ? 'Đăng nhập để tiếp tục lộ trình học tập được cá nhân hóa dành riêng cho bạn.'
                : 'Đăng ký miễn phí để đánh giá năng lực và xây dựng lộ trình chuyên môn phù hợp.'}
            </p>

            {/* Mode Toggle */}
            <div className="mt-6 p-1 bg-surface rounded-xl border border-outline-variant/60 flex items-center">
              <button
                type="button"
                onClick={() => setAuthMode('login')}
                className={`flex-1 py-2 px-3 text-xs sm:text-sm font-semibold rounded-lg text-center transition-all cursor-pointer ${
                  authMode === 'login'
                    ? 'bg-primary text-on-primary shadow-xs'
                    : 'text-on-surface-variant hover:text-on-surface'
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
                    ? 'bg-primary text-on-primary shadow-xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
                data-testid="tab-register-btn"
              >
                Đăng ký mới
              </button>
            </div>

            {authError && (
              <StatusAlertBanner
                variant="error"
                message={authError}
                className="mt-4"
                data-testid="auth-error-banner"
              />
            )}

            <form onSubmit={onSubmit} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="learner-username"
                  className="block text-xs font-semibold text-on-surface mb-1.5"
                >
                  Tên đăng nhập
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                    <User className="w-4 h-4 text-outline" aria-hidden="true" />
                  </div>
                  <input
                    id="learner-username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    placeholder="Nhập tên đăng nhập của bạn"
                    className="block w-full rounded-xl border border-outline-variant bg-surface pl-10 pr-3.5 py-2.5 text-sm text-on-surface placeholder:text-outline/70 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    required
                    data-testid="input-username"
                  />
                </div>
              </div>

              {authMode === 'register' && (
                <div>
                  <label
                    htmlFor="learner-display-name"
                    className="block text-xs font-semibold text-on-surface mb-1.5"
                  >
                    Họ và tên hiển thị
                  </label>
                  <input
                    id="learner-display-name"
                    name="display_name"
                    type="text"
                    autoComplete="name"
                    value={displayNameInput}
                    onChange={(e) => setDisplayNameInput(e.target.value)}
                    placeholder="Ví dụ: Nguyễn Minh Anh"
                    className="block w-full rounded-xl border border-outline-variant bg-surface px-3.5 py-2.5 text-sm text-on-surface placeholder:text-outline/70 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    required
                    data-testid="input-display-name"
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="learner-password"
                  className="block text-xs font-semibold text-on-surface mb-1.5"
                >
                  Mật khẩu
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                    <Lock className="w-4 h-4 text-outline" aria-hidden="true" />
                  </div>
                  <input
                    id="learner-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Nhập mật khẩu"
                    className="block w-full rounded-xl border border-outline-variant bg-surface pl-10 pr-10 py-2.5 text-sm text-on-surface placeholder:text-outline/70 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    required
                    data-testid="input-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-outline hover:text-on-surface cursor-pointer"
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
                className="w-full mt-2 bg-primary hover:bg-primary-dim disabled:opacity-50 text-on-primary font-bold h-11 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                data-testid="login-submit-btn"
              >
                <span>
                  {isLoading
                    ? 'Đang xử lý...'
                    : authMode === 'login'
                      ? 'Đăng nhập vào Lộ trình Học'
                      : 'Tạo tài khoản & Bắt đầu'}
                </span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </form>
          </div>

          <div className="mt-8 pt-4 border-t border-surface-container flex items-center gap-2 text-xs text-on-surface-variant">
            <ShieldCheck className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
            <span>Thông tin tài khoản và tiến độ học tập của bạn được bảo vệ an toàn.</span>
          </div>
        </div>

        {/* Right Column: Pure Learner Value Proposition */}
        <div className="lg:col-span-6 bg-surface p-8 md:p-10 flex flex-col justify-between gap-6">
          <div className="space-y-5">
            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-container text-on-primary-container text-xs font-bold">
                <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Hành trình Học tập Cá nhân hóa</span>
              </span>
              <h2 className="text-xl font-headline font-extrabold text-on-surface leading-snug">
                Phát triển năng lực Kỹ sư Phần mềm theo đúng nhịp độ của bạn
              </h2>
              <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                Khám phá 3 lộ trình chuyên sâu: Backend, Frontend và DevOps với phương pháp học từng bước từ lý thuyết cốt lõi đến thực hành thực tế.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="bg-white rounded-xl p-4 border border-outline-variant/60 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-primary">
                  <Compass className="w-4 h-4" aria-hidden="true" />
                  <span>Định vị Năng lực Đầu vào</span>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Đánh giá nhanh kiến thức sẵn có để bắt đầu ngay từ điểm phù hợp, không phải học lại phần đã vững.
                </p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-outline-variant/60 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-secondary">
                  <Layers className="w-4 h-4" aria-hidden="true" />
                  <span>Đào sâu 5 Tầng Hiểu biết</span>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Đi từ khái niệm cơ bản đến cơ chế vận hành, xử lý sự cố và đánh đổi kiến trúc thực tế.
                </p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-outline-variant/60 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-tertiary">
                  <Code2 className="w-4 h-4" aria-hidden="true" />
                  <span>Thực hành Lập trình Trực tiếp</span>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Sửa lỗi và chạy kiểm thử bài tập Python, SQL, JavaScript ngay trên trình duyệt.
                </p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-outline-variant/60 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-on-primary-container">
                  <History className="w-4 h-4" aria-hidden="true" />
                  <span>Nhắc Ôn tập Đúng Thời điểm</span>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Tự động lên lịch ôn tập trước khi kiến thức bị lãng quên giúp ghi nhớ bền vững lâu dài.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-primary-container/40 border border-primary/25 p-4 text-xs text-on-primary-container leading-relaxed">
            <strong className="block mb-0.5">Kiến thức liên thông giữa các chuyên ngành</strong>
            Khi bạn nắm vững một chủ đề dùng chung (như HTTP/HTTPS hay Bảo mật API), tiến độ được tự động kế thừa sang các chuyên ngành khác.
          </div>
        </div>
      </div>
    </main>
  )
}
