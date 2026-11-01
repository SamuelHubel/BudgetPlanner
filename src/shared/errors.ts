/** Reads a usable `message` from an `Error` or a backend `{ code, message }`. */
function messageOf(error: unknown): string {
  if (typeof error !== "object" || error === null) return "";
  const { message } = error as { message?: unknown };
  return typeof message === "string" ? message : "";
}

/** Converts rejections from any source into a displayable error message. */
export function toErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string" && error) return error;
  return messageOf(error) || fallback;
}

/** Reads the stable code from a backend error, or `null` when there is none. */
export function errorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const { code } = error as { code?: unknown };
  return typeof code === "string" ? code : null;
}
