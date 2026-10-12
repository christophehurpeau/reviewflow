#!/bin/sh
#
# Run the pr branches backfill through the internal api of a running bot.
#
# Usage (run from packages/reviewflow, on the server running the bot):
#   scripts/backfill-pr-branches.sh [--write] [--repository=<github repo id>]
#
# Default is a dry run, which still spends one github call per pull request to
# backfill: dry run a single repository, not all of them.
#
# INTERNAL_API_SECRET, INTERNAL_API_HOST and INTERNAL_API_PORT come from the
# environment, else from the .env the bot loads (ENV_FILE, default ./.env).
#
# The response only comes once every repository is done: each repository's
# report is logged by the bot as it finishes ("backfill pr branches"). Re-run
# once `rateLimitResetsAt` is past for the repositories left `rateLimited`.

set -eu

dry_run=true
repository_id=

for arg in "$@"; do
  case "$arg" in
    --write) dry_run=false ;;
    --repository=*) repository_id="${arg#--repository=}" ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 2
      ;;
  esac
done

case "$repository_id" in
  *[!0-9]*)
    echo "Invalid --repository: $repository_id" >&2
    exit 2
    ;;
esac

env_file="${ENV_FILE:-.env}"

# reads KEY=value like dotenv: surrounding quotes and unquoted trailing comments dropped
read_env_file() {
  [ -f "$env_file" ] || return 0
  sed -n "s/^[[:space:]]*\(export[[:space:]]\{1,\}\)\{0,1\}$1[[:space:]]*=[[:space:]]*//p" "$env_file" |
    tail -n 1 |
    sed -e 's/^"\(.*\)"[[:space:]]*$/\1/' \
      -e "t" \
      -e "s/^'\(.*\)'[[:space:]]*\$/\1/" \
      -e "t" \
      -e 's/[[:space:]]\{1,\}#.*$//' \
      -e 's/[[:space:]]*$//'
}

secret="${INTERNAL_API_SECRET:-$(read_env_file INTERNAL_API_SECRET)}"
host="${INTERNAL_API_HOST:-$(read_env_file INTERNAL_API_HOST)}"
port="${INTERNAL_API_PORT:-$(read_env_file INTERNAL_API_PORT)}"

if [ -z "$secret" ]; then
  echo "INTERNAL_API_SECRET missing from the environment and from $env_file" >&2
  exit 1
fi

url="http://${host:-127.0.0.1}:${port:-3002}/api/internal/backfill/pr-branches"

body="{\"dryRun\":$dry_run"
[ -n "$repository_id" ] && body="$body,\"repositoryId\":$repository_id"
body="$body}"

echo "POST $url $body" >&2

# the authorization header goes through stdin so the secret never shows in ps
response="$(
  printf 'Authorization: Bearer %s\n' "$secret" |
    curl -sS --fail-with-body -X POST "$url" \
      -H @- \
      -H 'Content-Type: application/json' \
      -d "$body"
)" || {
  status=$?
  echo "$response" >&2
  exit "$status"
}

if command -v jq > /dev/null; then
  echo "$response" | jq .
  echo "$response" |
    jq -r '"dryRun: \(.dryRun)", (.reports | group_by(.status)[] | "\(.[0].status): \(length)")' >&2
else
  echo "$response"
fi
