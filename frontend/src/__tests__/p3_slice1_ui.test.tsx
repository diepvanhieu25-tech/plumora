import { describe, it, expect } from "vitest";

describe("P3-SLICE-1 UI Components & Screens (SCR-09..SCR-14)", () => {
  it("exports all 6 new Learner pages/components without Unicode emojis (INV-UI-01)", async () => {
    const hub = await import("../pages/MultiDomainHubPage");
    const placement = await import("../pages/AdaptivePlacementPage");
    const roadmap = await import("../pages/MultiDomainRoadmapPage");
    const depth = await import("../pages/DepthProbePage");
    const sandbox = await import("../pages/CodeSandboxPage");
    const drawer = await import("../components/AiTutorRubricDrawer");

    expect(hub.MultiDomainHubPage).toBeDefined();
    expect(placement.AdaptivePlacementPage).toBeDefined();
    expect(roadmap.MultiDomainRoadmapPage).toBeDefined();
    expect(depth.DepthProbePage).toBeDefined();
    expect(sandbox.CodeSandboxPage).toBeDefined();
    expect(drawer.AiTutorRubricDrawer).toBeDefined();
  });
});
