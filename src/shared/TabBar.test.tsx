import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { TABS, type TabName } from "../types";
import TabBar from "./TabBar";

function TabBarHarness() {
  const [activeTab, setActiveTab] = useState<TabName>("home");
  return (
    <>
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
      {TABS.map((tab) => (
        <div
          key={tab}
          id={`dashboard-panel-${tab}`}
          role="tabpanel"
          aria-labelledby={`dashboard-tab-${tab}`}
          hidden={activeTab !== tab}
        >
          {activeTab === tab && activeTab}
        </div>
      ))}
    </>
  );
}

describe("TabBar", () => {
  it("exposes selected tabs and their associated panel", () => {
    render(<TabBarHarness />);

    const tab = screen.getByRole("tab", { name: "Home" });
    const panel = screen.getByRole("tabpanel");
    expect(tab).toHaveAttribute("aria-selected", "true");
    expect(tab).toHaveAttribute("aria-controls", panel.id);
    expect(panel).toHaveAttribute("aria-labelledby", tab.id);
    const aiTab = screen.getByRole("tab", { name: "AI" });
    expect(aiTab).toHaveAttribute("aria-selected", "false");
    expect(
      document.getElementById(aiTab.getAttribute("aria-controls") ?? ""),
    ).toBeInTheDocument();
  });

  it("moves focus and selection with arrow, Home, and End keys", async () => {
    const user = userEvent.setup();
    render(<TabBarHarness />);
    const homeTab = screen.getByRole("tab", { name: "Home" });
    const aiTab = screen.getByRole("tab", { name: "AI" });

    homeTab.focus();
    await user.keyboard("{ArrowRight}");
    expect(aiTab).toHaveFocus();
    expect(aiTab).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowRight}");
    expect(homeTab).toHaveFocus();
    expect(homeTab).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{End}");
    expect(aiTab).toHaveFocus();
    await user.keyboard("{Home}");
    expect(homeTab).toHaveFocus();
  });
});
