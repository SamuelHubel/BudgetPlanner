import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { api } = vi.hoisted(() => ({
  api: {
    unlock: vi.fn(async (_password: string) => {}),
    lock: vi.fn(async () => {}),
    listCategories: vi.fn(async () => []),
    previewImport: vi.fn(async () => []),
    commitImport: vi.fn(async () => ({ inserted: 0, skippedDuplicates: 0 })),
    getFinancialSummary: vi.fn(async () => ({
      breakdown: {
        income: [],
        expenses: [],
        largestIncomeSources: [],
        largestExpenses: [],
        uncategorizedCents: 0,
      },
      monthlyTotals: [],
      monthlyBreakdowns: [],
    })),
    resetFinancialData: vi.fn(async () => {}),
  },
}));

vi.mock("../api/budgetApi", () => ({ budgetApi: api }));

import App from "../App";

afterEach(() => {
  vi.clearAllMocks();
});

describe("App", () => {
  it("shows the lock screen and unlock form initially", () => {
    render(<App />);

    expect(screen.getByText(/unlock your budget vault/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /unlock/i })).toBeInTheDocument();
    expect(screen.queryByText(/secure desktop budget app/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/tauri \+ react \+ tailwind/i)).not.toBeInTheDocument();
  });

  it("opens the database and shows the dashboard after unlocking", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText(/password/i), "hunter2");
    await user.click(screen.getByRole("button", { name: /unlock/i }));

    await waitFor(async () => {
      expect(api.unlock).toHaveBeenCalledTimes(1);
      expect(api.unlock).toHaveBeenCalledWith("hunter2");
      expect(screen.getByText(/your budget dashboard/i)).toBeInTheDocument();
    });
  });

  it("shows database failures on the unlock screen", async () => {
    const user = userEvent.setup();
    api.unlock.mockRejectedValueOnce("database unavailable");
    render(<App />);

    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /unlock/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("database unavailable");
    expect(screen.getByText(/unlock your budget vault/i)).toBeInTheDocument();
  });

  it("shows the AI tab content after clicking the AI tab", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText(/password/i), "letmein");
    await user.click(screen.getByRole("button", { name: /unlock/i }));

    await waitFor(() => {
      expect(screen.getByText(/your budget dashboard/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /ai/i }));
    expect(screen.getByText(/ai features are coming soon/i)).toBeInTheDocument();
  });

  it("locks the app and closes the database when locking again", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /unlock/i }));

    await waitFor(() => {
      expect(screen.getByText(/your budget dashboard/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /lock app/i }));
    expect(api.lock).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/unlock your budget vault/i)).toBeInTheDocument();
  });
});
