# Parallel filter implementations with a parity contract

Browse queries must work against MongoDB (API build) and against an in-memory Snapshot (Site build). We keep **two implementations on purpose** — the Mongo query builder for the API, a pure JS predicate for the Site build — and make the duplication explicit with a shared contract and a parity check.

Reasons: native Mongo querying is the right tool for the future cloud/multi-user library API, while a database cannot be shipped to the browser. A single JS implementation used by both would mean loading candidate documents into Node and filtering there, discarding the server-side query work and the indexes.

The agreement check (`npm run check:site-matches-app`, `src/api/scripts/check-site-matches-app.ts`) runs a fixed matrix of query params through both implementations over the dev database and asserts identical **filter membership, counts, and genre stats**. Sort order is explicitly out of scope: Mongo collation cannot be mirrored exactly, and ordering is presentation, not correctness.

Compromises are documented in the contract module and negotiated over time. Logic is promoted from Mongo to JS only when exact matching matters more than query performance — not pre-emptively.

Rejected:

1. **Single JS implementation for both:** exact parity by construction, but loses native querying and does not scale to the cloud library API.
2. **Ad-hoc duplication in the Snapshot client:** fastest, and guarantees drift the next time a filter is added, with nothing to catch it.

Consequences:

- Any new filter must be implemented twice and added to the parity matrix.
- The parity script is the repo's first test harness; it is not a test framework.
- `shuffleHash` is extracted as a pure function so the Mongo `$function` and the browser share one implementation.
