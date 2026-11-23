import { useEffect, useRef, useState } from 'react'
import {
  ChevronDown,
  Compass,
  History,
  LogOut,
  Sprout,
} from 'lucide-react'
import { apiGetDomains } from '../api'
import { useAsyncQuery } from '../hooks/useAsyncQuery'
import { AdaptivePlacementPage } from '../pages/AdaptivePlacementPage'
import { CodeSandboxPage } from '../pages/CodeSandboxPage'
import { DepthProbePage } from '../pages/DepthProbePage'
import { LessonPlaybookPage } from '../pages/LessonPlaybookPage'
import { MultiDomainHubPage } from '../pages/MultiDomainHubPage'
import { MultiDomainRoadmapPage } from '../pages/MultiDomainRoadmapPage'
import type { AssessmentSessionMode } from '../router'
import type { ActiveView, DomainRoadmapNode, LearnerUser } from '../types'

interface LearnerAppShellProps {
  user: LearnerUser
  activeView: ActiveView
  domainSlug?: string
  conceptSlug?: string
  sessionMode?: AssessmentSessionMode
  onNavigate: (
    view: ActiveView,
    params?: {
      domainSlug?: string
      conceptSlug?: string
      sessionMode?: AssessmentSessionMode
    },
  ) => void
  onLogout: () => Promise<void>
}

export function LearnerAppShell({
  user,
  activeView,
  domainSlug = 'backend',
  conceptSlug = 'net-internet',
  sessionMode = 'depth_probe',
  onNavigate,
  onLogout,
}: LearnerAppShellProps) {
  const [playbookNode, setPlaybookNode] = useState<DomainRoadmapNode | null>(null)
  const [domainMenuOpen, setDomainMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const { data: domainsData } = useAsyncQuery((signal) => apiGetDomains(signal), [user.id, activeView])
  const domains = domainsData?.domains ?? []
  const totalDueReviews = domains.reduce((acc, d) => acc + d.user_summary.needs_review_count, 0)
  const firstReviewDomain = domains.find((d) => d.user_summary.needs_review_count > 0)
  const activeDomainObj = domains.find((d) => d.slug === domainSlug)

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setDomainMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  return (
    <div className="min-h-screen bg-background text-on-surface font-sans antialiased flex flex-col justify-between overflow-x-hidden w-full">
      {/* Clean Botanical Top Navigation Bar */}
      <header className="w-full bg-white border-b border-outline-variant/60 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2">
          {/* Brand Logo */}
          <button
            type="button"
            onClick={() => onNavigate('domains')}
            className="flex items-center gap-2.5 text-left cursor-pointer group shrink-0"
            title="Về Trung tâm Học tập Plumora"
          >
            <div className="w-9 h-9 rounded-xl bg-primary-container border border-primary/40 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors shrink-0">
              <Sprout className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <span className="font-headline font-extrabold text-base sm:text-lg text-primary tracking-tight block leading-none">
                Plumora
              </span>
              <span className="text-[11px] text-on-surface-variant font-medium hidden sm:block mt-0.5">
                Không gian Học tập Thích ứng
              </span>
            </div>
          </button>

          {/* Center / Right Learner Controls */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Quick Domain Switcher Dropdown */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setDomainMenuOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container-low hover:bg-primary-container/50 border border-outline-variant/60 text-xs font-bold text-on-surface cursor-pointer transition-colors"
                aria-expanded={domainMenuOpen}
                aria-haspopup="menu"
                data-testid="nav-multi-domain-btn"
              >
                <Compass className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
                <span className="hidden sm:inline max-w-[140px] truncate">
                  {activeView === 'domains'
                    ? 'Chuyên ngành'
                    : activeDomainObj?.title ?? domainSlug}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-outline" aria-hidden="true" />
              </button>

              {domainMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-64 rounded-xl bg-white border border-outline-variant/70 shadow-lg py-1.5 z-40"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setDomainMenuOpen(false)
                      onNavigate('domains')
                    }}
                    className={`w-full text-left px-3.5 py-2 text-xs font-bold hover:bg-surface-container-low cursor-pointer flex items-center justify-between ${
                      activeView === 'domains' ? 'text-primary bg-primary-container/30' : 'text-on-surface'
                    }`}
                  >
                    <span>Tất cả Chuyên ngành</span>
                    <span className="text-[11px] font-normal text-outline">{domains.length}</span>
                  </button>
                  {domains.length > 0 && <div className="my-1 border-t border-surface-container" />}
                  {domains.map((d) => (
                    <button
                      key={d.slug}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setDomainMenuOpen(false)
                        onNavigate('domain_roadmap', { domainSlug: d.slug })
                      }}
                      className={`w-full text-left px-3.5 py-2 text-xs hover:bg-surface-container-low cursor-pointer flex items-center justify-between gap-2 ${
                        activeView !== 'domains' && domainSlug === d.slug
                          ? 'text-primary font-bold bg-primary-container/25'
                          : 'text-on-surface font-medium'
                      }`}
                    >
                      <span className="truncate">{d.title}</span>
                      {d.user_summary.needs_review_count > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-ai-sunlit-bg text-tertiary text-[10px] font-bold shrink-0">
                          {d.user_summary.needs_review_count} ôn tập
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Real-Time Ebbinghaus Due-Review Badge */}
            {totalDueReviews > 0 && firstReviewDomain && (
              <button
                type="button"
                onClick={() => onNavigate('domain_roadmap', { domainSlug: firstReviewDomain.slug })}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-ai-sunlit-bg border border-ai-sunlit-border/50 text-ai-sunlit-text hover:bg-tertiary-container text-xs font-bold cursor-pointer transition-colors"
                title="Bạn có chủ đề đến hạn ôn tập củng cố trí nhớ"
                data-testid="header-due-reviews-btn"
              >
                <History className="w-4 h-4 text-tertiary shrink-0" aria-hidden="true" />
                <span className="hidden md:inline">Cần ôn tập</span>
                <span className="px-1.5 py-0.2 rounded-full bg-tertiary text-white text-[10px] font-mono">
                  {totalDueReviews}
                </span>
              </button>
            )}

            {/* User Pill & Logout */}
            <div className="flex items-center gap-1.5 pl-2 border-l border-outline-variant/50">
              <div className="flex items-center gap-1.5 bg-surface-container-low px-2.5 py-1.5 rounded-full border border-outline-variant/50 max-w-[130px] sm:max-w-[180px]">
                <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                <span
                  className="text-xs font-bold text-on-surface truncate"
                  data-testid="active-username"
                >
                  {user.display_name || user.username}
                </span>
              </div>
              <button
                type="button"
                onClick={() => void onLogout()}
                className="inline-flex items-center justify-center min-w-[40px] min-h-[40px] text-outline hover:text-error p-2 rounded-xl hover:bg-error-container/40 transition-colors cursor-pointer"
                title="Đăng xuất"
                data-testid="logout-btn"
                aria-label="Đăng xuất khỏi tài khoản"
              >
                <LogOut className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeView === 'domains' && (
          <MultiDomainHubPage
            onSelectDomainRoadmap={(slug) => onNavigate('domain_roadmap', { domainSlug: slug })}
            onStartPlacement={(slug) => onNavigate('placement', { domainSlug: slug })}
          />
        )}

        {activeView === 'placement' && (
          <AdaptivePlacementPage
            domainSlug={domainSlug}
            onFinished={(slug) => onNavigate('domain_roadmap', { domainSlug: slug })}
            onBack={() => onNavigate('domains')}
          />
        )}

        {activeView === 'domain_roadmap' && (
          <MultiDomainRoadmapPage
            domainSlug={domainSlug}
            onBackToHub={() => onNavigate('domains')}
            onOpenPlaybook={(dSlug, node) => {
              setPlaybookNode(node)
              onNavigate('playbook', { domainSlug: dSlug, conceptSlug: node.slug })
            }}
            onStartDepthProbe={(dSlug, cSlug) =>
              onNavigate('depth_probe', {
                domainSlug: dSlug,
                conceptSlug: cSlug,
                sessionMode: 'depth_probe',
              })
            }
            onStartCodeSandbox={(dSlug, cSlug) =>
              onNavigate('code_sandbox', { domainSlug: dSlug, conceptSlug: cSlug })
            }
            onStartReview={(dSlug, cSlug) =>
              onNavigate('depth_probe', {
                domainSlug: dSlug,
                conceptSlug: cSlug,
                sessionMode: 'spaced_review',
              })
            }
          />
        )}

        {activeView === 'playbook' && (
          <LessonPlaybookPage
            domainSlug={domainSlug}
            conceptSlug={conceptSlug}
            initialNode={playbookNode?.slug === conceptSlug ? playbookNode : null}
            onBackToRoadmap={() => onNavigate('domain_roadmap', { domainSlug })}
            onStartDepthProbe={(cSlug) =>
              onNavigate('depth_probe', {
                domainSlug,
                conceptSlug: cSlug,
                sessionMode: 'depth_probe',
              })
            }
            onStartCodeSandbox={(cSlug) =>
              onNavigate('code_sandbox', { domainSlug, conceptSlug: cSlug })
            }
          />
        )}

        {activeView === 'depth_probe' && (
          <DepthProbePage
            domainSlug={domainSlug}
            conceptSlug={conceptSlug}
            sessionMode={sessionMode}
            onBackToRoadmap={() => onNavigate('domain_roadmap', { domainSlug })}
          />
        )}

        {activeView === 'code_sandbox' && (
          <CodeSandboxPage
            domainSlug={domainSlug}
            conceptSlug={conceptSlug}
            onBackToRoadmap={() => onNavigate('domain_roadmap', { domainSlug })}
          />
        )}
      </main>

      {/* Clean Learner Footer */}
      <footer className="w-full bg-white border-t border-outline-variant/50 py-3.5 px-6 text-xs text-outline">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sprout className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
            <span className="font-semibold text-on-surface">
              Plumora — Nền tảng Học tập Thích ứng Cá nhân hóa
            </span>
          </div>
          <span className="text-[11px] text-on-surface-variant">
            Lộ trình Chuyên môn • Đánh giá Chiều sâu • Thực hành Trực tiếp • Ôn tập Bền vững
          </span>
        </div>
      </footer>
    </div>
  )
}
