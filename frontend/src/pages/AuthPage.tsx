import { useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Code2,
  Compass,
  Eye,
  EyeOff,
  Layers,
  Lock,
  ShieldCheck,
  Sparkles,
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
      ? 'Cổng Quản trị Hệ thống'
      : portal === 'expert'
        ? 'Cổng Chuyên gia Nội dung'
        : 'Học tập Thích ứng Cá nhân hóa'

  const portalHeading =
    portal === 'admin'
      ? 'Đăng nhập Quản trị viên'
      : portal === 'expert'
        ? 'Đăng nhập Chuyên gia'
        : effectiveMode === 'login'
          ? 'Chào mừng trở lại'
          : 'Tạo tài khoản học viên mới'

  const portalSubtitle =
    portal === 'admin'
      ? 'Khu vực dành riêng cho Quản trị viên giám sát mô hình gợi ý và vận hành hệ thống.'
      : portal === 'expert'
        ? 'Khu vực dành riêng cho Chuyên gia thiết kế lộ trình kiến thức, câu hỏi và bài tập thực hành.'
        : effectiveMode === 'login'
          ? 'Đăng nhập để tiếp tục lộ trình học tập được cá nhân hóa dành riêng cho bạn.'
          : 'Đăng ký tài khoản miễn phí để đánh giá năng lực và bắt đầu lộ trình học phù hợp.'

  return (
    <main
      aria-label="Đăng nhập Plumora"
      className="w-full max-w-5xl mx-auto my-6 bg-white rounded-2xl border border-[#D8E2D8] shadow-sm overflow-hidden"
      data-testid="scr01-auth-section"
      data-portal={portal}
    >
      <div className="grid grid-cols-1 lg:grid-cols-12">
        {/* Left Column: Clean Authentication Form */}
        <div className="lg:col-span-6 p-8 md:p-10 flex flex-col justify-between bg-white border-b lg:border-b-0 lg:border-r border-[#D8E2D8]">
          <div>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-[#F0FDF4] border border-[#16A34A] flex items-center justify-center shadow-2xs overflow-hidden p-1 shrink-0">
                <img
                  src="/Logo_Secondary.webp"
                  alt="Plumora Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-[#15803D] uppercase tracking-wider">
                    {portalBadge}
                  </span>
                </div>
                <span className="text-xs text-[#57534E] font-medium block">
                  Phát triển năng lực công nghệ vững chắc
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
                Khu vực nội bộ chỉ dành cho tài khoản được cấp quyền.
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
              <div>
                <label
                  htmlFor="auth-username"
                  className="block text-xs font-semibold text-[#14241B] mb-1.5"
                >
                  Tên đăng nhập
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
                    placeholder="Nhập tên đăng nhập của bạn"
                    className="block w-full rounded-lg border border-[#D8E2D8] bg-[#F6F8F5] pl-10 pr-3.5 py-2.5 text-sm text-[#14241B] placeholder:text-[#57534E] focus:border-[#15803D] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#15803D]/20 transition-all"
                    required
                    data-testid="input-username"
                  />
                </div>
              </div>

              {effectiveMode === 'register' ? (
                <div>
                  <label
                    htmlFor="auth-display-name"
                    className="block text-xs font-semibold text-[#14241B] mb-1.5"
                  >
                    Họ và tên hiển thị
                  </label>
                  <input
                    id="auth-display-name"
                    type="text"
                    value={displayNameInput}
                    onChange={(e) => setDisplayNameInput(e.target.value)}
                    placeholder="Ví dụ: Minh Anh"
                    className="block w-full rounded-lg border border-[#D8E2D8] bg-[#F6F8F5] px-3.5 py-2.5 text-sm text-[#14241B] focus:border-[#15803D] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#15803D]/20 transition-all"
                    required
                    data-testid="input-display-name"
                  />
                </div>
              ) : null}

              <div>
                <label
                  htmlFor="auth-password"
                  className="block text-xs font-semibold text-[#14241B] mb-1.5"
                >
                  Mật khẩu
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
                    placeholder="Nhập mật khẩu"
                    className="block w-full rounded-lg border border-[#D8E2D8] bg-[#F6F8F5] pl-10 pr-10 py-2.5 text-sm text-[#14241B] placeholder:text-[#57534E] focus:border-[#15803D] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#15803D]/20 transition-all"
                    required
                    data-testid="input-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-[#57534E] hover:text-[#14241B] transition-colors cursor-pointer"
                    title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
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
                  <span>Thông tin tài khoản được mã hóa và bảo vệ an toàn.</span>
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 bg-[#15803D] hover:bg-[#166534] disabled:bg-[#D8E2D8] disabled:text-[#57534E] text-white font-bold h-11 rounded-lg flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                data-testid="login-submit-btn"
              >
                <span>
                  {isLoading
                    ? 'Đang xác thực...'
                    : effectiveMode === 'login'
                      ? portal === 'admin'
                        ? 'Đăng nhập Cổng Quản trị'
                        : portal === 'expert'
                          ? 'Đăng nhập Cổng Chuyên gia'
                          : 'Đăng nhập vào Lộ trình Học'
                      : 'Tạo tài khoản & Bắt đầu'}
                </span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </form>
          </div>

          <div className="mt-8 pt-4 border-t border-[#D8E2D8] flex items-center justify-between text-xs text-[#3F5247]">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#15803D]" aria-hidden="true" />
              <span className="font-medium">Phiên đăng nhập bảo mật</span>
            </div>
            {isStaffPortal && onSwitchPortal && (
              <button
                type="button"
                onClick={() => onSwitchPortal('learner')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#15803D] hover:underline cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                Trang Học viên
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Learner Value Showcase + Clean Demo Quick-Fill */}
        <div className="lg:col-span-6 bg-[#F6F8F5] p-8 md:p-10 flex flex-col justify-between">
          {portal === 'learner' ? (
            <>
              <div className="space-y-5">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#DCFCE7] text-[#14532D] text-[11px] font-bold mb-2">
                    <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Hành trình Học tập Thông minh</span>
                  </div>
                  <h2 className="text-lg font-extrabold text-[#14241B]">
                    Học đúng trọng tâm, vững chắc từ nền tảng
                  </h2>
                  <p className="text-xs text-[#3F5247] mt-1 leading-relaxed">
                    Plumora đồng hành cùng bạn qua 3 lộ trình chuyên môn: Backend, Frontend và DevOps với phương pháp cá nhân hóa theo năng lực thực tế.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-white rounded-xl p-3.5 border border-[#D8E2D8] space-y-1">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#15803D]">
                      <Compass className="w-4 h-4" aria-hidden="true" />
                      <span>Định vị Đầu vào</span>
                    </div>
                    <p className="text-[11px] text-[#57534E] leading-relaxed">
                      Kiểm tra nhanh năng lực hiện tại để bỏ qua phần đã vững và học ngay phần cần thiết.
                    </p>
                  </div>
                  <div className="bg-white rounded-xl p-3.5 border border-[#D8E2D8] space-y-1">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#0D9488]">
                      <Layers className="w-4 h-4" aria-hidden="true" />
                      <span>Đánh giá 5 Tầng Sâu</span>
                    </div>
                    <p className="text-[11px] text-[#57534E] leading-relaxed">
                      Không chỉ học vẹt khái niệm — rèn luyện từ cơ chế vận hành đến xử lý sự cố thực tế.
                    </p>
                  </div>
                  <div className="bg-white rounded-xl p-3.5 border border-[#D8E2D8] space-y-1">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#D97706]">
                      <Code2 className="w-4 h-4" aria-hidden="true" />
                      <span>Thực hành Code Trực tiếp</span>
                    </div>
                    <p className="text-[11px] text-[#57534E] leading-relaxed">
                      Viết và chạy kiểm thử bài tập lập trình ngay trên trình duyệt với phản hồi tức thì.
                    </p>
                  </div>
                  <div className="bg-white rounded-xl p-3.5 border border-[#D8E2D8] space-y-1">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#14532D]">
                      <BookOpen className="w-4 h-4" aria-hidden="true" />
                      <span>Nhắc Ôn tập Đúng lúc</span>
                    </div>
                    <p className="text-[11px] text-[#57534E] leading-relaxed">
                      Tự động gợi ý ôn lại kiến thức sắp quên để giữ độ nhớ bền vững lâu dài.
                    </p>
                  </div>
                </div>

                {/* Compact Demo Quick-Fill for Trial */}
                <div className="pt-2">
                  <p className="text-[11px] font-bold text-[#3F5247] uppercase tracking-wider mb-2">
                    Hoặc chọn nhanh hồ sơ trải nghiệm
                  </p>
                  <div className="space-y-2">
                    {[
                      {
                        username: 'learner_new',
                        label: 'Người mới bắt đầu',
                        desc: 'Chưa có tiến độ • Trải nghiệm bài kiểm tra đầu vào',
                      },
                      {
                        username: 'learner_foundation',
                        label: 'Đã vững nền tảng',
                        desc: 'Đã hoàn thành các bài cơ bản • Nhận gợi ý bài tiếp theo',
                      },
                      {
                        username: 'learner_api_stage',
                        label: 'Học viên nâng cao',
                        desc: 'Đã mở khóa nhiều chủ đề chuyên sâu & thực hành Code',
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
                          className={`w-full text-left rounded-xl px-3.5 py-2.5 border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                            selected
                              ? 'bg-white border-2 border-[#15803D] shadow-2xs'
                              : 'bg-white/80 border-[#D8E2D8] hover:border-[#15803D]/60'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-[#14241B]">{acc.label}</span>
                              <span className="text-[10px] font-mono text-[#57534E]">
                                ({acc.username})
                              </span>
                            </div>
                            <p className="text-[11px] text-[#57534E] truncate">{acc.desc}</p>
                          </div>
                          <span
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                              selected ? 'border-[#15803D]' : 'border-[#ACB4AF]'
                            }`}
                          >
                            {selected && <span className="w-2 h-2 rounded-full bg-[#15803D]" />}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-extrabold text-[#14241B]">
                  {portal === 'admin' ? 'Không gian Quản trị Hệ thống' : 'Không gian Biên soạn Học liệu'}
                </h2>
                <p className="text-xs text-[#3F5247] mt-1 leading-relaxed">
                  {portal === 'admin'
                    ? 'Theo dõi chất lượng mô hình gợi ý lộ trình, kiểm định an toàn trước khi phát hành và giám sát sức khỏe dịch vụ.'
                    : 'Xây dựng bản đồ kiến thức theo từng chuyên ngành, biên soạn câu hỏi đánh giá 5 tầng và bài tập thực hành lập trình.'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setUsernameInput(portal === 'admin' ? 'admin_demo' : 'expert_demo')
                  setPasswordInput('PlumoraDemo#2026')
                }}
                className="w-full text-left rounded-xl p-4 bg-white border border-[#D8E2D8] hover:border-[#15803D] transition-all cursor-pointer space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-xs text-[#14241B]">
                    {portal === 'admin' ? 'Tài khoản Quản trị mẫu' : 'Tài khoản Chuyên gia mẫu'}
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#DCFCE7] text-[#14532D]">
                    Điền nhanh
                  </span>
                </div>
                <p className="text-[11px] text-[#57534E]">
                  Nhấp để điền thông tin đăng nhập mẫu vào biểu mẫu bên trái.
                </p>
              </button>
            </div>
          )}

          <div className="mt-6 border border-[#BBF7D0] bg-[#F0FDF4] rounded-xl p-3.5 flex items-center gap-2.5 text-xs text-[#14532D]">
            <ShieldCheck className="w-4 h-4 text-[#15803D] shrink-0" aria-hidden="true" />
            <span>Hệ thống học tập trực tuyến hoạt động ổn định và sẵn sàng.</span>
          </div>
        </div>
      </div>
    </main>
  )
}
