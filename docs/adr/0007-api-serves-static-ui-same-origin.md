# API serves static UI from the same origin

**Question:** In the production appliance, where does the built UI come from, and how does it reach the API?

The Express API serves the built static UI from its own `dist/static/` directory at the root URL, so the browser and the API share one origin. The UI's API client defaults to **relative** URLs (`import.meta.env.VITE_API_URL || ''`), and production builds force `VITE_API_URL=` empty via `src/ui/.env.production`. Requests resolve against whatever host and port Express actually listens on.

This keeps the appliance to a single Node process on the macOS host (alongside MongoDB in Docker). A custom `API_PORT` in config still works because no absolute URL is baked into the production bundle. In dev the absolute `http://localhost:5326` from `src/ui/.env` remains correct — the Vite dev server (5325) and the API (5326) are different origins.

The `fs.existsSync` guard in `server.ts` skips static serving entirely when no `dist/static/` exists, so dev mode is unaffected.

Rejected alternatives:

1. **Serve UI from a separate static host (Vercel, Netlify, S3) and point `VITE_API_URL` at the API.** Works for a hosted app, but the appliance is a local single-machine deployment. Adding a second origin means CORS configuration and an absolute baked URL that breaks if the API port changes — the exact failure we removed.

2. **Always use relative URLs, including dev.** The Vite dev server and API are different origins in dev, so relative `fetch('/api/...')` would hit the Vite server and 404. Keeping the absolute dev URL and overriding it empty for prod builds gives each mode the correct value.
