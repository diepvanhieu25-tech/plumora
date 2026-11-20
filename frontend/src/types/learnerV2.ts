export interface DomainUserSummary {
  surface_count: number
  applied_count: number
  deep_count: number
  mastery_count: number
  needs_review_count: number
  placement_completed: boolean
}

export interface DomainListItem {
  slug: string
  title: string
  description: string
  total_nodes: number
  shared_nodes_count: number
  graph_version: number
  user_summary: DomainUserSummary
}

export interface DomainRoadmapNode {
  node_idx: number
  slug: string
  title: string
  tier: number
  is_shared: boolean
  prerequisites: string[]
  lesson_markdown: string
  depth_level_norm: number
  depth_label: string
  confidence: number
  stability_s: number
  retention_ebbinghaus: number
  is_eligible: boolean
  needs_review: boolean
  code_practice_score: number
}

export interface DomainRoadmapResponse {
  domain_slug: string
  domain_title: string
  graph_version: number
  nodes: DomainRoadmapNode[]
}

export interface PlacementQuestionItem {
  question_id: string
  concept_slug: string
  tier: number
  prompt: string
  options: Record<string, string>
}

export interface PlacementStartResponse {
  session_id: string
  domain_slug: string
  max_questions: number
  current_question: PlacementQuestionItem | null
}

export interface PlacementInitializedNode {
  concept_slug: string
  depth_level_norm: number
  confidence: number
  stability_s: number
}

export interface PlacementAnswerResponse {
  idempotent_replay: boolean
  step_passed: boolean
  placement_status: 'in_progress' | 'completed'
  next_question: PlacementQuestionItem | null
  initialized_nodes: PlacementInitializedNode[]
}

export interface DepthStepItem {
  question_id: string
  depth_tier: number
  task_type: string
  prompt: string
  options: Record<string, string> | null
  rubric_summary: Array<{ name: string; weight: number }> | null
}

export interface AssessmentStartResponse {
  session_id: string
  concept_slug: string
  session_mode: 'depth_probe' | 'spaced_review'
  current_depth_tier: number
  step_item: DepthStepItem
}

export interface UpdatedCompetencyOut {
  depth_level_norm: number
  depth_label: string
  confidence: number
  stability_s: number
  retention_ebbinghaus: number
}

export interface TutorFeedbackOut {
  summary: string
  criteria_results: Array<{
    name: string
    weight: number
    score: number
    matched_keywords: string[]
    missing_keywords: string[]
  }>
}

export interface AssessmentSubmitResponse {
  attempt_id: string
  idempotent_replay: boolean
  step_score: number
  step_passed: boolean
  grader_source: string
  session_status: 'active' | 'ceiling_reached' | 'completed' | 'insufficient_evidence'
  next_depth_tier: number | null
  next_step_item: DepthStepItem | null
  updated_competency: UpdatedCompetencyOut
  tutor_feedback: TutorFeedbackOut | null
}

export interface CodeChallengeOut {
  challenge_id: string
  concept_slug: string
  title: string
  language: 'python' | 'sql' | 'javascript'
  prompt: string
  buggy_starter_code: string
  public_test_cases: Array<{ name: string; call: string; expected: unknown }>
  timeout_ms: number
  memory_limit_mb: number
}

export interface CodeSandboxSubmitResponse {
  attempt_id: string
  idempotent_replay: boolean
  passed_tests: number
  total_tests: number
  code_score: number
  runtime_ms: number
  memory_kb: number
  test_results: Array<{
    name: string
    passed: boolean
    actual?: unknown
    expected?: unknown
    error?: string
  }>
  updated_competency: UpdatedCompetencyOut
}

export interface V2RecommendationResponse {
  domain_slug: string
  status: 'active' | 'completed'
  recommended_action: {
    concept_slug: string
    title: string
    tier: number
    learning_mode: 'Learn_New' | 'Deep_Probe' | 'Code_Practice' | 'Spaced_Review'
    reason_vi: string
  } | null
  policy_source: string
  state_source: string
  guardrail_applied: boolean
  retention_alert: boolean
  checkpoint_sha256: string
  node_features_snapshot?: number[][]
}
