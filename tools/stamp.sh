#!/bin/sh
# Writes the time of this push into site/js/version.js so the header can show when a new version went live.
printf "window.GW_BUILT = '%s';\n" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$(dirname "$0")/../site/js/version.js"
