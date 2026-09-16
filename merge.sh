#!/bin/bash

# merge "<label>" ["<filter>"] [extra options, e.g. --dryRun]
LABEL="$1"
FILTER="$2"
shift 2 2>/dev/null

if [ -z "$FILTER" ]; then
	node --nolazy --trace-uncaught index.js --build default --type mergeOnly --label "$LABEL" "$@"
else
	node --nolazy --trace-uncaught index.js --build default --type mergeOnly --label "$LABEL" --filter "$FILTER" "$@"
fi
