import { describe, expect, it } from 'vitest'

const MAX_LINES = 550

const ALL_SOURCE_RAW = import.meta.glob<string>(
  [
    '../pages/**/*.{ts,tsx}',
    '../components/**/*.{ts,tsx}',
    '../shells/**/*.{ts,tsx}',
    '../hooks/**/*.{ts,tsx}',
    '../api/**/*.{ts,tsx}',
    '../core/**/*.{ts,tsx}',
    '../utils/**/*.{ts,tsx}',
    '../router.ts',
  ],
  { query: '?raw', import: 'default', eager: true },
)

describe('Frontend Clean Architecture & Code Size Guard (v4.2)', () => {
  it('forbids loose components at src/components root and removes duplicate common/ folder', () => {
    const compPaths = Object.keys(ALL_SOURCE_RAW)
      .filter((p) => p.startsWith('../components/'))
      .map((p) => p.slice('../components/'.length))

    const looseFiles = compPaths.filter((rel) => !rel.includes('/'))
    const folders = Array.from(new Set(compPaths.map((rel) => rel.split('/')[0]))).sort()

    expect(looseFiles).toEqual([])
    expect(folders).not.toContain('common')
    expect(folders).toEqual(['admin', 'assessment', 'expert', 'learner', 'ui'])
  })

  it('groups all pages under portal/domain subdirectories with zero loose files in src/pages root', () => {
    const pagePaths = Object.keys(ALL_SOURCE_RAW)
      .filter((p) => p.startsWith('../pages/'))
      .map((p) => p.slice('../pages/'.length))

    const looseFiles = pagePaths.filter((rel) => !rel.includes('/'))
    const folders = Array.from(new Set(pagePaths.map((rel) => rel.split('/')[0]))).sort()

    expect(looseFiles).toEqual([])
    expect(folders).toEqual(['admin', 'auth', 'expert', 'learner', 'public'])
  })

  it('keeps router inside src/core/router.ts and not loose at src/router.ts', () => {
    expect(ALL_SOURCE_RAW['../core/router.ts']).toBeDefined()
    expect(ALL_SOURCE_RAW['../router.ts']).toBeUndefined()
  })

  it(`enforces <= ${MAX_LINES} LOC across all production Frontend modules (zero allowlist)`, () => {
    const violations: string[] = []
    for (const [relPath, content] of Object.entries(ALL_SOURCE_RAW)) {
      const lineCount = content.split('\n').length
      if (lineCount > MAX_LINES) {
        violations.push(`${relPath.replace('../', '')}: ${lineCount} LOC > ${MAX_LINES}`)
      }
    }
    expect(violations).toEqual([])
  })
})
