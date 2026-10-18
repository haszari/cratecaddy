#!/bin/bash
#
# Publish the static site to GitHub Pages.
#
#   1. snapshot  — read the library and write src/ui/public/data/snapshot-<sha8>.json
#   2. validate  — refuse obviously wrong data (empty library, big drop)
#   3. build     — static site into src/ui/dist-static
#   4. validate  — filename hash, required files
#   5. archive   — keep the last 3 built outputs for rollback (src/data, gitignored)
#   6. push      — single-commit gh-pages branch (no history, no repo bloat)
#
# Publishing is deliberately local and manual: CI cannot reach the library
# database, and a deploy should be a decision, not a side effect of a push.
# The default run does everything locally and then asks before publishing.
#
# Usage:
#   scripts/publish-static-site.sh                          # build + validate, then prompt to publish
#   scripts/publish-static-site.sh --publish-to-github      # skip the prompt and publish
#   scripts/publish-static-site.sh --use-dev-library        # publish from the dev database instead
#   scripts/publish-static-site.sh --allow-smaller-library  # publish even if the song count dropped
#   scripts/publish-static-site.sh --allow-dirty-build      # publish with uncommitted changes
#   scripts/publish-static-site.sh --dry-run                # never prompt, never publish
#
# The Snapshot is taken from the prod (appliance) database by default. The dev
# database is for iteration and may hold half-imported or experimental data,
# so publishing from it is an explicit choice.
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ALLOW_SMALLER_LIBRARY=0
ALLOW_DIRTY_BUILD=0
DRY_RUN=0
PUBLISH=0
USE_DEV_LIBRARY=0
for arg in "$@"; do
  case "$arg" in
    --allow-smaller-library) ALLOW_SMALLER_LIBRARY=1 ;;
    --allow-dirty-build) ALLOW_DIRTY_BUILD=1 ;;
    --dry-run) DRY_RUN=1 ;;
    --publish-to-github) PUBLISH=1 ;;
    --use-dev-library) USE_DEV_LIBRARY=1 ;;
    --help|-h)
      sed -n '2,22p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
  esac
done

say() { printf '\n== %s\n' "$*"; }

# The appliance's database is the Library of record. Its config lives outside
# the checkout and its defaults differ from the dev .env, so resolve it here
# rather than inheriting the dev MongoDB URI.
CRATECADDY_HOME="${CRATECADDY_HOME:-$HOME/.cratecaddy}"
if [ -f "$CRATECADDY_HOME/config.env" ]; then
  # shellcheck disable=SC1091
  set -a; . "$CRATECADDY_HOME/config.env"; set +a
fi

if [ "$USE_DEV_LIBRARY" -eq 1 ]; then
  export MONGODB_URI="mongodb://127.0.0.1:${DEV_MONGO_PORT:-5327}/cratecaddy"
  LIBRARY_SOURCE="dev"
else
  export MONGODB_URI="mongodb://127.0.0.1:${MONGO_PORT:-5227}/cratecaddy"
  LIBRARY_SOURCE="prod"
fi

field() {
  # field <json-file> <js-expression>
  node -e "const d=require(require('path').resolve(process.argv[1]));console.log(eval(process.argv[2]))" "$1" "$2"
}

say "Library source"
echo "  $LIBRARY_SOURCE — $MONGODB_URI"
if [ "$LIBRARY_SOURCE" = "dev" ]; then
  echo "  warning: publishing from the dev Library; it may hold incomplete or experimental data."
fi
if ! (cd src/api && npm run inspect:library count >/dev/null 2>&1); then
  echo "Cannot read the $LIBRARY_SOURCE Library at $MONGODB_URI." >&2
  if [ "$LIBRARY_SOURCE" = "prod" ]; then
    echo "Start the appliance first: cratecaddy start" >&2
  else
    echo "Start the dev database first: docker compose up -d" >&2
  fi
  exit 1
fi

say "Snapshot"
(cd src/api && npm run snapshot)

SNAPSHOT_FILE="$(ls -t src/ui/public/data/snapshot-*.json | head -1)"
SNAPSHOT_VERSION="$(field "$SNAPSHOT_FILE" 'd.snapshot.version')"
SNAPSHOT_COUNT="$(field "$SNAPSHOT_FILE" 'd.snapshot.count')"
SNAPSHOT_TAKEN_AT="$(field "$SNAPSHOT_FILE" 'd.snapshot.takenAt')"
SNAPSHOT_BYTES="$(wc -c < "$SNAPSHOT_FILE" | tr -d ' ')"

say "Validate Snapshot"
printf '  version: %s\n  songs:   %s\n  size:    %s KB\n  taken:   %s\n' \
  "$SNAPSHOT_VERSION" "$SNAPSHOT_COUNT" "$((SNAPSHOT_BYTES / 1024))" "$SNAPSHOT_TAKEN_AT"

if [ "$SNAPSHOT_COUNT" -eq 0 ]; then
  echo "Refusing to publish an empty Snapshot." >&2
  exit 1
fi

if [ "$SNAPSHOT_BYTES" -gt $((20 * 1024 * 1024)) ]; then
  echo "Warning: Snapshot is larger than 20 MB; check the filter before publishing." >&2
fi

say "Compare with published Snapshot"
git fetch --quiet origin gh-pages 2>/dev/null || true
PUBLISHED_FILE="$(
  git ls-tree --name-only origin/gh-pages data/ 2>/dev/null \
    | grep -E 'snapshot-[0-9a-f]+\.json$' \
    | head -1 || true
)"
PUBLISHED_COUNT=0
if [ -n "$PUBLISHED_FILE" ]; then
  PUBLISHED_COUNT="$(git show "origin/gh-pages:$PUBLISHED_FILE" | node -e "
    let raw='';
    process.stdin.on('data', c => raw += c);
    process.stdin.on('end', () => {
      try { console.log(JSON.parse(raw).snapshot.count ?? 0); } catch { console.log(0); }
    });
  ")"
fi

if [ "$PUBLISHED_COUNT" -gt 0 ]; then
  THRESHOLD=$((PUBLISHED_COUNT * 80 / 100))
  printf '  published: %s songs\n  new:       %s songs\n' "$PUBLISHED_COUNT" "$SNAPSHOT_COUNT"
  if [ "$SNAPSHOT_COUNT" -lt "$THRESHOLD" ] && [ "$ALLOW_SMALLER_LIBRARY" -ne 1 ]; then
    cat >&2 <<EOF

Refusing to publish: the Snapshot dropped from $PUBLISHED_COUNT to $SNAPSHOT_COUNT songs.
If that is intended, re-run with --allow-smaller-library.
EOF
    exit 1
  fi
else
  echo "  no published Snapshot found (first publish?)"
fi

say "Check static site will match the app"
(cd src/api && npm run check:static-site-matches-app) || {
  echo "Static site and app disagree for the same query; fix before publishing." >&2
  exit 1
}

say "Build static site"
(cd src/ui && npm run build:static)

say "Validate build"
BUILD_SNAPSHOTS="$(ls src/ui/dist-static/data/snapshot-*.json 2>/dev/null | wc -l | tr -d ' ')"
if [ "$BUILD_SNAPSHOTS" != "1" ]; then
  echo "Expected exactly one Snapshot in dist-static/data, found $BUILD_SNAPSHOTS." >&2
  exit 1
fi
BUILT_FILE="$(ls src/ui/dist-static/data/snapshot-*.json)"
BUILT_VERSION="$(field "$BUILT_FILE" 'd.snapshot.version')"
if [ "$BUILT_VERSION" != "$SNAPSHOT_VERSION" ]; then
  echo "Built Snapshot version $BUILT_VERSION does not match $SNAPSHOT_VERSION." >&2
  exit 1
fi
for required in src/ui/dist-static/index.html src/ui/dist-static/.nojekyll; do
  if [ ! -f "$required" ]; then
    echo "Missing required file: $required" >&2
    exit 1
  fi
done
if ! grep -q "/cratecaddy/assets/" src/ui/dist-static/index.html; then
  echo "index.html does not use the /cratecaddy/ base path — check the Vite base config." >&2
  exit 1
fi
echo "  build ok: snapshot $BUILT_VERSION, index.html and .nojekyll present"

say "Archive build for rollback"
ARCHIVE_DIR="src/data/static-deploys/$SNAPSHOT_VERSION"
mkdir -p "$ARCHIVE_DIR"
rsync -a --delete src/ui/dist-static/ "$ARCHIVE_DIR/"
# Keep the three most recent builds; rollback is republishing an archive verbatim.
ls -1dt src/data/static-deploys/*/ | tail -n +4 | while read -r old; do
  rm -rf "$old"
done
echo "  archived to $ARCHIVE_DIR (keeping 3)"
ls -1dt src/data/static-deploys/*/ | sed 's/^/    /'

say "Publish?"
if [ "$DRY_RUN" -eq 1 ]; then
  echo "  local build complete; not publishing (--dry-run)"
  exit 0
fi

if [ "$PUBLISH" -ne 1 ]; then
  if [ ! -t 0 ]; then
    echo "  local build complete; not publishing (no --publish-to-github, not interactive)"
    exit 0
  fi
  printf 'Publish Snapshot %s (%s songs) to GitHub Pages? [y/N] ' "$SNAPSHOT_VERSION" "$SNAPSHOT_COUNT"
  read -r answer
  case "$answer" in
    y|Y|yes|YES) ;;
    *) echo "  not published."; exit 0 ;;
  esac
fi

if [ -n "$(git status --porcelain)" ] && [ "$ALLOW_DIRTY_BUILD" -ne 1 ]; then
  printf 'Working tree is dirty — the published footer will read -dirty. Continue? [y/N] '
  read -r answer
  case "$answer" in
    y|Y|yes|YES) ;;
    *) echo "Aborted." >&2; exit 1 ;;
  esac
fi

(cd src/ui && npx gh-pages -d dist-static --no-history --dotfiles -b gh-pages \
  -m "snapshot $SNAPSHOT_VERSION $SNAPSHOT_TAKEN_AT")

say "Published"
cat <<EOF
  URL:      https://lab.cartoonbeats.com/cratecaddy
  Snapshot: $SNAPSHOT_VERSION ($SNAPSHOT_COUNT songs, taken $SNAPSHOT_TAKEN_AT)
  Rollback: republish the archived build, e.g.
            (cd src/ui && npx gh-pages -d ../../$ARCHIVE_DIR --no-history --dotfiles -b gh-pages)
EOF
