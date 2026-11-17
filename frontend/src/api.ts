import type {
  AttemptHistoryPayload,
  AttemptResult,
  ConceptDetail,
  DagNode,
  LearnerUser,
  RecommendationPayload,
  RoadmapPayload,
} from './types'

export const FALLBACK_CONCEPTS_DAG: DagNode[] = [
  {
    action_id: 0,
    slug: 'net-internet',
    title: 'Internet & Mô hình Mạng cơ bản (IP, DNS, TCP/UDP)',
    tier: 1,
    prerequisites: [],
    mastery_score: 1.0,
    status: 'mastered',
  },
  {
    action_id: 1,
    slug: 'os-basics',
    title: 'Hệ điều hành, Process/Thread & I/O cơ bản',
    tier: 1,
    prerequisites: [],
    mastery_score: 0.75,
    status: 'mastered',
  },
  {
    action_id: 2,
    slug: 'web-http',
    title: 'Giao thức HTTP/HTTPS (Methods, Status, Headers)',
    tier: 2,
    prerequisites: ['net-internet'],
    mastery_score: 0.75,
    status: 'mastered',
  },
  {
    action_id: 3,
    slug: 'db-relational',
    title: 'CSDL Quan hệ & SQL cơ bản',
    tier: 2,
    prerequisites: ['os-basics'],
    mastery_score: 0.75,
    status: 'mastered',
  },
  {
    action_id: 4,
    slug: 'db-transactions',
    title: 'Transaction (ACID) & Indexing trong RDBMS',
    tier: 2,
    prerequisites: ['db-relational'],
    mastery_score: 0.0,
    status: 'unlocked',
  },
  {
    action_id: 5,
    slug: 'db-nosql',
    title: 'CSDL NoSQL (Document & Key-Value Store)',
    tier: 2,
    prerequisites: ['db-relational'],
    mastery_score: 0.25,
    status: 'unlocked',
  },
  {
    action_id: 6,
    slug: 'api-rest',
    title: 'Thiết kế RESTful API chuẩn',
    tier: 3,
    prerequisites: ['web-http'],
    mastery_score: 0.0,
    status: 'unlocked',
  },
  {
    action_id: 7,
    slug: 'api-validation',
    title: 'Validation, Serialization & Xử lý lỗi API',
    tier: 3,
    prerequisites: ['api-rest'],
    mastery_score: 0.0,
    status: 'locked',
  },
  {
    action_id: 8,
    slug: 'api-data',
    title: 'Kết nối API với Database & Query Patterns',
    tier: 3,
    prerequisites: ['db-transactions', 'api-rest'],
    mastery_score: 0.0,
    status: 'locked',
  },
  {
    action_id: 9,
    slug: 'cache-redis',
    title: 'Caching & Quản lý State với Redis',
    tier: 3,
    prerequisites: ['db-nosql', 'api-rest'],
    mastery_score: 0.0,
    status: 'locked',
  },
  {
    action_id: 10,
    slug: 'sec-authn',
    title: 'Xác thực & Phân quyền (Session/JWT, RBAC)',
    tier: 4,
    prerequisites: ['api-rest', 'cache-redis'],
    mastery_score: 0.0,
    status: 'locked',
  },
  {
    action_id: 11,
    slug: 'sec-api',
    title: 'Bảo mật API cơ bản (SQLi, Rate Limit, CORS)',
    tier: 4,
    prerequisites: ['api-validation', 'api-data', 'sec-authn'],
    mastery_score: 0.0,
    status: 'locked',
  },
]

export const FALLBACK_RECOMMENDATION: RecommendationPayload = {
  status: 'active',
  recommended_concept: {
    action_id: 4,
    slug: 'db-transactions',
    title: 'Transaction (ACID) & Indexing trong RDBMS',
    tier: 2,
    mastery_score: 0.0,
  },
  raw_action_id: 4,
  policy_source: 'dqn',
  state_source: 'redis_cache',
  guardrail_applied: false,
  degraded: false,
  checkpoint_sha256: 'e464fa638cee04fda6a386ffb6cdf24d9190d0f1167feb56d4da0063499a6b6b',
  state_version: 5,
  observation_24d: [
    1.0, 0.75, 0.75, 0.75, 0.0, 0.25, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0, 1.0, 1.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0,
  ],
}

export const FALLBACK_CONCEPT_DETAIL: ConceptDetail = {
  action_id: 4,
  slug: 'db-transactions',
  title: 'Transaction (ACID) & Indexing trong RDBMS',
  tier: 2,
  lesson_markdown: `## 1. Bốn tính chất ACID của Giao dịch Cơ sở dữ liệu

| Thuộc tính | Ý nghĩa Kỹ thuật trong Plumora |
| --- | --- |
| **Atomicity (Nguyên tử)** | Khi nộp Quiz, việc ghi \`quiz_attempts\`, cập nhật \`user_concept_mastery\` và tăng \`state_version\` hoặc thành công trọn vẹn (\`COMMIT\`), hoặc hủy bỏ hoàn toàn (\`ROLLBACK\`). |
| **Consistency (Nhất quán)** | Dữ liệu luôn thỏa mãn mọi ràng buộc \`PK\`, \`FK\`, \`UNIQUE(user_id, submission_id)\` và \`CHECK (0.0 <= mastery_score <= 1.0)\`. |
| **Isolation (Cô lập)** | Các giao dịch đồng thời không làm sai lệch điểm \`mastery = max(old, score)\` nhờ khóa dòng (\`SELECT ... FOR UPDATE\`). |
| **Durability (Bền vững)** | Sau khi \`COMMIT\`, kết quả được ghi vào Write-Ahead Log (\`WAL\`) của PostgreSQL, không mất khi khởi động lại. |

\`\`\`sql
BEGIN;
SELECT state_version FROM users WHERE id = :user_id FOR UPDATE;
INSERT INTO quiz_attempts (...) VALUES (...);
UPDATE user_concept_mastery SET mastery_score = GREATEST(mastery_score, :score) WHERE ...;
UPDATE users SET state_version = state_version + 1 WHERE id = :user_id;
COMMIT;
\`\`\`

## 2. Đánh đổi khi thiết kế B-Tree Index

- **Ưu điểm:** Giảm độ phức tạp tìm kiếm từ quét tuần tự \`O(N)\` (\`Seq Scan\`) xuống \`O(log N)\` (\`Index Scan\`) trên các cột tra cứu thường xuyên (\`username\`, \`(user_id, submission_id)\`).
- **Đánh đổi (Trade-off):** Tốn thêm dung lượng lưu trữ và tăng chi phí ghi (\`INSERT/UPDATE/DELETE\`) do phải cập nhật cây chỉ mục.`,
  mastery_score: 0.0,
  status: 'unlocked',
  prerequisites: ['db-relational'],
  questions: [
    {
      id: '00000000-0000-4000-8000-000000000401',
      display_order: 1,
      prompt:
        'Tính chất nào trong bộ ACID đảm bảo rằng một giao dịch (Transaction) hoặc được thực hiện trọn vẹn tất cả các bước, hoặc không có bước nào được ghi nhận nếu xảy ra lỗi giữa chừng?',
      options: {
        A: 'Atomicity (Tính nguyên tử)',
        B: 'Consistency (Tính nhất quán)',
        C: 'Isolation (Tính cô lập)',
        D: 'Durability (Tính bền vững)',
      },
    },
    {
      id: '00000000-0000-4000-8000-000000000402',
      display_order: 2,
      prompt:
        'Khi hai yêu cầu nộp bài của cùng một người dùng đến đồng thời, câu lệnh nào trong PostgreSQL giúp khóa dòng người dùng để tránh Lost Update?',
      options: {
        A: 'SELECT ... FOR UPDATE trong một ACID Transaction',
        B: 'SELECT DISTINCT không có giao dịch',
        C: 'DROP TABLE users',
        D: 'EXPLAIN ANALYZE',
      },
    },
    {
      id: '00000000-0000-4000-8000-000000000403',
      display_order: 3,
      prompt:
        'Đánh chỉ mục B-Tree (Index) trên cặp cột (user_id, submission_id) mang lại lợi ích và đánh đổi nào?',
      options: {
        A: 'Tăng tốc truy vấn kiểm tra nộp trùng từ O(N) xuống O(log N), nhưng tốn thêm chi phí cập nhật chỉ mục khi INSERT',
        B: 'Làm cho mọi câu lệnh INSERT nhanh gấp 100 lần mà không tốn bộ nhớ',
        C: 'Tự động xóa các bản ghi cũ sau 60 giây',
        D: 'Biến bảng quan hệ thành bộ nhớ đệm Redis',
      },
    },
    {
      id: '00000000-0000-4000-8000-000000000404',
      display_order: 4,
      prompt:
        'Thành phần nào của PostgreSQL đảm bảo tính Bền vững (Durability) để dữ liệu đã COMMIT không bị mất khi sập nguồn đột ngột?',
      options: {
        A: 'Nhật ký ghi trước WAL (Write-Ahead Logging) được đồng bộ xuống đĩa',
        B: 'Biến tạm trong bộ nhớ RAM của trình duyệt',
        C: 'Bộ nhớ đệm DNS của nhà mạng',
        D: 'File CSS của giao diện Frontend',
      },
    },
  ],
}

let authToken: string | null = null

export function setAuthToken(token: string | null): void {
  authToken = token
}

function buildHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`
  }
  return headers
}

export async function apiLogin(
  username: string,
  password: string,
): Promise<{ user: LearnerUser; access_token: string }> {
  const res = await fetch('/api/v1/auth/login', {
    method: 'POST',
    headers: buildHeaders(),
    credentials: 'include',
    body: JSON.stringify({ username, password }),
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.message || 'Đăng nhập thất bại')
  }
  if (data.access_token) {
    authToken = data.access_token
  }
  return data
}

export async function apiRegister(
  username: string,
  displayName: string,
  password: string,
): Promise<{ user: LearnerUser; access_token: string }> {
  const res = await fetch('/api/v1/auth/register', {
    method: 'POST',
    headers: buildHeaders(),
    credentials: 'include',
    body: JSON.stringify({ username, display_name: displayName, password }),
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.message || 'Đăng ký thất bại')
  }
  if (data.access_token) {
    authToken = data.access_token
  }
  return data
}

export async function apiLogout(): Promise<void> {
  await fetch('/api/v1/auth/logout', {
    method: 'POST',
    headers: buildHeaders(),
    credentials: 'include',
  })
  authToken = null
}

export async function apiGetMe(): Promise<LearnerUser | null> {
  try {
    const res = await fetch('/api/v1/auth/me', {
      headers: buildHeaders(),
      credentials: 'include',
    })
    if (!res.ok) return null
    return (await res.json()) as LearnerUser
  } catch {
    return null
  }
}

export async function apiGetRoadmap(): Promise<RoadmapPayload> {
  const res = await fetch('/api/v1/roadmap', {
    headers: buildHeaders(),
    credentials: 'include',
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.message || 'Không thể tải bản đồ lộ trình')
  }
  return data as RoadmapPayload
}

export async function apiGetRecommendation(): Promise<RecommendationPayload> {
  const res = await fetch('/api/v1/recommendations', {
    method: 'POST',
    headers: buildHeaders(),
    credentials: 'include',
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.message || 'Không thể lấy khuyến nghị AI')
  }
  return data as RecommendationPayload
}

export async function apiGetConceptDetail(
  slug: string,
): Promise<{ ok: true; data: ConceptDetail } | { ok: false; locked: boolean; message: string; missingPrerequisites: string[] }> {
  const res = await fetch(`/api/v1/concepts/${slug}`, {
    headers: buildHeaders(),
    credentials: 'include',
  })
  const payload = await res.json()
  if (res.status === 403 && payload.error_code === 'CONCEPT_LOCKED') {
    return {
      ok: false,
      locked: true,
      message: payload.message,
      missingPrerequisites: payload.details?.missing_prerequisites ?? [],
    }
  }
  if (!res.ok) {
    return {
      ok: false,
      locked: false,
      message: payload.message || 'Lỗi tải bài học',
      missingPrerequisites: [],
    }
  }
  return { ok: true, data: payload as ConceptDetail }
}

export async function apiSubmitAttempt(
  slug: string,
  submissionId: string,
  answers: Array<{ question_id: string; selected_option: 'A' | 'B' | 'C' | 'D' }>,
): Promise<AttemptResult> {
  const res = await fetch(`/api/v1/concepts/${slug}/attempts`, {
    method: 'POST',
    headers: buildHeaders(),
    credentials: 'include',
    body: JSON.stringify({
      submission_id: submissionId,
      answers,
    }),
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.message || 'Lỗi khi nộp bài kiểm tra')
  }
  return data as AttemptResult
}

export async function apiApplyPreset(presetKey: string): Promise<RoadmapPayload> {
  const res = await fetch('/api/v1/me/preset', {
    method: 'POST',
    headers: buildHeaders(),
    credentials: 'include',
    body: JSON.stringify({ preset_key: presetKey }),
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.message || 'Lỗi khi áp dụng Hồ sơ mẫu')
  }
  return data as RoadmapPayload
}

export async function apiGetAttemptHistory(limit: number = 50): Promise<AttemptHistoryPayload> {
  const res = await fetch(`/api/v1/assessment/history?limit=${limit}`, {
    headers: buildHeaders(),
    credentials: 'include',
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.message || 'Không thể tải lịch sử làm bài')
  }
  return data as AttemptHistoryPayload
}
