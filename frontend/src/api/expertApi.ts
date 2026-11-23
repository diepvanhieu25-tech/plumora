import type {
  CohortAnalyticsResponse,
  ExpertCodeChallengeWritePayload,
  ExpertCodeChallengeWriteResponse,
  ExpertCodeChallengesListResponse,
  ExpertDomainCreatePayload,
  ExpertDomainCreateResponse,
  ExpertDomainGraphResponse,
  ExpertGraphUpdateResponse,
  ExpertQuestionDeleteResponse,
  ExpertQuestionWritePayload,
  ExpertQuestionWriteResponse,
  ExpertQuestionsListResponse,
  ExpertRubricDryRunPayload,
  ExpertRubricDryRunResponse,
  ExpertUpdateGraphPayload,
} from '../types/expert'
import { requestJson } from './httpClient'

export async function apiExpertCreateDomain(
  payload: ExpertDomainCreatePayload,
): Promise<ExpertDomainCreateResponse> {
  return requestJson<ExpertDomainCreateResponse>(
    '/api/v2/expert/domains',
    { method: 'POST', body: JSON.stringify(payload) },
    'Không thể tạo lĩnh vực',
  )
}

export async function apiExpertGetDomainGraph(
  domainSlug: string,
): Promise<ExpertDomainGraphResponse> {
  return requestJson<ExpertDomainGraphResponse>(
    `/api/v2/expert/domains/${encodeURIComponent(domainSlug)}/graph`,
    {},
    'Không thể tải đồ thị kiến thức lĩnh vực',
  )
}

export async function apiExpertUpdateGraph(
  domainSlug: string,
  payload: ExpertUpdateGraphPayload,
): Promise<ExpertGraphUpdateResponse> {
  return requestJson<ExpertGraphUpdateResponse>(
    `/api/v2/expert/domains/${encodeURIComponent(domainSlug)}/graph`,
    { method: 'PUT', body: JSON.stringify(payload) },
    'Lỗi kiểm tra đồ thị DAG',
  )
}

export async function apiExpertListQuestions(
  conceptSlug: string,
): Promise<ExpertQuestionsListResponse> {
  return requestJson<ExpertQuestionsListResponse>(
    `/api/v2/expert/concepts/${encodeURIComponent(conceptSlug)}/questions`,
    {},
    'Không thể tải danh sách câu hỏi',
  )
}

export async function apiExpertCreateQuestion(
  conceptSlug: string,
  payload: ExpertQuestionWritePayload,
): Promise<ExpertQuestionWriteResponse> {
  return requestJson<ExpertQuestionWriteResponse>(
    `/api/v2/expert/concepts/${encodeURIComponent(conceptSlug)}/questions`,
    { method: 'POST', body: JSON.stringify(payload) },
    'Lỗi lưu câu hỏi & Rubric',
  )
}

export async function apiExpertUpdateQuestion(
  questionId: string,
  payload: ExpertQuestionWritePayload,
): Promise<ExpertQuestionWriteResponse> {
  return requestJson<ExpertQuestionWriteResponse>(
    `/api/v2/expert/questions/${encodeURIComponent(questionId)}`,
    { method: 'PUT', body: JSON.stringify(payload) },
    'Lỗi cập nhật câu hỏi & Rubric',
  )
}

export async function apiExpertDeleteQuestion(
  questionId: string,
): Promise<ExpertQuestionDeleteResponse> {
  return requestJson<ExpertQuestionDeleteResponse>(
    `/api/v2/expert/questions/${encodeURIComponent(questionId)}`,
    { method: 'DELETE' },
    'Không thể xóa câu hỏi',
  )
}

export async function apiExpertRubricDryRun(
  payload: ExpertRubricDryRunPayload,
): Promise<ExpertRubricDryRunResponse> {
  return requestJson<ExpertRubricDryRunResponse>(
    '/api/v2/expert/rubric/dry-run',
    { method: 'POST', body: JSON.stringify(payload) },
    'Không thể chạy thử bộ chấm Rubric',
  )
}

export async function apiExpertListCodeChallenges(
  conceptSlug: string,
): Promise<ExpertCodeChallengesListResponse> {
  return requestJson<ExpertCodeChallengesListResponse>(
    `/api/v2/expert/concepts/${encodeURIComponent(conceptSlug)}/code-challenges`,
    {},
    'Không thể tải danh sách bài tập Code Sandbox',
  )
}

export async function apiExpertCreateCodeChallenge(
  conceptSlug: string,
  payload: ExpertCodeChallengeWritePayload,
): Promise<ExpertCodeChallengeWriteResponse> {
  return requestJson<ExpertCodeChallengeWriteResponse>(
    `/api/v2/expert/concepts/${encodeURIComponent(conceptSlug)}/code-challenges`,
    { method: 'POST', body: JSON.stringify(payload) },
    'Lỗi kiểm chứng & lưu bài tập Code Sandbox',
  )
}

export async function apiExpertPublishCodeChallenge(
  conceptSlug: string,
  payload: ExpertCodeChallengeWritePayload,
): Promise<ExpertCodeChallengeWriteResponse> {
  return requestJson<ExpertCodeChallengeWriteResponse>(
    `/api/v2/expert/concepts/${encodeURIComponent(conceptSlug)}/code-challenges`,
    { method: 'PUT', body: JSON.stringify(payload) },
    'Lỗi kiểm chứng & xuất bản bài tập Code Sandbox',
  )
}

export async function apiExpertGetCohortAnalytics(
  domainSlug: string,
): Promise<CohortAnalyticsResponse> {
  return requestJson<CohortAnalyticsResponse>(
    `/api/v2/expert/analytics/cohort?domain_slug=${encodeURIComponent(domainSlug)}`,
    {},
    'Không thể tải dữ liệu phân tích đoàn hệ học viên',
  )
}
