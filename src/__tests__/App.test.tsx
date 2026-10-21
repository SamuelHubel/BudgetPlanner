import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { api } = vi.hoisted(() => ({
  api: {
    isInitialized: vi.fn(async () => true),
    createPassword: vi.fn(async (_password: string) => {}),
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
        uncategorizedIncomeCents: 0,
        uncategorizedExpensesCents: 0,
      },
      monthlyTotals: [],
      monthlyBreakdowns: [],
    })),
    getCurrency: vi.fn(async () => "USD"),
    resetFinancialData: vi.fn(async () => {}),
  },
}));

vi.mock("../api/budgetApi", () => ({ budgetApi: api }));

import App from "../App";

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("App", () => {
  it("shows the lock screen and unlock form initially", async () => {
    render(<App />);

    expect(screen.getByText(/unlock your budget vault/i)).toBeInTheDocument();
    expect(await screen.findByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /unlock/i })).toBeInTheDocument();
    expect(screen.queryByText(/secure desktop budget app/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/tauri \+ react \+ tailwind/i)).not.toBeInTheDocument();
  });

  it("creates a password on first run and confirms the password", async () => {
    const user = userEvent.setup();
    api.isInitialized.mockResolvedValueOnce(false);
    render(<App />);

    await user.type(await screen.findByLabelText(/^password$/i), "a secure password");
    await user.type(screen.getByLabelText(/confirm password/i), "a secure password");
    await user.click(screen.getByRole("button", { name: /create password/i }));

    await waitFor(() => {
      expect(api.createPassword).toHaveBeenCalledWith("a secure password");
      expect(screen.getByText(/your budget dashboard/i)).toBeInTheDocument();
    });
    expect(api.unlock).not.toHaveBeenCalled();
    expect(screen.queryByText(/existing unencrypted database/i)).not.toBeInTheDocument();
  });

  it("does not create a password when confirmation differs", async () => {
    const user = userEvent.setup();
    api.isInitialized.mockResolvedValueOnce(false);
    render(<App />);

    await user.type(await screen.findByLabelText(/^password$/i), "a secure password");
    await user.type(screen.getByLabelText(/confirm password/i), "a different password");
    await user.click(screen.getByRole("button", { name: /create password/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(/passwords do not match/i);
    expect(api.createPassword).not.toHaveBeenCalled();
  });

  it("opens the database and shows the dashboard after unlocking", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(await screen.findByLabelText(/password/i), "hunter2");
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

    await user.type(await screen.findByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /unlock/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("database unavailable");
    expect(screen.getByText(/unlock your budget vault/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toHaveValue("");
  });

  it("shows the AI tab content after clicking the AI tab", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(await screen.findByLabelText(/password/i), "letmein");
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

    await user.type(await screen.findByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /unlock/i }));

    await waitFor(() => {
      expect(screen.getByText(/your budget dashboard/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /lock app/i }));
    expect(api.lock).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/unlock your budget vault/i)).toBeInTheDocument();
  });

  it("locks automatically after five minutes without keyboard or mouse activity", async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "password123" } });
    const form = screen.getByRole("button", { name: /unlock/i }).closest("form")!;
    await act(async () => {
      fireEvent.submit(form);
      await Promise.resolve();
    });
    expect(screen.getByText(/your budget dashboard/i)).toBeInTheDocument();
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4 * 60 * 1000);
    });
    fireEvent.mouseMove(window);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000 - 1);
    });
    expect(api.lock).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(api.lock).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/unlock your budget vault/i)).toBeInTheDocument();
  });
});
