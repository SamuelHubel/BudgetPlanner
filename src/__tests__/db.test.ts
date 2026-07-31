import { beforeEach, describe, expect, it, vi } from "vitest";

const closeMock = vi.fn(async () => {});
const loadMock = vi.fn(async () => ({ close: closeMock }));

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
  });

  it("loads the database once and reuses the connection", async () => {
    const { getDb } = await import("../lib/db");

    const first = await getDb();
    const second = await getDb();

    expect(loadMock).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
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
});
