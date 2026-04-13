#!/usr/bin/env bash
set -euo pipefail

# Purpose: Emit paced line-by-line output for line-number and timestamp gutter screenshots.
# Run: bash scripts/demo-terminal-gutter.sh
# Docs: docs-site/docs/guide/terminal.md, docs-site/docs/getting-started/quick-start.md
# Settings: Enable line numbers and/or timestamps before running.

DELAY_SECONDS=${DELAY_SECONDS:-0.25}
TOTAL_LINES=${TOTAL_LINES:-18}

printf 'Starting paced output demo with delay=%ss total_lines=%s\n' "$DELAY_SECONDS" "$TOTAL_LINES"

for ((i = 1; i <= TOTAL_LINES; i++)); do
  case $((i % 6)) in
    1) prefix='[scan]' ;;
    2) prefix='[sync]' ;;
    3) prefix='[check]' ;;
    4) prefix='[info]' ;;
    5) prefix='[warn]' ;;
    0) prefix='[done]' ;;
  esac

  printf '%s step=%02d message="pane output sample for gutter screenshots"\n' "$prefix" "$i"
  sleep "$DELAY_SECONDS"
done

printf 'Paced output demo complete.\n'
