/// <reference types="vite/client" />
/// <reference types="google.maps" />
/// <reference types="vite-plugin-pwa/client" />

declare const __AURELIA_MAPS_API_KEY__: string;

interface ImportMetaEnv {
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
