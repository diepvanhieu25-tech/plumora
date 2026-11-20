import type {
  AssessmentStartResponse,
  AssessmentSubmitResponse,
  CodeChallengeOut,
  CodeSandboxSubmitResponse,
  DomainListItem,
  DomainRoadmapResponse,
  PlacementAnswerResponse,
  PlacementStartResponse,
  V2RecommendationResponse,
} from '../types'
import { requestJson } from './httpClient'

export async function apiGetDomains(): Promise<{ domains: DomainListItem[] }> {
  return requestJson('/api/v2/domains', {}, 'Không thể tải danh sách lĩnh vực')
}

export async function apiGetDomainRoadmap(
  domainSlug: string,
  simulatedTimeOffsetDays: number = 0,
): Promise<DomainRoadmapResponse> {
  const query =
    simulatedTimeOffsetDays > 0
      ? `?simulated_time_offset_days=${encodeURIComponent(String(simulatedTimeOffsetDays))}`
      : ''
  return requestJson(
    `/api/v2/domains/${domainSlug}/roadmap${query}`,
    {},
    'Không thể tải bản đồ lĩnh vực',
  )
}

export async function apiStartPlacement(domainSlug: string): Promise<PlacementStartResponse> {
  return requestJson(
    `/api/v2/domains/${domainSlug}/placement/start`,
    { method: 'POST' },
    'Không thể bắt đầu chẩn đoán đầu vào',
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
    `/api/v2/domains/${domainSlug}/placement/${sessionId}/answer`,
    {
      method: 'POST',
      body: JSON.stringify({
        submission_id: submissionId,
        question_id: questionId,
        selected_option: selectedOption,
      }),
    },
    'Lỗi khi nộp câu chẩn đoán',
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
    `/api/v2/assessments/${sessionId}/submit`,
    { method: 'POST', body: JSON.stringify(payload) },
    'Lỗi khi nộp bước đánh giá',
  )
}

export async function apiGetCodeChallenge(conceptSlug: string): Promise<CodeChallengeOut> {
  return requestJson(
    `/api/v2/concepts/${conceptSlug}/code-challenge`,
    {},
    'Khái niệm chưa có bài tập Code Sandbox',
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
): Promise<CodeSandboxSubmitResponse> {
  return requestJson(
    `/api/v2/concepts/${conceptSlug}/code-sandbox/submit`,
    { method: 'POST', body: JSON.stringify(payload) },
    'Lỗi thực thi Sandbox',
  )
}

export async function apiGetV2Recommendation(
  domainSlug: string,
): Promise<V2RecommendationResponse> {
  return requestJson(
    '/api/v2/recommendations',
    { method: 'POST', body: JSON.stringify({ domain_slug: domainSlug }) },
    'Không thể lấy khuyến nghị lộ trình',
  )
}
