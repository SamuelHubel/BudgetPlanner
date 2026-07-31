import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../lib/db", () => ({
  getDb: vi.fn(async () => ({ close: vi.fn() })),
  closeDb: vi.fn(async () => {}),
}));

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
  });

  it("opens the database and shows the dashboard after unlocking", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText(/password/i), "hunter2");
    await user.click(screen.getByRole("button", { name: /unlock/i }));

    await waitFor(async () => {
      const mockedDb = await vi.importMock<typeof import("../lib/db")>("../lib/db");
      expect(mockedDb.getDb).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/your budget dashboard/i)).toBeInTheDocument();
    });
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
    const mockedDb = await vi.importMock<typeof import("../lib/db")>("../lib/db");
    expect(mockedDb.closeDb).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/unlock your budget vault/i)).toBeInTheDocument();
  });
});
