# Crate Caddy - Agent Guidelines

**See [README.md](README.md) for complete project documentation, architecture, development workflows, and tooling.**

This file contains agent-specific guidelines only.

## Style & Conventions

- **Text case:** Sentence case everywhere (headings, labels, copy)
- **File references:** Use markdown links with workspace-relative paths
- **Code:** Prefer TypeScript, ES modules, tsx for execution

## Developer Responsibilities

**User handles:**
- `docker-compose up/down` and `--build` flags
- `npm run dev` / `npm run build` / `npm install` in any folder
- Starting/stopping the Vite dev server
- Running scripts and database imports

**I handle:**
- Code changes, refactoring, file creation
- Configuration updates (tsconfig.json, vite.config.ts, package.json)
- Architecture decisions and scaffolding
- Dependency management

## Tech Stack

- **Frontend:** Vite + React + TypeScript (tsx)
- **Backend:** Express + TypeScript (tsx watch for dev)
- **Database:** MongoDB + Mongoose (normalized schema with genre arrays)
- **Runtime:** Node.js ES modules, tsx for TypeScript execution
- **Import:** xml2js for Rekordbox XML parsing

