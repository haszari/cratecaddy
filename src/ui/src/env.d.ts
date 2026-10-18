/// <reference types="vite/client" />

/** Injected by Vite in site mode: the content-hashed Snapshot filename, relative to BASE_URL. */
declare const __SNAPSHOT_FILE__: string;

/** Injected by Vite from git at build time. */
declare const __GIT_BRANCH__: string;
declare const __GIT_COMMIT_SHORT__: string;
declare const __GIT_DIRTY__: boolean;

/** App version from src/api/package.json, injected at build time. */
declare const __APP_VERSION__: string;
