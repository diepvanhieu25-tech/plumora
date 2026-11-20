import { requestJson } from './httpClient'

export async function apiExpertCreateDomain(payload: {
  slug: string
  title: string
  description: string
}): Promise<{ slug: string; title: string; graph_version: number }> {
  return requestJson(
    '/api/v2/expert/domains',
    { method: 'POST', body: JSON.stringify(payload) },
    'Không thể tạo lĩnh vực',
  )
}

export async function apiExpertUpdateGraph(
  domainSlug: string,
  payload: {
    nodes: Array<{
      slug: string
      title: string
      tier: number
      is_shared: boolean
      lesson_markdown?: string
    }>
    edges: Array<{ concept_slug: string; prereq_slug: string }>
  },
): Promise<{ domain_slug: string; graph_version: number; dag_valid: boolean }> {
  return requestJson(
    `/api/v2/expert/domains/${domainSlug}/graph`,
    { method: 'PUT', body: JSON.stringify(payload) },
    'Lỗi kiểm tra đồ thị DAG',
  )
}

export async function apiExpertCreateQuestion(
  conceptSlug: string,
  payload: Record<string, unknown>,
): Promise<{ item_id: string }> {
  return requestJson(
    `/api/v2/expert/concepts/${conceptSlug}/questions`,
    { method: 'POST', body: JSON.stringify(payload) },
    'Lỗi lưu câu hỏi & Rubric',
  )
}

export async function apiExpertCreateCodeChallenge(
  conceptSlug: string,
  payload: Record<string, unknown>,
): Promise<{ item_id: string }> {
  return requestJson(
    `/api/v2/expert/concepts/${conceptSlug}/code-challenges`,
    { method: 'POST', body: JSON.stringify(payload) },
    'Lỗi lưu bài tập Code Sandbox',
  )
}
