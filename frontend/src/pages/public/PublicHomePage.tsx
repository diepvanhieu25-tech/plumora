import {
  ArrowRight,
  BookOpen,
  Brain,
  CheckCircle2,
  CircleDot,
  Compass,
  Cpu,
  GitBranch,
  Layers,
  Lock,
  ShieldCheck,
  Sprout,
  Terminal,
} from 'lucide-react'
import { useState } from 'react'
import { SHOWCASE_METRICS } from '../../data/publicShowcaseData'

interface PublicHomePageProps {
  onNavigatePath: (path: string) => void
}

type PreviewScenarioId = 'starter' | 'sql_ready' | 'api_ready'

interface PreviewScenario {
  id: PreviewScenarioId
  label: string
  recommendedSlug: string
  recommendedTitle: string
  reason: string
  plannedNext: string[]
  nodes: Array<{
    slug: string
    label: string
    status: 'mastered' | 'recommended' | 'unlocked' | 'locked'
  }>
}

const PREVIEW_SCENARIOS: PreviewScenario[] = [
  {
    id: 'starter',
    label: 'Mới bắt đầu',
    recommendedSlug: 'net-internet',
    recommendedTitle: 'Internet & Mô hình Mạng cơ bản',
    reason: 'Nút gốc Tầng 1 ưu tiên cao nhất, mở khóa trực tiếp HTTP/HTTPS và luồng API.',
    plannedNext: ['net-internet', 'web-http', 'api-rest'],
    nodes: [
      { slug: 'net-internet', label: 'Mạng & TCP/IP', status: 'recommended' },
      { slug: 'os-basics', label: 'Hệ điều hành', status: 'unlocked' },
      { slug: 'web-http', label: 'HTTP / HTTPS', status: 'locked' },
      { slug: 'db-relational', label: 'SQL Cơ bản', status: 'locked' },
    ],
  },
  {
    id: 'sql_ready',
    label: 'Đã vững SQL',
    recommendedSlug: 'db-transactions',
    recommendedTitle: 'Transaction (ACID) & Indexing',
    reason: 'Bạn đã đạt chuẩn SQL cơ bản; hoàn thành ACID sẽ mở khóa nhánh kết nối API-Database.',
    plannedNext: ['db-transactions', 'api-rest', 'api-data'],
    nodes: [
      { slug: 'os-basics', label: 'Hệ điều hành', status: 'mastered' },
      { slug: 'db-relational', label: 'SQL Cơ bản', status: 'mastered' },
      { slug: 'db-transactions', label: 'ACID & Index', status: 'recommended' },
      { slug: 'api-data', label: 'API + Database', status: 'locked' },
    ],
  },
  {
    id: 'api_ready',
    label: 'Chuẩn bị Tầng API',
    recommendedSlug: 'api-rest',
    recommendedTitle: 'Thiết kế RESTful API chuẩn',
    reason: 'Đã thông thạo HTTP/HTTPS; RESTful API là nút cầu nối liên thông giữa Backend và Frontend.',
    plannedNext: ['api-rest', 'api-validation', 'sec-authn'],
    nodes: [
      { slug: 'net-internet', label: 'Mạng & TCP/IP', status: 'mastered' },
      { slug: 'web-http', label: 'HTTP / HTTPS', status: 'mastered' },
      { slug: 'api-rest', label: 'RESTful API', status: 'recommended' },
      { slug: 'sec-authn', label: 'JWT & RBAC', status: 'locked' },
    ],
  },
]

const LEARNING_STEPS = [
  {
    step: '01',
    icon: Compass,
    title: 'Định vị Đầu vào Thích ứng',
    description:
      'Đánh giá nhanh năng lực hiện tại trên đồ thị tri thức để bỏ qua phần đã vững và tập trung đúng khoảng trống kiến thức.',
  },
  {
    step: '02',
    icon: BookOpen,
    title: 'Đọc Playbook 5 Phần',
    description:
      'Tài liệu chuyên sâu chuẩn kỹ sư kèm mục lục cố định, khối lưu ý kỹ thuật và thẻ câu hỏi phản tư tương tác.',
  },
  {
    step: '03',
    icon: Layers,
    title: 'Kiểm tra Đào sâu 5 Tầng',
    description:
      'Hệ thống 220 câu hỏi luân phiên từ nhận diện đến xử lý sự cố sản xuất, chấm điểm bằng Rubric và LLM Adapter.',
  },
  {
    step: '04',
    icon: Terminal,
    title: 'Thực hành Code Sandbox',
    description:
      'Viết và chạy mã Python, JavaScript hoặc SQL trong môi trường cô lập <= 3000ms để chốt điều kiện kép 1.00 Mastery.',
  },
] as const

export function PublicHomePage({ onNavigatePath }: PublicHomePageProps) {
  const [scenarioId, setScenarioId] = useState<PreviewScenarioId>('sql_ready')
  const activeScenario =
    PREVIEW_SCENARIOS.find((s) => s.id === scenarioId) ?? PREVIEW_SCENARIOS[1]

  return (
    <div data-testid="pub01-home-page" className="w-full">
      {/* HERO SECTION — Botanical Editorial & Interactive Blueprint */}
      <section className="relative border-b border-[#D8E2D8] bg-gradient-to-b from-white via-[#F6F8F5] to-[#F6F8F5]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage: 'radial-gradient(#B6C8B8 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-14 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* Left Copy */}
          <div className="lg:col-span-7 space-y-6 min-w-0">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-container/80 border border-primary/20 text-on-primary-container text-xs font-semibold">
              <Sprout className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden="true" />
              <span>Học tăng cường Đồ thị (GNN-PPO) · Kiến trúc Microservices v4.1</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-on-surface leading-[1.15]">
              Lộ trình học tập cá nhân hóa{' '}
              <span className="text-primary">tự thích ứng</span> theo năng lực thật
            </h1>

            <p className="text-base sm:text-lg text-on-surface-variant leading-relaxed max-w-2xl">
              Plumora kết hợp <strong className="text-on-surface font-semibold">Đồ thị tri thức đa lĩnh vực (DAG)</strong>, mô hình <strong className="text-on-surface font-semibold">GNN-PPO</strong> cùng lớp bảo vệ tiên quyết, vòng kiểm tra đào sâu 5 tầng và <strong className="text-on-surface font-semibold">Code Sandbox cô lập</strong> để gợi ý chính xác bước học tối ưu tiếp theo.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <button
                type="button"
                data-testid="pub-hero-cta-register"
                onClick={() => onNavigatePath('/register')}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 min-h-[48px] rounded-xl bg-primary hover:bg-primary-dim text-on-primary text-sm sm:text-base font-semibold transition-colors shadow-sm"
              >
                <span>Bắt đầu học miễn phí</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                data-testid="pub-hero-cta-how-it-works"
                onClick={() => onNavigatePath('/how-it-works')}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 min-h-[48px] rounded-xl bg-white hover:bg-surface-container-low border border-[#D8E2D8] text-on-surface text-sm sm:text-base font-semibold transition-colors"
              >
                <Cpu className="w-4 h-4 text-primary" aria-hidden="true" />
                <span>Xem cách AI hoạt động</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 text-xs text-on-surface-variant">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
                <span>Tôn trọng 100% điều kiện tiên quyết DAG</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-secondary shrink-0" aria-hidden="true" />
                <span>Giải thích minh bạch 3 bước tiếp theo</span>
              </span>
            </div>
          </div>

          {/* Right Interactive Blueprint Card */}
          <div className="lg:col-span-5 min-w-0">
            <div className="rounded-2xl bg-white border border-[#D8E2D8] shadow-md p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#D8E2D8]/80">
                <div className="flex items-center gap-2 min-w-0">
                  <GitBranch className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
                  <span className="text-xs font-bold uppercase tracking-wider text-on-surface truncate">
                    Mô phỏng Định tuyến GNN-PPO
                  </span>
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-surface-container-low text-on-surface-variant border border-[#D8E2D8] shrink-0">
                  Policy Guardrail
                </span>
              </div>

              {/* Interactive Scenario Switcher */}
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Chọn trạng thái mẫu">
                {PREVIEW_SCENARIOS.map((sc) => {
                  const selected = sc.id === activeScenario.id
                  return (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => setScenarioId(sc.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        selected
                          ? 'bg-primary text-on-primary'
                          : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      {sc.label}
                    </button>
                  )
                })}
              </div>

              {/* Sunlit AI Recommendation Preview */}
              <div className="rounded-xl bg-ai-sunlit-bg border-2 border-ai-sunlit-border/80 p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-ai-sunlit-text">
                  <Compass className="w-4 h-4 text-tertiary shrink-0" aria-hidden="true" />
                  <span>GỢI Ý TỐI ƯU TIẾP THEO</span>
                </div>
                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                  <p className="text-sm font-bold text-on-surface">
                    {activeScenario.recommendedTitle}
                  </p>
                  <span className="text-[11px] font-mono text-ai-sunlit-text bg-white/80 px-2 py-0.5 rounded border border-ai-sunlit-border/40">
                    {activeScenario.recommendedSlug}
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  {activeScenario.reason}
                </p>
                <div className="pt-1 flex flex-wrap items-center gap-1.5 text-[11px] font-mono text-ai-sunlit-text">
                  <span className="font-semibold">3 chặng dự kiến:</span>
                  {activeScenario.plannedNext.map((slug, i) => (
                    <span key={slug} className="inline-flex items-center gap-1">
                      <span className="px-1.5 py-0.5 rounded bg-white border border-ai-sunlit-border/40">
                        {slug}
                      </span>
                      {i < activeScenario.plannedNext.length - 1 && (
                        <ArrowRight className="w-3 h-3" aria-hidden="true" />
                      )}
                    </span>
                  ))}
                </div>
              </div>

              {/* Mini DAG Nodes */}
              <div className="grid grid-cols-2 gap-2.5">
                {activeScenario.nodes.map((node) => {
                  const styleMap = {
                    mastered:
                      'bg-[#F0FDF4] border-[#16A34A]/60 text-[#14532D]',
                    recommended:
                      'bg-[#FFFBEB] border-[#D97706] text-[#78350F] ring-2 ring-amber-100',
                    unlocked:
                      'bg-[#F0FDFA] border-[#0D9488]/60 text-[#134E4A]',
                    locked:
                      'bg-stone-100 border-stone-300 text-stone-600',
                  }[node.status]
                  const IconComp = {
                    mastered: CheckCircle2,
                    recommended: Compass,
                    unlocked: CircleDot,
                    locked: Lock,
                  }[node.status]
                  return (
                    <div
                      key={node.slug}
                      className={`rounded-xl border p-2.5 flex items-start gap-2 min-w-0 ${styleMap}`}
                    >
                      <IconComp className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate">{node.label}</div>
                        <div className="text-[10px] font-mono opacity-80 truncate">
                          {node.slug}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* METRICS STRIP */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 -mt-6 relative z-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {SHOWCASE_METRICS.map((m) => (
            <div
              key={m.label}
              className="rounded-2xl bg-white border border-[#D8E2D8] p-5 shadow-xs space-y-1"
            >
              <div className="text-2xl font-extrabold font-mono text-primary">
                {m.value}
              </div>
              <div className="text-sm font-bold text-on-surface">{m.label}</div>
              <div className="text-xs text-on-surface-variant">{m.detail}</div>
            </div>
          ))}
        </div>
      </section>

      {/* BENTO GRID — 4 CORE PILLARS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 space-y-8">
        <div className="max-w-2xl space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">
            Trụ cột Công nghệ
          </p>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-on-surface">
            Thiết kế cho sự hiểu sâu, không học vẹt
          </h2>
          <p className="text-sm sm:text-base text-on-surface-variant">
            Mỗi quyết định gợi ý và chấm điểm đều dựa trên trạng thái kiến thức thực tế, ràng buộc đồ thị tiên quyết và tiêu chuẩn kỹ thuật minh bạch.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          {/* Card 1 */}
          <div className="md:col-span-7 rounded-2xl bg-white border border-[#D8E2D8] p-6 sm:p-7 space-y-3 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-ai-sunlit-bg border border-ai-sunlit-border/40 text-tertiary flex items-center justify-center">
              <Compass className="w-5 h-5" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-bold text-on-surface">
              Định tuyến GNN-PPO & Lớp Bảo vệ Chính sách (Policy Guardrail)
            </h3>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              Mạng nơ-ron đồ thị (GNN) mã hóa trạng thái 8 chiều trên từng khái niệm để chính sách PPO chọn hành động học tập tối ưu. Lớp <span className="font-mono text-xs text-on-surface">PolicyGuardrail</span> đảm bảo AI không bao giờ đề xuất khái niệm chưa mở khóa tiên quyết và giải thích rõ 3 bước kế tiếp.
            </p>
          </div>

          {/* Card 2 */}
          <div className="md:col-span-5 rounded-2xl bg-white border border-[#D8E2D8] p-6 sm:p-7 space-y-3 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-secondary-container/70 border border-secondary/30 text-secondary flex items-center justify-center">
              <Brain className="w-5 h-5" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-bold text-on-surface">
              Suy giảm Trí nhớ Ebbinghaus
            </h3>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              Theo dõi độ bền trí nhớ theo thời gian thực qua mô hình{' '}
              <span className="font-mono text-xs text-on-surface">R(t) = e^(-dt / S)</span>. Khi khả năng ghi nhớ giảm xuống dưới ngưỡng an toàn, hệ thống chủ động đề xuất phiên ôn tập ngắt quãng (*Spaced Review*).
            </p>
          </div>

          {/* Card 3 */}
          <div className="md:col-span-5 rounded-2xl bg-white border border-[#D8E2D8] p-6 sm:p-7 space-y-3 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-primary-container/80 border border-primary/20 text-primary flex items-center justify-center">
              <BookOpen className="w-5 h-5" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-bold text-on-surface">
              Kiểm tra Đào sâu 5 Tầng & Gia sư Socratic
            </h3>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              Vượt qua trắc nghiệm bề mặt với 5 tầng tư duy tăng dần, chấm điểm tự luận theo Rubric (kèm cơ chế fallback ngoại tuyến) và Gia sư AI đặt câu hỏi gợi mở thay vì đưa sẵn đáp án.
            </p>
          </div>

          {/* Card 4 */}
          <div className="md:col-span-7 rounded-2xl bg-white border border-[#D8E2D8] p-6 sm:p-7 space-y-3 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-surface-container-low border border-[#D8E2D8] text-on-surface flex items-center justify-center">
              <Terminal className="w-5 h-5" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-bold text-on-surface">
              Code Sandbox Cô lập & Điều kiện Kép 1.00 Mastery
            </h3>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              Thực thi trực tiếp mã Python, JavaScript và SQL trong sandbox giới hạn thời gian <span className="font-mono text-xs text-on-surface">&lt;= 3000ms</span>. Để đạt mức thông thạo tối đa <span className="font-mono text-xs text-on-surface">1.00</span>, học viên cần chinh phục cả lý thuyết 5 tầng lẫn bài tập thực hành.
            </p>
          </div>
        </div>
      </section>

      {/* 4-STEP SEQUENTIAL LEARNING FLOW */}
      <section className="border-y border-[#D8E2D8] bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-2 max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-wider text-primary">
                Vòng lặp Học Tuần tự
              </p>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-on-surface">
                4 bước chinh phục trọn vẹn mỗi khái niệm
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigatePath('/curriculum')}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary-dim transition-colors self-start sm:self-auto"
            >
              <span>Xem toàn bộ 3 lĩnh vực</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {LEARNING_STEPS.map((item) => {
              const Icon = item.icon
              return (
                <div
                  key={item.step}
                  className="rounded-2xl bg-[#F6F8F5] border border-[#D8E2D8] p-5 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="w-9 h-9 rounded-xl bg-white border border-[#D8E2D8] text-primary flex items-center justify-center">
                      <Icon className="w-4 h-4" aria-hidden="true" />
                    </span>
                    <span className="text-xs font-mono font-bold text-outline">
                      BƯỚC {item.step}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-on-surface">{item.title}</h3>
                  <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                    {item.description}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* BOTTOM CTA BANNER */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-16">
        <div className="rounded-2xl bg-[#F0FDF4] border border-primary/25 p-6 sm:p-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-on-surface">
              Sẵn sàng bắt đầu lộ trình cá nhân hóa của bạn?
            </h2>
            <p className="text-sm sm:text-base text-on-surface-variant">
              Tạo tài khoản học viên để làm bài đánh giá đầu vào thích ứng và nhận lộ trình đề xuất trực tiếp từ mô hình GNN-PPO.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto shrink-0">
            <button
              type="button"
              onClick={() => onNavigatePath('/register')}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] rounded-xl bg-primary hover:bg-primary-dim text-on-primary text-sm font-semibold transition-colors shadow-xs"
            >
              <span>Tạo tài khoản ngay</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onNavigatePath('/about')}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[44px] rounded-xl bg-white hover:bg-surface-container-low border border-[#D8E2D8] text-on-surface text-sm font-semibold transition-colors"
            >
              <span>Xem Kiến trúc Hệ thống</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
