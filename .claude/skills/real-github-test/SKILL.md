---
name: real-github-test
description: >
  Test a bot change end to end against real GitHub and Slack, on the
  reviewflow/reviewflow-test repository with the local dev app. Load when asked
  to try a change "for real", or when unit tests cannot show a webhook flow works.
---

# Real GitHub test

## Setup

- The user runs `pnpm dev`: the webhook server listens on `PORT` (3001) as the
  `reviewflow-dev` GitHub App, fed through the smee proxy in
  `packages/reviewflow/.env`. Rollup watches and restarts it. Check it is running
  and that `packages/reviewflow/build/` is newer than the change; never start or
  stop it yourself, ask the user.
- Test repository: `reviewflow/reviewflow-test` (default branch `master`, repo id
  `167861157`, org `reviewflow` id `64312233`). Use no other repository.
- `gh` is authenticated as `christophehurpeau`: pull requests you open are theirs,
  and that account is linked to Slack in the `reviewflow` org, so owner DMs reach
  them.

## Running a scenario

- Work on dedicated `test/<topic>-*` branches, never on `master`. Write files
  through the contents API, no clone needed. Homebrew's `base64` ends its output
  with `\r\n`: strip both.
- Webhooks arrive within seconds, plus any delay the bot adds itself: poll for the
  expected state instead of sleeping a fixed time.

## Observing

- The server logs are in the user's terminal, out of reach. Observe through the
  local mongo (`mongosh`, database `reviewflow`).
- And through GitHub: the pull request body, labels, statuses and comments the bot wrote.
- Slack itself is only visible to the user: ask them to confirm what a DM looks like.

## Cleanup

Close the pull requests and delete the branches you created, then report the
pull request numbers and the timings you observed.
