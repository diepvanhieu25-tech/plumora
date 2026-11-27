import {
  Activity,
  AlertCircle,
  ArrowRight,
  Brain,
  Compass,
  Cpu,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react'

interface PublicHowItWorksPageProps {
  onNavigatePath: (path: string) => void
}

const RL_PIPELINE_STAGES = [
  {
    index: '01',
    icon: SlidersHorizontal,
    title: 'Mã hóa Trạng thái Đồ thị (8 Chiều / Node)',
    detail:
      'Mỗi khái niệm trên DAG được biểu diễn bằng vector 8 đặc trưng: mức thông thạo lý thuyết, điểm Code Sandbox, độ bền trí nhớ Ebbinghaus, trạng thái mở khóa tiên quyết, số lần tương tác và chỉ số liên thông đa ngành.',
  },
  {
    index: '02',
    icon: Cpu,
    title: 'Suy luận GNN-PPO (Zero-Torch Kernel)',
    detail:
      'Chính sách GNN-PPO được trích xuất sang gói lõi plumora_rl không phụ thuộc PyTorch lúc phục vụ, cho phép suy luận nhanh trên đồ thị có kích thước bất kỳ và phóng chiếu 3 chặng học tập liên tiếp.',
  },
  {
    index: '03',
    icon: ShieldCheck,
    title: 'Policy Guardrail & Luật Tuần tự',
    detail:
      'Trước khi trả kết quả cho học viên, lớp Guardrail lọc bỏ mọi hành động vi phạm tiên quyết DAG, khóa nhánh Đào sâu khi chỉ còn thiếu Code Sandbox và minh bạch hóa lý do ưu tiên (decision_factors).',
  },
  {
    index: '04',
    icon: Brain,
    title: 'Cập nhật Mastery & Ebbinghaus R(t)',
    detail:
      'Mọi lượt nộp bài 5 tầng và Code Sandbox cập nhật điểm thông thạo và kéo dài hằng số ổn định trí nhớ S. Theo thời gian dt, công thức R(t) = e^(-dt / S) giúp phát hiện sớm kiến thức có nguy cơ quên.',
  },
] as const

const ONLINE_RL_GUARDS = [
  {
    title: 'TD Critic Advantage',
    description:
      'Ước lượng lợi thế hành động từ tập tương tác thực tế tích lũy trong micro-batch thay vì cập nhật mù quáng theo từng mẫu đơn lẻ.',
  },
  {
    title: 'Trust-Region KL Guard',
    description:
      'Giới hạn độ lệch phân phối KL-divergence giữa chính sách mới và chính sách đang chạy để ngăn sụp đổ chính sách (policy collapse).',
  },
  {
    title: 'Safety Evaluation Gate',
    description:
      'Mọi checkpoint ứng viên bắt buộc vượt qua bộ đánh giá định lượng trên simulator 60 bước chuẩn trước khi được phép kích hoạt.',
  },
  {
    title: '1-Click Rollback',
    description:
      'Lưu trữ bền vững mọi phiên bản ứng viên (plumora_rl_candidates) giúp Quản trị viên quay lui về checkpoint ổn định chỉ với 1 thao tác.',
  },
] as const

export function PublicHowItWorksPage({ onNavigatePath }: PublicHowItWorksPageProps) {
  return (
    <div data-testid="pub02-how-it-works-page" className="max-w-7xl mx-auto px-4 sm:px-6 py-12 lg:py-16 space-y-14">
      {/* Page Header */}
      <header className="max-w-3xl space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-ai-sunlit-bg border border-ai-sunlit-border/50 text-ai-sunlit-text text-xs font-semibold">
          <Compass className="w-3.5 h-3.5 text-tertiary" aria-hidden="true" />
          <span>Cách hoạt động AI & Học tăng cường (Reinforcement Learning)</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-on-surface">
          Định tuyến lộ trình học tập minh bạch bằng GNN-PPO
        </h1>
        <p className="text-base text-on-surface-variant leading-relaxed">
          Thay vì áp đặt một danh sách bài học cố định cho mọi người, Plumora mô hình hóa quá trình học tập như một bài toán ra quyết định tuần tự trên Đồ thị tri thức (DAG) có ràng buộc sư phạm nghiêm ngặt.
        </p>
      </header>

      {/* Closed-loop 4-Stage Pipeline */}
      <section className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-bold text-on-surface">
            Vòng lặp Thích ứng Khép kín 4 Giai đoạn
          </h2>
          <p className="text-sm text-on-surface-variant">
            Từ trạng thái năng lực hiện tại đến đề xuất bài học cụ thể kèm giải thích.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {RL_PIPELINE_STAGES.map((stage) => {
            const Icon = stage.icon
            return (
              <div
                key={stage.index}
                className="rounded-2xl bg-white border border-[#D8E2D8] p-6 space-y-3 shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="w-10 h-10 rounded-xl bg-primary-container/70 border border-primary/20 text-primary flex items-center justify-center">
                    <Icon className="w-5 h-5" aria-hidden="true" />
                  </span>
                  <span className="text-xs font-mono font-bold text-outline">
                    STAGE {stage.index}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-on-surface">
                  {stage.title}
                </h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  {stage.detail}
                </p>
              </div>
            )
          })}
        </div>
      </section>

      {/* Simulator Experimental Setup & Scientific Honesty */}
      <section className="rounded-2xl bg-white border border-[#D8E2D8] p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
              <Activity className="w-4 h-4" aria-hidden="true" />
              <span>Thiết kế Thực nghiệm & Đối chứng Mô hình</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-on-surface">
              Huấn luyện Công bằng & Khả năng Tổng quát hóa Zero-shot
            </h2>
          </div>
          <span className="text-xs font-mono px-3 py-1 rounded-lg bg-surface-container-low border border-[#D8E2D8] text-on-surface-variant self-start sm:self-auto">
            60,000 steps / seed · dt = 0.25 ngày
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl bg-[#F6F8F5] border border-[#D8E2D8] p-4 space-y-1.5">
            <div className="text-xs font-mono font-bold text-primary">MÔI TRƯỜNG MÔ PHỎNG</div>
            <div className="text-sm font-bold text-on-surface">Student Simulator 60 bước</div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Mô phỏng 15 ngày học tập trung (dt = 0.25 ngày/bước, S0 = 3.0 ngày) với 30% tập khởi tạo từ trạng thái Placement / Shared-node.
            </p>
          </div>
          <div className="rounded-xl bg-[#F6F8F5] border border-[#D8E2D8] p-4 space-y-1.5">
            <div className="text-xs font-mono font-bold text-primary">ĐỐI CHỨNG ĐA CẤP</div>
            <div className="text-sm font-bold text-on-surface">So sánh 4 Nhóm Chính sách</div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Đánh giá GNN-PPO trên 3 hạt giống ngẫu nhiên (101, 202, 303) đối chứng cùng Heuristic DAG, Random hợp lệ và các biến thể Ablation.
            </p>
          </div>
          <div className="rounded-xl bg-[#F6F8F5] border border-[#D8E2D8] p-4 space-y-1.5">
            <div className="text-xs font-mono font-bold text-primary">ZERO-SHOT TRANSFER</div>
            <div className="text-sm font-bold text-on-surface">heldout_data_eng_graph (10 node)</div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Nhờ kiến trúc GNN bất biến kích thước đồ thị, mô hình suy luận trực tiếp trên đồ thị Data Engineering chưa từng xuất hiện lúc huấn luyện.
            </p>
          </div>
        </div>

        {/* Scientific Disclaimer per rl-evidence.md */}
        <div className="rounded-xl bg-ai-sunlit-bg border border-ai-sunlit-border/60 p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-tertiary shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-xs sm:text-sm text-ai-sunlit-text leading-relaxed">
            <strong className="font-bold">Lưu ý minh bạch khoa học:</strong> Toàn bộ kết quả huấn luyện và đối chứng GNN-PPO được đo đạc trên môi trường mô phỏng người học (*Student Simulator*) có kiểm soát. Kết quả mô phỏng chứng minh tính nhất quán và an toàn của thuật toán, không thay thế bằng chứng thực nghiệm dài hạn trên quần thể người học thật.
          </div>
        </div>
      </section>

      {/* Safe Micro-batch Online RL */}
      <section className="space-y-6">
        <div className="flex items-center gap-2.5">
          <RotateCcw className="w-5 h-5 text-primary" aria-hidden="true" />
          <h2 className="text-xl sm:text-2xl font-bold text-on-surface">
            An toàn Vận hành với Safe Micro-batch Online RL
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {ONLINE_RL_GUARDS.map((guard) => (
            <div
              key={guard.title}
              className="rounded-2xl bg-white border border-[#D8E2D8] p-5 space-y-2 shadow-xs"
            >
              <h3 className="text-sm font-bold font-mono text-primary">{guard.title}</h3>
              <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                {guard.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="rounded-2xl bg-[#F0FDF4] border border-primary/25 p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-extrabold text-on-surface">
            Trải nghiệm trực tiếp vòng lặp GNN-PPO
          </h2>
          <p className="text-sm text-on-surface-variant">
            Xem danh sách 31 khái niệm trên 3 lĩnh vực hoặc tạo tài khoản để bắt đầu đánh giá đầu vào.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => onNavigatePath('/curriculum')}
            className="px-5 py-2.5 min-h-[44px] rounded-xl bg-white border border-[#D8E2D8] text-on-surface text-sm font-semibold hover:bg-surface-container-low transition-colors"
          >
            Xem Lộ trình & Lĩnh vực
          </button>
          <button
            type="button"
            onClick={() => onNavigatePath('/register')}
            className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-primary hover:bg-primary-dim text-on-primary text-sm font-semibold transition-colors"
          >
            <span>Thử kiểm tra đầu vào</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </section>
    </div>
  )
}
