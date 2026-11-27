import {
  ArrowRight,
  BookOpen,
  Cpu,
  Database,
  Layers,
  Server,
  Shield,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { MICROSERVICES_ARCHITECTURE } from '../data/publicShowcaseData'

interface PublicAboutPageProps {
  onNavigatePath: (path: string) => void
}

const ROLE_CARDS = [
  {
    icon: Users,
    role: 'Người học (Learner)',
    portal: 'Learner Web Client',
    ctaLabel: 'Đăng nhập Học viên',
    ctaPath: '/login',
    capabilities: [
      'Đánh giá đầu vào thích ứng theo từng lĩnh vực.',
      'Theo dõi Đồ thị tri thức đa lĩnh vực & gợi ý 3 bước tiếp theo từ GNN-PPO.',
      'Học Playbook 5 phần, làm 5-Depth Probing với Gia sư Socratic & Code Sandbox.',
    ],
  },
  {
    icon: BookOpen,
    role: 'Chuyên gia (Expert Studio)',
    portal: 'Back-Office Console',
    ctaLabel: 'Vào cổng Chuyên gia',
    ctaPath: '/expert/login',
    capabilities: [
      'Quản lý Lĩnh vực, Playbook Markdown 5 phần (lưu cục bộ + xem trước thống nhất).',
      'Biên tập ngân hàng 220 câu hỏi 5 tầng & tự động cân bằng trọng số Rubric = 1.0.',
      'Soạn bài tập Code Sandbox và chạy kiểm thử kép (Dry-Run) trước khi xuất bản.',
    ],
  },
  {
    icon: Shield,
    role: 'Quản trị & MLOps (Admin)',
    portal: 'Back-Office Console',
    ctaLabel: 'Vào cổng Quản trị',
    ctaPath: '/admin/login',
    capabilities: [
      'Giám sát RL Observability (phân bố chế độ, lĩnh vực, nhật ký quyết định thực).',
      'Vận hành vòng lặp Safe Micro-batch Online RL, Safety Gate & 1-Click Rollback.',
      'Theo dõi Model Registry, sức khỏe 4 Microservices và phân tích nhóm học viên.',
    ],
  },
] as const

const TECH_STACK = [
  { group: 'Frontend', items: 'React 19, TypeScript, Vite, Tailwind CSS, Nginx (non-root)' },
  { group: 'Backend Microservices', items: 'FastAPI, Python 3.12, SQLAlchemy 2, Pydantic v2, Uvicorn' },
  { group: 'Học tăng cường (RL)', items: 'PyTorch GNN-PPO (huấn luyện), Zero-Torch plumora_rl (suy luận)' },
  { group: 'Dữ liệu & Sự kiện', items: 'PostgreSQL 16 (4 Schema cô lập), Redis 7 (Streams & Rate Limit)' },
  { group: 'Hạ tầng & Kiểm định', items: 'Docker Compose, Kubernetes Blueprint (k8s/), CI 7 cổng + Chromium E2E' },
] as const

export function PublicAboutPage({ onNavigatePath }: PublicAboutPageProps) {
  return (
    <div data-testid="pub04-about-page" className="max-w-7xl mx-auto px-4 sm:px-6 py-12 lg:py-16 space-y-14">
      {/* Header */}
      <header className="max-w-3xl space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-container/80 border border-primary/20 text-on-primary-container text-xs font-semibold">
          <Server className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
          <span>Về Dự án & Kiến trúc Hệ thống Plumora v4.1</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-on-surface">
          Kiến trúc 4 Microservices tách biệt, sẵn sàng kiểm định
        </h1>
        <p className="text-base text-on-surface-variant leading-relaxed">
          Plumora là đồ án tốt nghiệp nghiên cứu và xây dựng hệ thống gợi ý, quản lý lộ trình học tập thích ứng bằng Học tăng cường. Toàn bộ hệ thống vận hành qua Docker Compose với ranh giới dịch vụ, cơ sở dữ liệu và cổng truy cập tách bạch hoàn toàn.
        </p>
      </header>

      {/* Microservices Architecture Blueprint */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-bold text-on-surface">
              Sơ đồ 4 Microservices + API Gateway
            </h2>
            <p className="text-sm text-on-surface-variant">
              Mỗi dịch vụ sở hữu schema PostgreSQL riêng biệt và kết nối bất đồng bộ qua Redis Streams.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-mono px-3 py-1 rounded-lg bg-white border border-[#D8E2D8] text-on-surface-variant self-start sm:self-auto">
            <Database className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
            <span>PostgreSQL 16 + Redis 7</span>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {MICROSERVICES_ARCHITECTURE.map((svc) => (
            <div
              key={svc.name}
              className="rounded-2xl bg-white border border-[#D8E2D8] p-5 space-y-3 shadow-xs flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-on-surface">{svc.name}</span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-primary-container/70 text-on-primary-container font-semibold">
                    :{svc.port}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                  {svc.role}
                </p>
              </div>
              <div className="pt-2.5 border-t border-[#D8E2D8]/80 flex items-center justify-between text-[11px] font-mono text-outline">
                <span>Schema / Store</span>
                <span className="font-semibold text-on-surface">{svc.schema}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3-Role Dual-Portal Matrix */}
      <section className="space-y-6">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
            <ShieldCheck className="w-4 h-4" aria-hidden="true" />
            <span>Phân tách 2 Cổng Ứng dụng & 3 Vai trò RBAC</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-on-surface">
            Không gian làm việc chuyên biệt cho từng đối tượng
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {ROLE_CARDS.map((card) => {
            const Icon = card.icon
            return (
              <div
                key={card.role}
                className="rounded-2xl bg-white border border-[#D8E2D8] p-6 flex flex-col justify-between gap-5 shadow-xs"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="w-10 h-10 rounded-xl bg-[#F6F8F5] border border-[#D8E2D8] text-primary flex items-center justify-center">
                      <Icon className="w-5 h-5" aria-hidden="true" />
                    </span>
                    <span className="text-[11px] font-mono px-2.5 py-1 rounded-md bg-surface-container-low text-on-surface-variant border border-[#D8E2D8]">
                      {card.portal}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-on-surface">{card.role}</h3>
                  <ul className="space-y-2 text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                    {card.capabilities.map((cap) => (
                      <li key={cap} className="flex items-start gap-2">
                        <Layers className="w-3.5 h-3.5 text-primary shrink-0 mt-1" aria-hidden="true" />
                        <span>{cap}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={() => onNavigatePath(card.ctaPath)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl border border-[#D8E2D8] bg-[#F6F8F5] hover:bg-primary hover:text-on-primary hover:border-primary text-on-surface text-sm font-semibold transition-colors"
                >
                  <span>{card.ctaLabel}</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            )
          })}
        </div>
      </section>

      {/* Tech Stack Summary */}
      <section className="rounded-2xl bg-white border border-[#D8E2D8] p-6 sm:p-8 space-y-5 shadow-xs">
        <div className="flex items-center gap-2.5">
          <Cpu className="w-5 h-5 text-primary" aria-hidden="true" />
          <h2 className="text-xl font-bold text-on-surface">
            Ngăn xếp Công nghệ (Tech Stack)
          </h2>
        </div>
        <div className="divide-y divide-[#D8E2D8]/80">
          {TECH_STACK.map((row) => (
            <div
              key={row.group}
              className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5"
            >
              <span className="text-sm font-bold text-on-surface sm:w-56 shrink-0">
                {row.group}
              </span>
              <span className="text-xs sm:text-sm font-mono text-on-surface-variant">
                {row.items}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
