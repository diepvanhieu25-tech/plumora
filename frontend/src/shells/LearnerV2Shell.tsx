import { useEffect, useState } from 'react'
import { AdaptivePlacementPage } from '../pages/AdaptivePlacementPage'
import { CodeSandboxPage } from '../pages/CodeSandboxPage'
import { DepthProbePage } from '../pages/DepthProbePage'
import { LessonPlaybookPage } from '../pages/LessonPlaybookPage'
import { MultiDomainHubPage } from '../pages/MultiDomainHubPage'
import { MultiDomainRoadmapPage } from '../pages/MultiDomainRoadmapPage'
import type { AssessmentSessionMode } from '../router'
import type { ActiveView, DomainRoadmapNode } from '../types'

interface LearnerV2ShellProps {
  activeView: ActiveView
  routeDomainSlug?: string
  routeConceptSlug?: string
  routeSessionMode?: AssessmentSessionMode
  onNavigate: (
    view: ActiveView,
    params?: {
      domainSlug?: string
      conceptSlug?: string
      sessionMode?: AssessmentSessionMode
    },
  ) => void
}

export function LearnerV2Shell({
  activeView,
  routeDomainSlug,
  routeConceptSlug,
  routeSessionMode,
  onNavigate,
}: LearnerV2ShellProps) {
  const [activeDomainSlug, setActiveDomainSlug] = useState<string>(routeDomainSlug || 'backend')
  const [activeConceptSlug, setActiveConceptSlug] = useState<string>(routeConceptSlug || 'net-internet')
  const [playbookNode, setPlaybookNode] = useState<DomainRoadmapNode | null>(null)
  const [sessionMode, setSessionMode] = useState<AssessmentSessionMode>(
    routeSessionMode || 'depth_probe',
  )

  useEffect(() => {
    if (routeDomainSlug) setActiveDomainSlug(routeDomainSlug)
  }, [routeDomainSlug])

  useEffect(() => {
    if (routeConceptSlug) setActiveConceptSlug(routeConceptSlug)
  }, [routeConceptSlug])

  useEffect(() => {
    if (routeSessionMode) setSessionMode(routeSessionMode)
  }, [routeSessionMode])

  if (activeView === 'domains') {
    return (
      <MultiDomainHubPage
        onSelectDomainRoadmap={(slug) => {
          setActiveDomainSlug(slug)
          onNavigate('domain_roadmap', { domainSlug: slug })
        }}
        onStartPlacement={(slug) => {
          setActiveDomainSlug(slug)
          onNavigate('placement', { domainSlug: slug })
        }}
      />
    )
  }

  if (activeView === 'placement') {
    return (
      <AdaptivePlacementPage
        domainSlug={activeDomainSlug}
        onFinished={(slug) => {
          setActiveDomainSlug(slug)
          onNavigate('domain_roadmap', { domainSlug: slug })
        }}
        onBack={() => onNavigate('domains')}
      />
    )
  }

  if (activeView === 'domain_roadmap') {
    return (
      <MultiDomainRoadmapPage
        domainSlug={activeDomainSlug}
        onBackToHub={() => onNavigate('domains')}
        onOpenPlaybook={(dSlug, node) => {
          setActiveDomainSlug(dSlug)
          setActiveConceptSlug(node.slug)
          setPlaybookNode(node)
          onNavigate('playbook', { domainSlug: dSlug, conceptSlug: node.slug })
        }}
        onStartDepthProbe={(dSlug, cSlug) => {
          setActiveDomainSlug(dSlug)
          setActiveConceptSlug(cSlug)
          setSessionMode('depth_probe')
          onNavigate('depth_probe', {
            domainSlug: dSlug,
            conceptSlug: cSlug,
            sessionMode: 'depth_probe',
          })
        }}
        onStartCodeSandbox={(dSlug, cSlug) => {
          setActiveDomainSlug(dSlug)
          setActiveConceptSlug(cSlug)
          onNavigate('code_sandbox', { domainSlug: dSlug, conceptSlug: cSlug })
        }}
        onStartReview={(dSlug, cSlug) => {
          setActiveDomainSlug(dSlug)
          setActiveConceptSlug(cSlug)
          setSessionMode('spaced_review')
          onNavigate('depth_probe', {
            domainSlug: dSlug,
            conceptSlug: cSlug,
            sessionMode: 'spaced_review',
          })
        }}
      />
    )
  }

  if (activeView === 'playbook') {
    return (
      <LessonPlaybookPage
        domainSlug={activeDomainSlug}
        conceptSlug={activeConceptSlug}
        initialNode={playbookNode?.slug === activeConceptSlug ? playbookNode : null}
        onBackToRoadmap={() => onNavigate('domain_roadmap', { domainSlug: activeDomainSlug })}
        onStartDepthProbe={(cSlug) => {
          setActiveConceptSlug(cSlug)
          setSessionMode('depth_probe')
          onNavigate('depth_probe', {
            domainSlug: activeDomainSlug,
            conceptSlug: cSlug,
            sessionMode: 'depth_probe',
          })
        }}
        onStartCodeSandbox={(cSlug) => {
          setActiveConceptSlug(cSlug)
          onNavigate('code_sandbox', { domainSlug: activeDomainSlug, conceptSlug: cSlug })
        }}
      />
    )
  }

  if (activeView === 'depth_probe') {
    return (
      <DepthProbePage
        domainSlug={activeDomainSlug}
        conceptSlug={activeConceptSlug}
        sessionMode={sessionMode}
        onBackToRoadmap={() => onNavigate('domain_roadmap', { domainSlug: activeDomainSlug })}
      />
    )
  }

  if (activeView === 'code_sandbox') {
    return (
      <CodeSandboxPage
        domainSlug={activeDomainSlug}
        conceptSlug={activeConceptSlug}
        onBackToRoadmap={() => onNavigate('domain_roadmap', { domainSlug: activeDomainSlug })}
      />
    )
  }

  return null
}
