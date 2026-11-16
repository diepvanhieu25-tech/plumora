import { LockedAlert } from '../components/alert/LockedAlert'
import { LessonReader } from '../components/lesson/LessonReader'
import type { ConceptDetail } from '../types'

interface LessonPageProps {
  currentConcept: ConceptDetail
  lockedErrorInfo: {
    slug: string
    message: string
    missingPrerequisites: string[]
  } | null
  onGoToQuiz: () => void
  onBackToRoadmap: () => void
}

export function LessonPage({
  currentConcept,
  lockedErrorInfo,
  onGoToQuiz,
  onBackToRoadmap,
}: LessonPageProps) {
  if (lockedErrorInfo) {
    return (
      <LockedAlert
        lockedErrorInfo={lockedErrorInfo}
        onBackToRoadmap={onBackToRoadmap}
      />
    )
  }

  return (
    <LessonReader
      currentConcept={currentConcept}
      onGoToQuiz={onGoToQuiz}
    />
  )
}
