/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly AOL_GUIDE_MAPBOX_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
