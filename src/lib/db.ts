import Database from "@tauri-apps/plugin-sql";

let dbInstance: Database | null = null;

/**
 * Opens (or returns the already-open) connection to the local budget
 * database. Migrations in src-tauri/migrations/ run automatically the
 * first time this connection string is loaded.
 *
 * Call this only after the user has unlocked the app — once encryption
 * is wired in, opening the DB will require the password-derived key.
 */
export async function getDb(): Promise<Database> {
  if (!dbInstance) {
    dbInstance = await Database.load("sqlite:budget.db");
  }
  return dbInstance;
}

/**
 * Call this on lock/logout so a stale connection isn't reused across
 * unlock cycles once per-session encryption keys are introduced.
 */
export async function closeDb(): Promise<void> {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
  }
}