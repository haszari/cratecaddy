# Vite mode for static site build

**Question:** If we build a static site, how do we structure the build to share the existing UI codebase?

We will use Vite's `--mode static` feature within the existing `src/ui/` package. A `.env.static` file will set `VITE_STATIC_MODE=true`. The Vite config will swap the API client via alias (`client.ts` → `staticClient.ts`) and output to `dist-static/`.

This keeps everything in one package — shared components, shared dependencies, no duplication. The static build is a strict subset of the web app: same React components, same hooks, same types. The only differences are the data source (JSON vs API) and the router (HashRouter vs BrowserRouter).

For full analysis, see [Alternative build targets analysis](../../plans/20260715-alternative-build-targets.md).

Rejected alternatives:

1. **Separate src/static/ package:** Cleaner separation but requires dependency duplication or monorepo tooling. Component sharing is awkward (symlinks or copy-paste). Two places to maintain shared types. More overhead for a feature that is a strict subset of the main UI.

2. **Extract shared component library (src/shared/):** Cleanest long-term architecture, but significant refactor to extract components from src/ui/. Overkill for an initial implementation — the static build is view-only and doesn't need independent component evolution.
