/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_EXTENSION_ID: string
  readonly VITE_API_BASE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Chrome extension API types
declare namespace chrome {
  namespace runtime {
    let lastError: { message?: string } | undefined
    function sendMessage(
      extensionId: string,
      message: unknown,
      callback?: (response: unknown) => void
    ): void
  }
}
