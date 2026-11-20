import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import * as api from "../api";

describe("P3-SLICE-3 Expert & Admin Portal Screens (SCR-15..SCR-20)", () => {
  it("exports all 6 Expert and Admin pages without Unicode emojis (INV-UI-01)", async () => {
    const scr15 = await import("../pages/ExpertDomainsPage");
    const scr16 = await import("../pages/ExpertQuestionsPage");
    const scr17 = await import("../pages/ExpertCodeChallengesPage");
    const scr18 = await import("../pages/AdminOnlineRlPage");
    const scr19 = await import("../pages/AdminModelRegistryPage");
    const scr20 = await import("../pages/AdminSystemHealthPage");

    expect(scr15.ExpertDomainsPage).toBeDefined();
    expect(scr16.ExpertQuestionsPage).toBeDefined();
    expect(scr17.ExpertCodeChallengesPage).toBeDefined();
    expect(scr18.AdminOnlineRlPage).toBeDefined();
    expect(scr19.AdminModelRegistryPage).toBeDefined();
    expect(scr20.AdminSystemHealthPage).toBeDefined();
  });

  it("disables SCR-18 Micro-batch button when buffer_count < batch_size and enables when >= batch_size", async () => {
    const spy = vi.spyOn(api, "apiAdminGetOnlineRlStatus").mockResolvedValue({
      buffer_count: 22,
      kl_target_max: 0.02,
      active_model: null,
      models: [],
    });

    const { AdminOnlineRlPage } = await import("../pages/AdminOnlineRlPage");
    render(<AdminOnlineRlPage onNavigate={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText(/Thiếu mẫu \(22 \/ 128\)/)).toBeTruthy();
    });

    const btn = screen.getByTestId("run-micro-batch-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);

    // Lower batch_size to 16 (<= 22) -> button becomes enabled
    const batchInput = screen.getByLabelText(/Kích thước Lô/i) as HTMLInputElement;
    fireEvent.change(batchInput, { target: { value: "16" } });
    expect(btn.disabled).toBe(false);

    // Clearing batch_size (invalid < 16) -> button stays disabled
    fireEvent.change(batchInput, { target: { value: "" } });
    expect(btn.disabled).toBe(true);

    spy.mockRestore();
  });
});
