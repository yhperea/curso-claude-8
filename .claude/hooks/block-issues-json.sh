#!/usr/bin/env bash
# PreToolUse: impide que el agente lea scripts/issues.json por cualquier vía
# (Read, Grep, Glob, Bash...). Exit 2 bloquea la herramienta y envía stderr a Claude.
input=$(cat)
if jq -c '.tool_input // {}' <<<"$input" | grep -qi 'issues\.json'; then
  echo "Bloqueado por hook: el acceso a issues.json no está permitido." >&2
  exit 2
fi
exit 0
