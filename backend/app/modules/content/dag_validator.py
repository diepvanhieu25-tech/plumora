"""DAG Cycle Validator using Kahn's topological sort and DFS cycle path extraction."""

from __future__ import annotations

from collections import defaultdict, deque


class DagCycleError(ValueError):
    """Raised when a directed graph contains a prerequisite cycle (422 DAG_CYCLE_DETECTED)."""

    def __init__(self, cycle_path: list[str]) -> None:
        self.error_code = "DAG_CYCLE_DETECTED"
        self.cycle_path = cycle_path
        super().__init__(f"DAG cycle detected: {' -> '.join(cycle_path)}")


def validate_dag_acyclic(nodes: list[str], edges: list[tuple[str, str]]) -> None:
    """Validate that (nodes, edges) forms a Directed Acyclic Graph.

    Each edge is (concept_slug, prereq_slug). Raises DagCycleError if a cycle exists.
    """
    node_set = set(nodes)
    adj: dict[str, list[str]] = defaultdict(list)
    in_degree: dict[str, int] = {n: 0 for n in node_set}

    for concept, prereq in edges:
        if concept == prereq:
            raise DagCycleError([concept, prereq])
        if prereq in node_set and concept in node_set:
            adj[prereq].append(concept)
            in_degree[concept] += 1

    queue: deque[str] = deque([n for n, deg in in_degree.items() if deg == 0])
    visited_count = 0
    while queue:
        curr = queue.popleft()
        visited_count += 1
        for nxt in adj[curr]:
            in_degree[nxt] -= 1
            if in_degree[nxt] == 0:
                queue.append(nxt)

    if visited_count == len(node_set):
        return

    # Extract concrete cycle path via DFS among remaining nodes
    remaining = {n for n, deg in in_degree.items() if deg > 0}
    state: dict[str, int] = {}  # 0=unvisited, 1=visiting, 2=done
    parent: dict[str, str] = {}

    def _dfs(u: str) -> list[str] | None:
        state[u] = 1
        for v in adj[u]:
            if v not in remaining:
                continue
            if state.get(v, 0) == 1:
                path = [v, u]
                cur = u
                while cur != v and cur in parent:
                    cur = parent[cur]
                    path.append(cur)
                path.reverse()
                return path
            if state.get(v, 0) == 0:
                parent[v] = u
                found = _dfs(v)
                if found:
                    return found
        state[u] = 2
        return None

    for node in sorted(remaining):
        if state.get(node, 0) == 0:
            cycle = _dfs(node)
            if cycle:
                raise DagCycleError(cycle)

    raise DagCycleError(sorted(remaining))
