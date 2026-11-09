#!/usr/bin/env sh

# Run by the post-checkout hook in a new git worktree. Lint resolves the
# workspace libraries through their package exports, which point at their
# rollup build: build them, not the apps (expo exports are slow and unused).

set -e

pnpm install --frozen-lockfile
pnpm --filter @reviewflow/modules --filter @reviewflow/core --filter @reviewflow/sdk run build
