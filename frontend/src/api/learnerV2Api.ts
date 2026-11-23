import type {
  AssessmentAbandonResponse,
  AssessmentStartResponse,
  AssessmentSubmitResponse,
  CodeChallengeOut,
  CodeSandboxSubmitResponse,
  ConceptPlaybookDetailResponse,
  DomainListItem,
  DomainRoadmapResponse,
  PlacementAnswerResponse,
  PlacementStartResponse,
  PlaybookCompleteResponse,
  V2RecommendationResponse,
} from '../types'
import { requestJson } from './httpClient'

export async function apiGetDomains(signal?: AbortSignal): Promise<{ domains: DomainListItem[] }> {
  return requestJson('/api/v2/domains', { signal }, 'Không thể tải danh sách chuyên ngành')
}

export async function apiGetDomainRoadmap(
  domainSlug: string,
  signal?: AbortSignal,
): Promise<DomainRoadmapResponse> {
  return requestJson(
    `/api/v2/domains/${encodeURIComponent(domainSlug)}/roadmap`,
    { signal },
    'Không thể tải bản đồ lộ trình học tập',
  )
}

export async function apiGetConceptPlaybook(
  domainSlug: string,
  conceptSlug: string,
  signal?: AbortSignal,
): Promise<ConceptPlaybookDetailResponse> {
  return requestJson(
    `/api/v2/domains/${encodeURIComponent(domainSlug)}/concepts/${encodeURIComponent(conceptSlug)}`,
    { signal },
    'Không thể tải nội dung bài học',
  )
}

export async function apiCompletePlaybook(
  domainSlug: string,
  conceptSlug: string,
  submissionId?: string,
  quickCheckAnswers: Array<Record<string, string>> = [],
): Promise<PlaybookCompleteResponse> {
  return requestJson(
    `/api/v2/domains/${encodeURIComponent(domainSlug)}/concepts/${encodeURIComponent(conceptSlug)}/playbook/complete`,
    {
      method: 'POST',
      body: JSON.stringify({
        submission_id: submissionId ?? null,
        quick_check_answers: quickCheckAnswers,
      }),
    },
    'Không thể xác nhận hoàn thành bài học lý thuyết',
  )
}

export async function apiStartPlacement(domainSlug: string): Promise<PlacementStartResponse> {
  return requestJson(
    `/api/v2/domains/${encodeURIComponent(domainSlug)}/placement/start`,
    { method: 'POST' },
    'Không thể bắt đầu bài đánh giá định vị đầu vào',
  )
}

export async function apiSubmitPlacementAnswer(
  domainSlug: string,
  sessionId: string,
  submissionId: string,
  questionId: string,
  selectedOption: string,
): Promise<PlacementAnswerResponse> {
  return requestJson(
    `/api/v2/domains/${encodeURIComponent(domainSlug)}/placement/${encodeURIComponent(sessionId)}/answer`,
    {
      method: 'POST',
      body: JSON.stringify({
        submission_id: submissionId,
        question_id: questionId,
        selected_option: selectedOption,
      }),
    },
    'Lỗi khi nộp câu trả lời định vị',
  )
}

export async function apiStartAssessmentV2(
  domainSlug: string,
  conceptSlug: string,
  sessionMode: 'depth_probe' | 'spaced_review',
): Promise<AssessmentStartResponse> {
  return requestJson(
    '/api/v2/assessments/start',
    {
      method: 'POST',
      body: JSON.stringify({
        domain_slug: domainSlug,
        concept_slug: conceptSlug,
        session_mode: sessionMode,
      }),
    },
    'Không thể mở phiên đánh giá',
  )
}

export async function apiSubmitAssessmentV2(
  sessionId: string,
  payload: {
    submission_id: string
    question_id: string
    selected_option?: string | null
    written_explanation?: string | null
  },
): Promise<AssessmentSubmitResponse> {
  return requestJson(
    `/api/v2/assessments/${encodeURIComponent(sessionId)}/submit`,
    { method: 'POST', body: JSON.stringify(payload) },
    'Lỗi khi nộp bước đánh giá',
  )
}

export async function apiAbandonAssessmentV2(
  sessionId: string,
): Promise<AssessmentAbandonResponse> {
  return requestJson(
    `/api/v2/assessments/${encodeURIComponent(sessionId)}/abandon`,
    { method: 'POST' },
    'Không thể dừng phiên đánh giá',
  )
}

export async function apiGetCodeChallenge(
  conceptSlug: string,
  domainSlug?: string,
  signal?: AbortSignal,
): Promise<CodeChallengeOut> {
  const query = domainSlug ? `?domain_slug=${encodeURIComponent(domainSlug)}` : ''
  return requestJson(
    `/api/v2/concepts/${encodeURIComponent(conceptSlug)}/code-challenge${query}`,
    { signal },
    'Chủ đề này chưa có bài tập thực hành lập trình',
  )
}

export async function apiSubmitCodeSandbox(
  conceptSlug: string,
  payload: {
    submission_id: string
    challenge_id: string
    language: 'python' | 'sql' | 'javascript'
    source_code: string
  },
  domainSlug?: string,
): Promise<CodeSandboxSubmitResponse> {
  const query = domainSlug ? `?domain_slug=${encodeURIComponent(domainSlug)}` : ''
  return requestJson(
    `/api/v2/concepts/${encodeURIComponent(conceptSlug)}/code-sandbox/submit${query}`,
    { method: 'POST', body: JSON.stringify(payload) },
    'Lỗi thực thi bài tập lập trình',
  )
}

export async function apiGetV2Recommendation(
  domainSlug: string,
  signal?: AbortSignal,
): Promise<V2RecommendationResponse> {
  return requestJson(
    '/api/v2/recommendations',
    { method: 'POST', body: JSON.stringify({ domain_slug: domainSlug }), signal },
    'Không thể lấy gợi ý bước học tiếp theo',
  )
}
