// /// <reference types="vite/client" />

interface ImportMetaEnv {
  // readonly VITE_API_KEY?: string; // Removed as API key now comes from process.env
  // You can define other Vite-specific environment variables here if needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
