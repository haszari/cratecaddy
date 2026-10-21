#!/bin/bash

# Load the sample Library into a dev API that is already running.
# Usage: ./load-sample-library.sh

API_URL="http://localhost:3000/api/songs"
DATA_FILE="sample-songs.json"

if [ ! -f "$DATA_FILE" ]; then
  echo "Error: $DATA_FILE not found"
  exit 1
fi

echo "Seeding database with sample songs..."

# Parse JSON and POST each song
jq -r '.[] | @json' "$DATA_FILE" | while read -r song; do
  curl -s -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -d "$song" > /dev/null && echo "✓ Song imported"
done

echo "Done!"
