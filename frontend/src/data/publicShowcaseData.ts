export interface ShowcaseConceptNode {
  slug: string
  title: string
  tier: 1 | 2 | 3 | 4
  prerequisites: string[]
  isShared?: boolean
}

export interface ShowcaseDomain {
  slug: 'backend' | 'frontend' | 'devops'
  title: string
  shortLabel: string
  nodeCount: number
  summary: string
  sandboxLanguages: string
  nodes: ShowcaseConceptNode[]
}

export const SHOWCASE_METRICS = [
  { value: '3 + 1', label: 'Lĩnh vực + Đồ thị Zero-shot', detail: 'Backend, Frontend, DevOps & Data Eng' },
  { value: '31 + 10', label: 'Khái niệm Đồ thị DAG', detail: 'Kèm 7 khái niệm liên thông đa ngành' },
  { value: '220', label: 'Câu hỏi Đào sâu 5 Tầng', detail: 'Xoay vòng tự động + Chấm điểm Rubric' },
  { value: '4 + 1', label: 'Microservices & Gateway', detail: 'Cô lập 4 Schema PostgreSQL & Redis Streams' },
] as const

export const SHOWCASE_DOMAINS: ShowcaseDomain[] = [
  {
    slug: 'backend',
    title: 'Kỹ thuật Backend & Hệ thống Phân tán',
    shortLabel: 'Backend (12 node)',
    nodeCount: 12,
    summary:
      'Từ nền tảng mạng & hệ điều hành đến thiết kế RESTful API, giao dịch ACID, bộ đệm Redis và bảo mật API thực chiến.',
    sandboxLanguages: 'Python & SQL',
    nodes: [
      { slug: 'net-internet', title: 'Internet & Mô hình Mạng cơ bản (IP, DNS, TCP/UDP)', tier: 1, prerequisites: [], isShared: true },
      { slug: 'os-basics', title: 'Hệ điều hành, Process/Thread & I/O cơ bản', tier: 1, prerequisites: [], isShared: true },
      { slug: 'web-http', title: 'Giao thức HTTP/HTTPS (Methods, Status, Headers)', tier: 2, prerequisites: ['net-internet'], isShared: true },
      { slug: 'db-relational', title: 'CSDL Quan hệ & SQL cơ bản', tier: 2, prerequisites: ['os-basics'] },
      { slug: 'db-transactions', title: 'Transaction (ACID) & Indexing trong RDBMS', tier: 2, prerequisites: ['db-relational'] },
      { slug: 'db-nosql', title: 'CSDL NoSQL (Document & Key-Value Store)', tier: 2, prerequisites: ['db-relational'] },
      { slug: 'api-rest', title: 'Thiết kế RESTful API chuẩn', tier: 3, prerequisites: ['web-http'], isShared: true },
      { slug: 'api-validation', title: 'Validation, Serialization & Xử lý lỗi API', tier: 3, prerequisites: ['api-rest'] },
      { slug: 'api-data', title: 'Kết nối API với Database & Query Patterns', tier: 3, prerequisites: ['db-transactions', 'api-rest'] },
      { slug: 'cache-redis', title: 'Caching & Quản lý State với Redis', tier: 3, prerequisites: ['db-nosql', 'api-rest'], isShared: true },
      { slug: 'sec-authn', title: 'Xác thực & Phân quyền (Session/JWT, RBAC)', tier: 4, prerequisites: ['api-rest', 'cache-redis'], isShared: true },
      { slug: 'sec-api', title: 'Bảo mật API cơ bản (SQLi, Rate Limit, CORS)', tier: 4, prerequisites: ['api-validation', 'api-data', 'sec-authn'], isShared: true },
    ],
  },
  {
    slug: 'frontend',
    title: 'Kỹ thuật Frontend & Kiến trúc Giao diện Web',
    shortLabel: 'Frontend (10 node)',
    nodeCount: 10,
    summary:
      'Làm chủ cơ chế trình duyệt, DOM & Event Loop, bất đồng bộ JavaScript, kiến trúc Component, bảo mật XSS/CSRF và tối ưu Core Web Vitals.',
    sandboxLanguages: 'JavaScript',
    nodes: [
      { slug: 'net-internet', title: 'Internet & Mô hình Mạng cơ bản (IP, DNS, TCP/UDP)', tier: 1, prerequisites: [], isShared: true },
      { slug: 'fe-dom-events', title: 'Cây DOM, Browser Rendering Pipeline & Event Loop', tier: 1, prerequisites: [] },
      { slug: 'web-http', title: 'Giao thức HTTP/HTTPS (Methods, Status, Headers, CORS)', tier: 2, prerequisites: ['net-internet'], isShared: true },
      { slug: 'fe-js-async', title: 'Bất đồng bộ trong JavaScript (Promises, Async/Await, Microtasks)', tier: 2, prerequisites: ['fe-dom-events'] },
      { slug: 'fe-component-state', title: 'Kiến trúc Component, Unidirectional Data Flow & State Management', tier: 2, prerequisites: ['fe-dom-events'] },
      { slug: 'api-rest', title: 'Thiết kế & Tích hợp RESTful API chuẩn', tier: 3, prerequisites: ['web-http'], isShared: true },
      { slug: 'fe-data-fetching', title: 'Client Data Fetching, Caching, SWR & Optimistic UI', tier: 3, prerequisites: ['fe-js-async', 'fe-component-state', 'api-rest'] },
      { slug: 'sec-authn', title: 'Xác thực & Quản lý Phiên (HttpOnly Cookie, JWT, RBAC Flow)', tier: 4, prerequisites: ['api-rest'], isShared: true },
      { slug: 'fe-xss-csrf', title: 'Bảo mật Giao diện Web (Chống XSS, CSRF, CSP & Sanitization)', tier: 4, prerequisites: ['fe-component-state', 'sec-authn'] },
      { slug: 'fe-perf-caching', title: 'Tối ưu Hiệu năng Web (Code Splitting, Memoization, Core Web Vitals)', tier: 4, prerequisites: ['fe-data-fetching'] },
    ],
  },
  {
    slug: 'devops',
    title: 'Kỹ thuật DevOps, Container & Điều phối Hạ tầng',
    shortLabel: 'DevOps (9 node)',
    nodeCount: 9,
    summary:
      'Xây dựng tư duy hạ tầng hiện đại từ Linux, Docker Container, Nginx Reverse Proxy, Redis Cluster, CI/CD đến điều phối Kubernetes.',
    sandboxLanguages: 'Python & Config Checks',
    nodes: [
      { slug: 'os-basics', title: 'Hệ điều hành Linux, Process/Thread, Filesystem & I/O cơ bản', tier: 1, prerequisites: [], isShared: true },
      { slug: 'net-internet', title: 'Internet & Mô hình Mạng cơ bản (IP, DNS, TCP/UDP, Routing)', tier: 1, prerequisites: [], isShared: true },
      { slug: 'web-http', title: 'Giao thức HTTP/HTTPS & TLS Termination', tier: 2, prerequisites: ['net-internet'], isShared: true },
      { slug: 'docker-containers', title: 'Ảo hóa mức OS, Namespaces/Cgroups & Đóng gói Docker Container', tier: 2, prerequisites: ['os-basics', 'net-internet'] },
      { slug: 'reverse-proxy-caching', title: 'Reverse Proxy, Load Balancing & HTTP Edge Caching (Nginx)', tier: 3, prerequisites: ['web-http', 'docker-containers'] },
      { slug: 'cache-redis', title: 'Vận hành Redis Cluster, Persistence (RDB/AOF) & State Store', tier: 3, prerequisites: ['docker-containers', 'web-http'], isShared: true },
      { slug: 'ci-cd-pipelines', title: 'Tự động hóa Kiểm thử, Build Artifact & Đường ống CI/CD', tier: 3, prerequisites: ['docker-containers'] },
      { slug: 'k8s-orchestration', title: 'Điều phối Container với Kubernetes (Pods, Deployments, HPA)', tier: 4, prerequisites: ['reverse-proxy-caching', 'ci-cd-pipelines', 'cache-redis'] },
      { slug: 'sec-api', title: 'Bảo mật Hạ tầng & API Gateway (Rate Limit, Secret, Network Policy)', tier: 4, prerequisites: ['reverse-proxy-caching', 'k8s-orchestration'], isShared: true },
    ],
  },
]

export const TIER_LABELS: Record<1 | 2 | 3 | 4, string> = {
  1: 'Tầng 1 · Nền tảng Cốt lõi',
  2: 'Tầng 2 · Giao thức & Thành phần Chính',
  3: 'Tầng 3 · Tích hợp & Kiến trúc Ứng dụng',
  4: 'Tầng 4 · Bảo mật & Vận hành Sản xuất',
}

export const PLAYBOOK_FIVE_SECTIONS = [
  {
    index: '01',
    title: 'Bức tranh Tổng thể & Bài toán Thực tế',
    description: 'Định vị vai trò của khái niệm trong hệ thống thật và những sự cố xảy ra khi thiếu hiểu biết nền tảng.',
  },
  {
    index: '02',
    title: 'Cơ chế Vận hành Cốt lõi',
    description: 'Giải phẫu luồng dữ liệu, giao thức và nguyên lý thiết kế dưới góc nhìn kỹ sư hệ thống.',
  },
  {
    index: '03',
    title: 'Mẫu Thiết kế & Mã nguồn Minh họa',
    description: 'Đoạn mã mẫu chuẩn hóa, so sánh cách làm tốt và các bẫy phổ biến (*anti-patterns*).',
  },
  {
    index: '04',
    title: 'Đánh đổi Kỹ thuật & Chẩn đoán Lỗi',
    description: 'Phân tích *trade-offs* về độ trễ, bộ nhớ, tính nhất quán và cách gỡ lỗi trong môi trường thực.',
  },
  {
    index: '05',
    title: 'Câu hỏi Phản tư Tương tác',
    description: 'Thẻ tự kiểm chứng tư duy ngay trong Playbook trước khi bước vào vòng đánh giá 5 tầng.',
  },
] as const

export const MICROSERVICES_ARCHITECTURE = [
  {
    name: 'API Gateway',
    port: '8000',
    schema: 'Stateless + Redis',
    role: 'Định tuyến thống nhất /api/v1/* & /api/v2/*, gắn X-Request-ID, giới hạn tần suất cửa sổ trượt (Sliding-Window Rate Limit) và kiểm soát CORS.',
  },
  {
    name: 'User & Auth Service',
    port: '8001',
    schema: 'auth_svc',
    role: 'Đăng ký, xác thực JWT HttpOnly Cookie, quản lý phiên và phân quyền chặt 3 vai trò (learner, expert, admin).',
  },
  {
    name: 'Content & KG Service',
    port: '8002',
    schema: 'content_svc',
    role: 'Lưu trữ Đồ thị tri thức đa lĩnh vực (DAG), Playbook 5 phần, Gia sư Socratic AI và không gian biên tập Expert Studio.',
  },
  {
    name: 'Assessment & Grader Service',
    port: '8003',
    schema: 'assess_svc',
    role: 'Kiểm tra đầu vào thích ứng, 5-Depth Probing, LLM Rubric Adapter (timeout 8.0s + fallback ngoại tuyến) và Code Sandbox cô lập <= 3000ms.',
  },
  {
    name: 'Recommendation & AI Service',
    port: '8004',
    schema: 'rec_ai_svc',
    role: 'Suy luận GNN-PPO (Zero-Torch), Policy Guardrail, suy giảm trí nhớ Ebbinghaus, Safe Online RL & RL Observability Analytics.',
  },
] as const
