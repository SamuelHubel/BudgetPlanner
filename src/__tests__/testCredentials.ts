function requireTestCredential(
  value: string | undefined,
  name: string,
): string {
  if (!value) {
    throw new Error(`Missing ${name}; define it in .env.test.`);
  }

  return value;
}

export const testPassword = requireTestCredential(
  import.meta.env.VITE_TEST_PASSWORD,
  "VITE_TEST_PASSWORD",
);
export const mismatchedTestPassword = requireTestCredential(
  import.meta.env.VITE_TEST_MISMATCHED_PASSWORD,
  "VITE_TEST_MISMATCHED_PASSWORD",
);
export const invalidTestPassword = requireTestCredential(
  import.meta.env.VITE_TEST_INVALID_PASSWORD,
  "VITE_TEST_INVALID_PASSWORD",
);
