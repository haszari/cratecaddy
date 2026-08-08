#!/bin/bash
set -e

echo "Building UI..."
cd src/ui
npm run build

echo "Building API..."
cd ../api
npm run build

echo "Bundling static UI into API dist..."
rm -rf dist/static
mkdir -p dist/static
cp -r ../ui/dist/* dist/static/

echo "Prod build complete: src/api/dist/"
