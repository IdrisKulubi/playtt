#!/usr/bin/env bash
set -euo pipefail

# In a monorepo, EAS otherwise archives from the Git root. Pin both the
# no-VCS workflow and project root so only playtt-mobile is uploaded.
app_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$app_root"

export EAS_NO_VCS=1
export EAS_PROJECT_ROOT="$app_root"

exec eas build "$@"
