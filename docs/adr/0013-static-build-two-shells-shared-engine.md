# Static build as two shells over a shared engine

**Status:** accepted

CrateCaddy needs a read-only build that can be published and used offline, sharing one codebase and one Library with the API-backed app. We build **two entry points over a shared engine** instead of one app with runtime feature flags.

This supersedes the archived [ADR-0005](./archive/0005-vite-mode-static-site.md), which proposed one shell with an alias-swapped API client.

- `main.tsx` — API shell: `BrowserRouter`, edit route, version from `/api/version`.
- `main.static.tsx` — static shell: `HashRouter`, Snapshot bootstrap, no write routes, version from baked build defines + Snapshot metadata.
- Shared: components, hooks, `BrowseRoutes` route table, providers, and a `data` module whose implementation is selected at build time (API client vs Snapshot client).

Write code is absent from the static bundle **by construction** (no route, no import graph), not hidden at runtime, and the static shell has a home for static-only concerns (offline banner, update flow).

Rejected:

1. **Capability flags in one shell (the archived ADR-0005's spirit):** write code still ships, routes are registered at runtime, and every component must remember to consult the flag.
2. **Alias-swapped API client only:** swaps data access but leaves the write surface registered; solves half the problem.
3. **Runtime conditional import in `main.tsx`:** the static build still contains the full app graph, so the write code ships.

Consequences:

- Route drift is the main risk; mitigated by the shared `BrowseRoutes` table, which the parity check also reads.
- Vite needs a mode-driven entry swap (one `index.html`, two mains), plus per-mode `base`/`outDir`.
- Both mains are type-checked by the existing `tsc -b`.

See [static site build plan](../../plans/20261018-static-site-build.md).
