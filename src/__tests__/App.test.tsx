import { afterEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Budget } from "../types";
import {
  invalidTestPassword,
  mismatchedTestPassword,
  testPassword,
} from "./testCredentials";

const { api } = vi.hoisted(() => ({
  api: {
    isInitialized: vi.fn(async () => true),
    createPassword: vi.fn(async () => {}),
    unlock: vi.fn(async () => {}),
    lock: vi.fn(async () => {}),
    resetVault: vi.fn(async () => {}),
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
    listGoals: vi.fn(async () => []),
    createGoal: vi.fn(),
    updateGoal: vi.fn(),
    deleteGoal: vi.fn(async () => {}),
    getBudget: vi.fn(async (month: string) => ({
      month,
      budget: null,
      template: null,
      actuals: [],
      uncategorizedSpentCents: 0,
    })),
    saveBudget: vi.fn(async (budget: Budget) => budget),
    deleteBudget: vi.fn(async () => {}),
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
    expect(
      screen.queryByText(/secure desktop budget app/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/tauri \+ react \+ tailwind/i),
    ).not.toBeInTheDocument();
  });

  it("disables the unlock button while the password is being checked", async () => {
    const user = userEvent.setup();
    let finishUnlock = () => {};
    api.unlock.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishUnlock = resolve;
        }),
    );
    render(<App />);

    await user.type(await screen.findByLabelText(/password/i), testPassword);
    const unlockButton = screen.getByRole("button", { name: /unlock/i });
    await user.click(unlockButton);

    expect(unlockButton).toBeDisabled();
    act(() => finishUnlock());
    expect(
      await screen.findByText(/your budget dashboard/i),
    ).toBeInTheDocument();
  });

  it("creates a password on first run and confirms the password", async () => {
    const user = userEvent.setup();
    api.isInitialized.mockResolvedValueOnce(false);
    render(<App />);

    await user.type(await screen.findByLabelText(/^password$/i), testPassword);
    await user.type(screen.getByLabelText(/confirm password/i), testPassword);
    await user.click(screen.getByRole("button", { name: /create password/i }));

    await waitFor(() => {
      expect(api.createPassword).toHaveBeenCalledWith(testPassword);
      expect(screen.getByText(/your budget dashboard/i)).toBeInTheDocument();
    });
    expect(api.unlock).not.toHaveBeenCalled();
    expect(
      screen.queryByText(/existing unencrypted database/i),
    ).not.toBeInTheDocument();
  });

  it("does not create a password when confirmation differs", async () => {
    const user = userEvent.setup();
    api.isInitialized.mockResolvedValueOnce(false);
    render(<App />);

    await user.type(await screen.findByLabelText(/^password$/i), testPassword);
    await user.type(
      screen.getByLabelText(/confirm password/i),
      mismatchedTestPassword,
    );
    await user.click(screen.getByRole("button", { name: /create password/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      /passwords do not match/i,
    );
    expect(api.createPassword).not.toHaveBeenCalled();
  });

  it("opens the database and shows the dashboard after unlocking", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(await screen.findByLabelText(/password/i), testPassword);
    await user.click(screen.getByRole("button", { name: /unlock/i }));

    await waitFor(async () => {
      expect(api.unlock).toHaveBeenCalledTimes(1);
      expect(api.unlock).toHaveBeenCalledWith(testPassword);
      expect(screen.getByText(/your budget dashboard/i)).toBeInTheDocument();
    });
  });

  it("shows database failures on the unlock screen", async () => {
    const user = userEvent.setup();
    api.unlock.mockRejectedValueOnce("database unavailable");
    render(<App />);

    await user.type(
      await screen.findByLabelText(/password/i),
      invalidTestPassword,
    );
    await user.click(screen.getByRole("button", { name: /unlock/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "database unavailable",
    );
    expect(screen.getByText(/unlock your budget vault/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toHaveValue("");
  });

  it("erases the vault only after DELETE is typed, then offers setup", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(
      await screen.findByRole("button", { name: /forgot your password/i }),
    );
    const erase = screen.getByRole("button", { name: /erase all data/i });
    expect(erase).toBeDisabled();

    await user.type(screen.getByLabelText(/type delete/i), "delete");
    expect(erase).toBeDisabled();
    await user.clear(screen.getByLabelText(/type delete/i));
    await user.type(screen.getByLabelText(/type delete/i), "DELETE");
    await user.click(erase);

    expect(api.resetVault).toHaveBeenCalledOnce();
    expect(
      await screen.findByRole("heading", { name: /create your password/i }),
    ).toBeInTheDocument();
  });

  it("offers erasing when the password setup check fails", async () => {
    const user = userEvent.setup();
    api.isInitialized.mockRejectedValueOnce({
      code: "other",
      message: "the encrypted database is missing",
    });
    render(<App />);

    await user.click(
      await screen.findByRole("button", { name: /erase and start over/i }),
    );
    await user.type(screen.getByLabelText(/type delete/i), "DELETE");
    await user.click(screen.getByRole("button", { name: /erase all data/i }));

    expect(
      await screen.findByRole("heading", { name: /create your password/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("offers no erase action on first run", async () => {
    api.isInitialized.mockResolvedValueOnce(false);
    render(<App />);

    await screen.findByRole("heading", { name: /create your password/i });
    expect(
      screen.queryByRole("button", { name: /forgot your password/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the AI tab content after clicking the AI tab", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(await screen.findByLabelText(/password/i), testPassword);
    await user.click(screen.getByRole("button", { name: /unlock/i }));

    await waitFor(() => {
      expect(screen.getByText(/your budget dashboard/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("tab", { name: /ai/i }));
    expect(
      screen.getByText(/ai features are coming soon/i),
    ).toBeInTheDocument();
  });

  it("locks the app and closes the database when locking again", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(await screen.findByLabelText(/password/i), testPassword);
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

    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: testPassword },
    });
    const form = screen
      .getByRole("button", { name: /unlock/i })
      .closest("form")!;
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

  it("locks on the first activity after the machine sleeps past the limit", async () => {
    vi.useFakeTimers();
    render(<App />);
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: testPassword },
    });
    await act(async () => {
      fireEvent.submit(
        screen.getByRole("button", { name: /unlock/i }).closest("form")!,
      );
      await Promise.resolve();
    });
    expect(screen.getByText(/your budget dashboard/i)).toBeInTheDocument();

    // Sleep moves the clock forward while timers stay paused.
    vi.setSystemTime(Date.now() + 6 * 60 * 1000);
    await act(async () => {
      fireEvent.mouseMove(window);
      await Promise.resolve();
    });

    expect(api.lock).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/unlock your budget vault/i)).toBeInTheDocument();
  });
});
