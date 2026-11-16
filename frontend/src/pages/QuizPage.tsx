import { McqQuizForm } from '../components/quiz/McqQuizForm'
import { QuizResultCard } from '../components/quiz/QuizResultCard'
import type { AttemptResult, ConceptDetail } from '../types'

interface QuizPageProps {
  currentConcept: ConceptDetail
  submissionId: string
  selectedAnswers: Record<string, 'A' | 'B' | 'C' | 'D'>
  onSelectAnswer: (questionId: string, option: 'A' | 'B' | 'C' | 'D') => void
  onSubmit: (e: React.FormEvent) => Promise<void>
  isLoading: boolean
  quizError: string | null
  attemptResult: AttemptResult | null
  onRetry: () => void
  onBackToRoadmap: () => void
}

export function QuizPage({
  currentConcept,
  submissionId,
  selectedAnswers,
  onSelectAnswer,
  onSubmit,
  isLoading,
  quizError,
  attemptResult,
  onRetry,
  onBackToRoadmap,
}: QuizPageProps) {
  return (
    <div className="space-y-6">
      <McqQuizForm
        currentConcept={currentConcept}
        submissionId={submissionId}
        selectedAnswers={selectedAnswers}
        onSelectAnswer={onSelectAnswer}
        onSubmit={onSubmit}
        isLoading={isLoading}
        quizError={quizError}
      />

      <QuizResultCard
        attemptResult={attemptResult}
        onRetry={onRetry}
        onBackToRoadmap={onBackToRoadmap}
      />
    </div>
  )
}
