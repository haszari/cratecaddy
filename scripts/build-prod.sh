#!/bin/bash
set -e

API_DIR="src/api"
GEN_DIR="$API_DIR/src/generated"
mkdir -p "$GEN_DIR"
VERSION_TS="$GEN_DIR/version.ts"

APP_VERSION=$(node -e "try{const p=require('./src/api/package.json');process.stdout.write(String(p.version||'0.1.0'))}catch(e){process.stdout.write('0.1.0')}")

HAS_GIT=0
if git rev-parse --git-dir >/dev/null 2>&1; then
  HAS_GIT=1
fi

GIT_COMMIT="unknown"
GIT_COMMIT_SHORT="unknown"
GIT_BRANCH=""
GIT_DIRTY=false
BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

if [ "$HAS_GIT" -eq 1 ]; then
  GIT_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
  if [ "$GIT_COMMIT" != "unknown" ] && [ ${#GIT_COMMIT} -ge 7 ]; then
    GIT_COMMIT_SHORT="${GIT_COMMIT:0:7}"
  else
    GIT_COMMIT_SHORT="$GIT_COMMIT"
  fi
  BR=$(git branch --show-current 2>/dev/null || true)
  if [ -z "$BR" ]; then
    GIT_BRANCH="detached"
  else
    GIT_BRANCH="$BR"
  fi
  if git diff --quiet --ignore-submodules HEAD 2>/dev/null; then
    GIT_DIRTY=false
  else
    GIT_DIRTY=true
  fi
fi

# Build VERSION string
VERSION_STR="${APP_VERSION}+${GIT_COMMIT_SHORT}"
if [ "$GIT_BRANCH" != "main" ] && [ "$GIT_BRANCH" != "" ]; then
  VERSION_STR="${VERSION_STR} (${GIT_BRANCH})"
fi
if [ "$GIT_DIRTY" = true ]; then
  VERSION_STR="${VERSION_STR}-dirty"
fi

# Write TypeScript
cat > "$VERSION_TS" << TS
export const APP_VERSION = '${APP_VERSION}';
export const GIT_COMMIT = '${GIT_COMMIT}';
export const GIT_COMMIT_SHORT = '${GIT_COMMIT_SHORT}';
export const GIT_BRANCH = '${GIT_BRANCH}';
export const GIT_DIRTY = ${GIT_DIRTY};
export const BUILD_TIME = '${BUILD_TIME}';
export const VERSION = '${VERSION_STR}';
TS

echo "Building UI..."
cd src/ui
npm run build

echo "Building API..."
cd ../api
npm run build

# Ship the build identity as a plain file as well as the generated module, so
# the changeset is visible in the installed runtime without starting the API.
echo "$VERSION_STR" > dist/VERSION
echo "Bundling static UI into API dist..."
rm -rf dist/static
mkdir -p dist/static
cp -r ../ui/dist/* dist/static/

echo "Prod build complete: src/api/dist/"
