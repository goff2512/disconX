#!/bin/bash
# Double-click in Finder to start LAN Chess.
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo; echo "  Node.js is not installed. Get the LTS version from https://nodejs.org"; echo
  read -n 1 -s -r -p "  Press any key to close."; exit 1
fi
node launch.js "$@"
