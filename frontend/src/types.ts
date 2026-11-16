export interface LearnerUser {
  id: string
  username: string
  display_name: string
  state_version: number
}

export interface DagNode {
  action_id: number
  slug: string
  title: string
  tier: number
  prerequisites: string[]
  mastery_score: number
  status: 'locked' | 'unlocked' | 'mastered'
}

export interface RecentAttempt {
  attempt_id: string
  submission_id: string
  concept_action_id: number
  concept_slug: string
  correct_count: number
  attempt_score: number
  passed: boolean
  mastery_before: number
  mastery_after: number
  created_at: string
}

export interface RoadmapPayload {
  state_version: number
  mastered_count: number
  total_concepts: number
  nodes: DagNode[]
  recent_attempts?: RecentAttempt[]
}

export interface QuizQuestion {
  id: string
  display_order: number
  prompt: string
  options: Record<'A' | 'B' | 'C' | 'D', string>
}

export interface ConceptDetail {
  action_id: number
  slug: string
  title: string
  tier: number
  lesson_markdown: string
  mastery_score: number
  status: 'unlocked' | 'mastered'
  prerequisites: string[]
  questions: QuizQuestion[]
}

export interface RecommendationPayload {
  status: 'active' | 'completed'
  recommended_concept: {
    action_id: number
    slug: string
    title: string
    tier: number
    mastery_score: number
  } | null
  raw_action_id?: number | null
  policy_source: 'dqn' | 'dqn_masked_q' | 'fallback_rule' | 'completed'
  state_source: 'redis_cache' | 'postgres_cache_warm' | 'postgres_fallback'
  guardrail_applied: boolean
  degraded: boolean
  checkpoint_sha256: string | null
  state_version: number
  observation_24d: number[]
  q_values?: number[] | null
}

export interface AttemptResult {
  attempt_id: string
  submission_id: string
  idempotent_replay: boolean
  correct_count: number
  attempt_score: number
  passed: boolean
  mastery_before: number
  mastery_after: number
  state_version: number
  newly_unlocked_slugs: string[]
}

export type ActiveView = 'roadmap' | 'lesson' | 'quiz' | 'locked'
