# Plan: User experience framework — activities

Define the high-level user activities CrateCaddy serves, so every screen, flow and feature traces back to a stable category. Public-facing result: `docs/activities.md`.

## 1) Objectives

The doc is maintained in the repo and serves several purposes over time:

- All screens and UI trace their purpose/function back to this doc / these principles.
- New features, fixes, changes are designed within this framework, or extend it.
- The static web app implements only a subset — one high-level category — a clean cut.
- Detect functionality that is badly designed / doesn't align with the scheme, so it can be trimmed and the app kept focused.
- Evaluate categories from a "general purpose" vs "customised for one user (developer)" point of view — fence off idiosyncratic functionality.

## 2) Decisions (grilled)

- Three activities, expressed as user verbs — not system functions, not screen modes.
- The old `view`/`edit` split is a screen mode, not a user goal. Rejected as spine.
- "Find stuff to play next / plan / refine" lives in **Perform**, built on **Explore**'s filters as foundation. Filtering the library is always Explore.
- "What's that tune" / "do I have more techno at 133 bpm" = Explore.
- Import + Apple Music sync = part of **Curate**, not fenced off. It is custom for one user today, prototype of a more general import/tag-rules/sync feature later.
- Static build = Explore only, read-only. Perform + setlists/playlists out of Explore for now; may relax as Perform develops.
- Working rules (design/audit principles) stay in this plan doc, not the user-facing doc.

## 3) Naming history

| Name | Was | Synonyms |
|---|---|---|
| Explore | Discover | Browse |
| Curate | Label, Collect, Tag | — |
| Perform | (working name) | Plan, Mix, Prepare |

Note: `browse == explore` — same thing, synonym only. `discover` is outside the app (finding *new* music happens elsewhere).

## 4) Working rules (audit lens)

- Read = Explore. Write = Curate or Perform.
- Each screen serves one activity, as primary.
- Static build implements Explore only — read-only, no write surface.
- Any screen with a write surface must map to exactly one of Curate or Perform.
- A feature that serves no activity is cruft: fence it or trim it.

## 5) Screen audit

Durable map lives in `docs/screen-audit.md` — entry points (screens + CLI) → user actions → activity.

## 6) Todo / progress

- [x] Take raw guidance / rough ideas as starting point
- [x] Grill to refine broad categories (timebox ~5 questions, stable categories)
- [x] Brainstorm names; save single-word names + alternatives for history
- [x] Produce placeholder doc: ~3 categories, single-word names, synonyms + 1-sentence explanation
- [x] Audit existing functionality screen by screen
- [x] Each screen serves one category only (or as primary)
- [x] List each flow / user pathway under the appropriate header
- [ ] Confirm categories stable enough to build out more functionality
- [ ] Evaluate general-purpose vs developer-customised; fence off idiosyncratic stuff
- [ ] Document full version vs static version differences simply
