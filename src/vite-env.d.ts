/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TEST_PASSWORD: string;
  readonly VITE_TEST_MISMATCHED_PASSWORD: string;
  readonly VITE_TEST_INVALID_PASSWORD: string;
}
