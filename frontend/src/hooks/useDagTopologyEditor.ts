import { useCallback, useMemo, useReducer } from 'react'
import type { ExpertGraphNodeItem } from '../types/expert'

export interface EditableGraphNode {
  node_idx?: number
  slug: string
  title: string
  tier: number
  is_shared: boolean
  lesson_markdown: string
  prerequisites: string[]
  question_counts_by_tier: Record<string, number>
  has_code_challenge: boolean
}

export interface DagEdgeItem {
  source: string
  target: string
}

export interface DagCycleAnalysis {
  hasCycle: boolean
  cyclePath: string[]
  cycleNodeSet: Set<string>
  cycleEdgeKeys: Set<string>
  topoOrder: string[]
}

/**
 * Client-side Kahn's topological sort + DFS cycle path extraction.
 * Runs in <1ms on every graph edit so educators see invalid cycles immediately.
 */
export function analyzeDagTopology(nodes: EditableGraphNode[]): DagCycleAnalysis {
  const nodeSet = new Set(nodes.map((n) => n.slug))
  const adj = new Map<string, string[]>()
  const inDegree = new Map<string, number>()

  for (const n of nodes) {
    adj.set(n.slug, [])
    inDegree.set(n.slug, 0)
  }

  for (const n of nodes) {
    for (const prereq of n.prerequisites) {
      if (prereq === n.slug) {
        return {
          hasCycle: true,
          cyclePath: [n.slug, n.slug],
          cycleNodeSet: new Set([n.slug]),
          cycleEdgeKeys: new Set([`${n.slug}->${n.slug}`]),
          topoOrder: [],
        }
      }
      if (nodeSet.has(prereq)) {
        adj.get(prereq)!.push(n.slug)
        inDegree.set(n.slug, (inDegree.get(n.slug) ?? 0) + 1)
      }
    }
  }

  const queue: string[] = []
  for (const [slug, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(slug)
  }

  const topoOrder: string[] = []
  const workingDeg = new Map(inDegree)
  while (queue.length > 0) {
    const curr = queue.shift()!
    topoOrder.push(curr)
    for (const next of adj.get(curr) ?? []) {
      const nextDeg = (workingDeg.get(next) ?? 0) - 1
      workingDeg.set(next, nextDeg)
      if (nextDeg === 0) queue.push(next)
    }
  }

  if (topoOrder.length === nodes.length) {
    return {
      hasCycle: false,
      cyclePath: [],
      cycleNodeSet: new Set(),
      cycleEdgeKeys: new Set(),
      topoOrder,
    }
  }

  // Extract concrete cycle path via DFS among remaining cyclic nodes
  const remaining = new Set(
    Array.from(workingDeg.entries())
      .filter(([, deg]) => deg > 0)
      .map(([slug]) => slug),
  )
  const state = new Map<string, 0 | 1 | 2>()
  const parent = new Map<string, string>()

  function dfs(u: string): string[] | null {
    state.set(u, 1)
    for (const v of adj.get(u) ?? []) {
      if (!remaining.has(v)) continue
      const vState = state.get(v) ?? 0
      if (vState === 1) {
        const path = [v, u]
        let cur = u
        while (cur !== v && parent.has(cur)) {
          cur = parent.get(cur)!
          path.push(cur)
        }
        path.reverse()
        return path
      }
      if (vState === 0) {
        parent.set(v, u)
        const found = dfs(v)
        if (found) return found
      }
    }
    state.set(u, 2)
    return null
  }

  let cyclePath: string[] = []
  for (const slug of Array.from(remaining).sort()) {
    if ((state.get(slug) ?? 0) === 0) {
      const found = dfs(slug)
      if (found) {
        cyclePath = found
        break
      }
    }
  }
  if (cyclePath.length === 0) {
    cyclePath = Array.from(remaining).sort()
  }

  const cycleNodeSet = new Set(cyclePath)
  const cycleEdgeKeys = new Set<string>()
  for (let i = 0; i < cyclePath.length - 1; i++) {
    cycleEdgeKeys.add(`${cyclePath[i]}->${cyclePath[i + 1]}`)
  }

  return {
    hasCycle: true,
    cyclePath,
    cycleNodeSet,
    cycleEdgeKeys,
    topoOrder,
  }
}

interface EditorState {
  serverSnapshot: EditableGraphNode[]
  draftNodes: EditableGraphNode[]
  selectedSlug: string | null
}

type EditorAction =
  | { type: 'LOAD_FROM_SERVER'; nodes: EditableGraphNode[]; preferredSlug?: string | null }
  | { type: 'SELECT_NODE'; slug: string | null }
  | { type: 'ADD_NODE'; node: EditableGraphNode }
  | { type: 'REMOVE_NODE'; slug: string }
  | { type: 'UPDATE_NODE_FIELD'; slug: string; patch: Partial<EditableGraphNode> }
  | { type: 'TOGGLE_PREREQ'; targetSlug: string; prereqSlug: string }
  | { type: 'DISCARD_CHANGES' }
  | { type: 'COMMIT_SNAPSHOT' }

function cloneNodes(nodes: EditableGraphNode[]): EditableGraphNode[] {
  return nodes.map((n) => ({
    ...n,
    prerequisites: [...n.prerequisites],
    question_counts_by_tier: { ...n.question_counts_by_tier },
  }))
}

function serializeComparable(nodes: EditableGraphNode[]): string {
  return JSON.stringify(
    nodes.map((n) => ({
      slug: n.slug,
      title: n.title,
      tier: n.tier,
      is_shared: n.is_shared,
      lesson_markdown: n.lesson_markdown,
      prerequisites: [...n.prerequisites].sort(),
    })),
  )
}

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'LOAD_FROM_SERVER': {
      const cloned = cloneNodes(action.nodes)
      const preferred =
        action.preferredSlug && cloned.some((n) => n.slug === action.preferredSlug)
          ? action.preferredSlug
          : cloned[0]?.slug ?? null
      return {
        serverSnapshot: cloneNodes(cloned),
        draftNodes: cloned,
        selectedSlug: preferred,
      }
    }
    case 'SELECT_NODE':
      return { ...state, selectedSlug: action.slug }
    case 'ADD_NODE':
      return {
        ...state,
        draftNodes: [...state.draftNodes, action.node],
        selectedSlug: action.node.slug,
      }
    case 'REMOVE_NODE': {
      const next = state.draftNodes
        .filter((n) => n.slug !== action.slug)
        .map((n) => ({
          ...n,
          prerequisites: n.prerequisites.filter((p) => p !== action.slug),
        }))
      const nextSelected =
        state.selectedSlug === action.slug ? (next[0]?.slug ?? null) : state.selectedSlug
      return {
        ...state,
        draftNodes: next,
        selectedSlug: nextSelected,
      }
    }
    case 'UPDATE_NODE_FIELD':
      return {
        ...state,
        draftNodes: state.draftNodes.map((n) =>
          n.slug === action.slug ? { ...n, ...action.patch } : n,
        ),
      }
    case 'TOGGLE_PREREQ':
      return {
        ...state,
        draftNodes: state.draftNodes.map((n) => {
          if (n.slug !== action.targetSlug) return n
          const exists = n.prerequisites.includes(action.prereqSlug)
          return {
            ...n,
            prerequisites: exists
              ? n.prerequisites.filter((p) => p !== action.prereqSlug)
              : [...n.prerequisites, action.prereqSlug],
          }
        }),
      }
    case 'DISCARD_CHANGES': {
      const restored = cloneNodes(state.serverSnapshot)
      const stillExists =
        state.selectedSlug && restored.some((n) => n.slug === state.selectedSlug)
          ? state.selectedSlug
          : restored[0]?.slug ?? null
      return {
        ...state,
        draftNodes: restored,
        selectedSlug: stillExists,
      }
    }
    case 'COMMIT_SNAPSHOT':
      return {
        ...state,
        serverSnapshot: cloneNodes(state.draftNodes),
      }
  }
}

export function mapGraphItemsToEditable(items: ExpertGraphNodeItem[]): EditableGraphNode[] {
  return items.map((n) => ({
    node_idx: n.node_idx,
    slug: n.slug,
    title: n.title,
    tier: n.tier,
    is_shared: n.is_shared,
    lesson_markdown: n.lesson_markdown || '',
    prerequisites: [...(n.prerequisites || [])],
    question_counts_by_tier: { ...(n.question_counts_by_tier || {}) },
    has_code_challenge: Boolean(n.has_code_challenge),
  }))
}

export function useDagTopologyEditor() {
  const [state, dispatch] = useReducer(editorReducer, {
    serverSnapshot: [],
    draftNodes: [],
    selectedSlug: null,
  })

  const loadFromServer = useCallback(
    (items: ExpertGraphNodeItem[], preferredSlug?: string | null) => {
      dispatch({
        type: 'LOAD_FROM_SERVER',
        nodes: mapGraphItemsToEditable(items),
        preferredSlug,
      })
    },
    [],
  )

  const selectNode = useCallback((slug: string | null) => {
    dispatch({ type: 'SELECT_NODE', slug })
  }, [])

  const addNode = useCallback((node: EditableGraphNode) => {
    dispatch({ type: 'ADD_NODE', node })
  }, [])

  const removeNode = useCallback((slug: string) => {
    dispatch({ type: 'REMOVE_NODE', slug })
  }, [])

  const updateNode = useCallback((slug: string, patch: Partial<EditableGraphNode>) => {
    dispatch({ type: 'UPDATE_NODE_FIELD', slug, patch })
  }, [])

  const togglePrereq = useCallback((targetSlug: string, prereqSlug: string) => {
    dispatch({ type: 'TOGGLE_PREREQ', targetSlug, prereqSlug })
  }, [])

  const discardChanges = useCallback(() => {
    dispatch({ type: 'DISCARD_CHANGES' })
  }, [])

  const commitSnapshot = useCallback(() => {
    dispatch({ type: 'COMMIT_SNAPSHOT' })
  }, [])

  const cycleAnalysis = useMemo(() => analyzeDagTopology(state.draftNodes), [state.draftNodes])

  const isDirty = useMemo(
    () => serializeComparable(state.draftNodes) !== serializeComparable(state.serverSnapshot),
    [state.draftNodes, state.serverSnapshot],
  )

  const allEdges = useMemo<DagEdgeItem[]>(() => {
    const orderRank = new Map(cycleAnalysis.topoOrder.map((slug, idx) => [slug, idx]))
    const raw = state.draftNodes.flatMap((n) =>
      n.prerequisites.map((p) => ({ source: p, target: n.slug })),
    )
    return raw.sort((a, b) => {
      const ra = orderRank.get(a.source) ?? 999
      const rb = orderRank.get(b.source) ?? 999
      if (ra !== rb) return ra - rb
      return a.target.localeCompare(b.target)
    })
  }, [state.draftNodes, cycleAnalysis.topoOrder])

  const outDegreeMap = useMemo(() => {
    const map: Record<string, number> = {}
    for (const n of state.draftNodes) map[n.slug] = 0
    for (const e of allEdges) {
      map[e.source] = (map[e.source] ?? 0) + 1
    }
    return map
  }, [state.draftNodes, allEdges])

  const selectedNode = useMemo(
    () => state.draftNodes.find((n) => n.slug === state.selectedSlug) ?? state.draftNodes[0] ?? null,
    [state.draftNodes, state.selectedSlug],
  )

  return {
    nodes: state.draftNodes,
    selectedNode,
    selectedSlug: selectedNode?.slug ?? null,
    allEdges,
    outDegreeMap,
    cycleAnalysis,
    isDirty,
    loadFromServer,
    selectNode,
    addNode,
    removeNode,
    updateNode,
    togglePrereq,
    discardChanges,
    commitSnapshot,
  }
}
