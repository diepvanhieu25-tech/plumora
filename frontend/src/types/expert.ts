export type BackOfficeView =
  | 'expert_domains'
  | 'expert_questions'
  | 'expert_code'
  | 'expert_cohort'
  | 'admin_rl_observability'
  | 'admin_online_rl'
  | 'admin_registry'
  | 'admin_health'

export type ExpertTaskType =
  | 'mcq'
  | 'troubleshooting'
  | 'code_review'
  | 'constraint_shifting'
  | 'teach_back'

export type CodeLanguage = 'python' | 'sql' | 'javascript'

export interface ExpertDomainCreatePayload {
  slug: string
  title: string
  description: string
}

export interface ExpertDomainCreateResponse {
  slug: string
  title: string
  graph_version: number
}

export interface ExpertGraphNodeItem {
  node_idx: number
  slug: string
  title: string
  tier: number
  is_shared: boolean
  prerequisites: string[]
  lesson_markdown: string
  question_counts_by_tier: Record<string, number>
  has_code_challenge: boolean
}

export interface ExpertGraphEdge {
  concept_slug: string
  prereq_slug: string
}

export interface ExpertDomainGraphResponse {
  domain_slug: string
  title: string
  description: string
  graph_version: number
  nodes: ExpertGraphNodeItem[]
  edges: ExpertGraphEdge[]
}

export interface ExpertUpdateGraphPayload {
  nodes: Array<{
    slug: string
    title: string
    tier: number
    is_shared: boolean
    lesson_markdown?: string
  }>
  edges: ExpertGraphEdge[]
}

export interface ExpertGraphUpdateResponse {
  domain_slug: string
  graph_version: number
  dag_valid: boolean
  total_nodes: number
  shared_nodes_count: number
  published_event_id: string
}

export interface ExpertRubricCriterion {
  name: string
  weight: number
  required_keywords: string[]
  socratic_hint?: string | null
}

export interface ExpertRubric {
  criteria: ExpertRubricCriterion[]
  reference_explanation: string
}

export interface ExpertQuestionItem {
  id: string
  concept_slug: string
  depth_tier: number
  task_type: ExpertTaskType
  prompt: string
  options: Record<string, string> | null
  correct_option_key: string | null
  is_placement_eligible: boolean
  is_active: boolean
  version: number
  rubric: ExpertRubric | null
}

export interface ExpertQuestionsListResponse {
  concept_slug: string
  questions: ExpertQuestionItem[]
}

export interface ExpertQuestionWritePayload {
  depth_tier: number
  task_type: ExpertTaskType
  prompt: string
  options: Record<string, string> | null
  correct_option_key: string | null
  rubric: ExpertRubric | null
  is_active?: boolean
}

export interface ExpertQuestionWriteResponse {
  item_id: string
  concept_slug: string
  depth_tier: number
  version: number
}

export interface ExpertQuestionDeleteResponse {
  deleted: boolean
  item_id: string
}

export interface ExpertRubricDryRunPayload {
  prompt: string
  sample_answer: string
  rubric: ExpertRubric
}

export interface ExpertRubricDryRunCriterionResult {
  name: string
  weight: number
  score: number
  matched_keywords: string[]
  missing_keywords: string[]
  socratic_hint?: string | null
}

export interface ExpertRubricDryRunResponse {
  rubric_score: number
  passed: boolean
  grader_source: string
  tutor_summary: string
  criteria_results: ExpertRubricDryRunCriterionResult[]
}

export interface ExpertCodeTestCase {
  name: string
  call: string
  expected: unknown
  is_hidden: boolean
}

export interface ExpertCodeChallengeItem {
  id: string
  concept_slug: string
  title: string
  language: CodeLanguage
  prompt: string
  buggy_starter_code: string
  solution_code: string
  test_cases: ExpertCodeTestCase[]
  timeout_ms: number
  memory_limit_mb: number
  setup_sql: string | null
  is_active: boolean
  version: number
}

export interface ExpertCodeChallengesListResponse {
  concept_slug: string
  challenges: ExpertCodeChallengeItem[]
}

export interface ExpertCodeChallengeWritePayload {
  title: string
  language: CodeLanguage
  prompt: string
  buggy_starter_code: string
  solution_code: string
  test_cases: ExpertCodeTestCase[]
  timeout_ms: number
  memory_limit_mb: number
  setup_sql?: string | null
}

export interface SandboxTestResultItem {
  name: string
  passed: boolean
  actual?: unknown
  expected?: unknown
  error?: string
  runtime_ms?: number
}

export interface ExpertCodeChallengeWriteResponse {
  item_id: string
  concept_slug: string
  version: number
  validation_run: {
    solution_passed_all_tests: boolean
    starter_failed_at_least_one: boolean
    runtime_ms: number
    memory_kb: number
    test_results: SandboxTestResultItem[]
  }
}

export interface CohortConceptMetric {
  concept_slug: string
  title: string
  tier: number
  surface_count: number
  applied_count: number
  deep_count: number
  mastery_count: number
  needs_review_count: number
  bottleneck_tier: number | null
  bottleneck_events: number
}

export interface CohortAnalyticsResponse {
  domain_slug: string
  total_active_learners: number
  total_needs_review_nodes: number
  concepts: CohortConceptMetric[]
}
