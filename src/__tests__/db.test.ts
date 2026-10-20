import { beforeEach, describe, expect, it, vi } from "vitest";

const closeMock = vi.fn(async () => {});
const executeMock = vi.fn(async (_query: string) => ({ rowsAffected: 0 }));
const loadMock = vi.fn(async () => ({ close: closeMock, execute: executeMock }));

vi.mock("@tauri-apps/plugin-sql", () => ({
  default: {
    load: loadMock,
  },
}));

describe("db module", () => {
  beforeEach(() => {
    vi.resetModules();
    loadMock.mockClear();
    closeMock.mockClear();
    executeMock.mockClear();
  });

  it("loads the database once and reuses the connection", async () => {
    const { getDb } = await import("../lib/db");

    const first = await getDb();
    const second = await getDb();

    expect(loadMock).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  it("shares the pending load between concurrent callers", async () => {
    const { getDb } = await import("../lib/db");
    let resolveLoad!: (database: {
      close: typeof closeMock;
      execute: typeof executeMock;
    }) => void;
    loadMock.mockImplementationOnce(
      () => new Promise((resolve) => {
        resolveLoad = resolve;
      }),
    );

    const firstPending = getDb();
    const secondPending = getDb();
    expect(loadMock).toHaveBeenCalledTimes(1);

    resolveLoad({ close: closeMock, execute: executeMock });
    const [first, second] = await Promise.all([firstPending, secondPending]);

    expect(second).toBe(first);
  });

  it("allows retry after a failed database load", async () => {
    loadMock.mockRejectedValueOnce("database unavailable");
    const { getDb } = await import("../lib/db");

    await expect(getDb()).rejects.toBe("database unavailable");
    await expect(getDb()).resolves.toBeDefined();
    expect(loadMock).toHaveBeenCalledTimes(2);
  });

  it("closes the connection and allows reopening after closeDb", async () => {
    const { getDb, closeDb } = await import("../lib/db");

    const first = await getDb();
    await closeDb();

    expect(closeMock).toHaveBeenCalledTimes(1);

    const second = await getDb();
    expect(loadMock).toHaveBeenCalledTimes(2);
    expect(second).not.toBe(first);
  });

  it("deletes financial records in foreign-key-safe order", async () => {
    const { resetFinancialData } = await import("../lib/db");

    await resetFinancialData();

    expect(executeMock.mock.calls.map(([query]) => query)).toEqual([
      "DELETE FROM transactions",
      "DELETE FROM goals",
      "DELETE FROM ai_insights_log",
      "DELETE FROM import_batches",
    ]);
  });

  it("surfaces database errors during reset", async () => {
    executeMock.mockRejectedValueOnce(new Error("database unavailable"));
    const { resetFinancialData } = await import("../lib/db");

    await expect(resetFinancialData()).rejects.toThrow("database unavailable");
  });
});
