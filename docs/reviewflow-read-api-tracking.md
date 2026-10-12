# reviewflow read API — implementation tracking

Spec: [reviewflow-read-api.md](reviewflow-read-api.md) (request from vigie, 2026-10-06).
Review of the spec against `9a061871` (2026-10-07). Status: **accepted with amendments**.

Legend: `[ ]` todo, `[~]` in progress, `[x]` done, `[-]` dropped (say why). One lot = one PR.

## Milestones

- **M1 — vigie polls reviewflow** (D8): L01, L02, L03, L08–L24, L37. Acceptance §12 items 3 and 4. vigie stops spending GraphQL quota.
- **M2 — vigie streams from reviewflow**: L01b, L25–L29, L31–L33. Acceptance §12 items 1, 2 (amended, A16) and 5. The webapp board also updates on webhook writes.
- **Extras**: L34–L36 (SHOULD/COULD), any time.

## Status

| Lot  | Phase       | Title                                                   | Reqs      | Depends on    | Status          |
| ---- | ----------- | ------------------------------------------------------- | --------- | ------------- | --------------- |
| L01  | 0 infra     | `docs/deployment.md`: mongo, reverse proxy, public URL  | Q1, Q2    | —             | in progress     |
| L01b | 0 infra     | Mongo: upgrade; replica set if D1 = (a)                 | R1        | —             | todo (operator) |
| L02  | A writes    | Mongo in tests and CI                                   | —         | —             | done            |
| L03  | A writes    | Move to liwi 14, drop the local `prsWriter`             | R1 prereq | —             | done            |
| L04  | A writes    | Migrate event handler updates to the helper             | —         | —             | dropped         |
| L05  | A writes    | Migrate action, repository and webapp-server updates    | —         | —             | dropped         |
| L06  | A writes    | Inserts, deletes and bulk writes through the helper     | —         | —             | dropped         |
| L07  | A writes    | Retention cleanup through the helper, on `updated`      | —         | —             | dropped         |
| L08  | B data      | Persist `headRef`, `baseRef`, `headRepoFullName`        | R4, R5    | —             | done            |
| L09  | B data      | Persist `merged` → `state`                              | R5        | —             | done            |
| L10  | B data      | `flowDates.lastPushedAt`, `lastReviewSubmittedAt`       | R8        | —             | done            |
| L11  | B data      | Per-reviewer `requestedAt` / `submittedAt`              | R8        | —             | done            |
| L12  | B data      | Persist `reviewState` from `calcCodeReviewStep`         | R5        | —             | done            |
| L13  | B data      | Drop `automergeStatus`                                  | —         | —             | done            |
| L14  | B data      | Backfill head/base/head repo/merged on every document   | R4        | L03, L08, L09 | done            |
| L15  | C tokens    | `personalTokens` store, liwi resource, webapp section   | R2        | —             | done            |
| L16  | C tokens    | Webapp: personal tokens section                         | R2        | L15           | merged into L15 |
| L15b | C tokens    | Org owners allow personal tokens; status per org        | R2, §9    | L15           | done            |
| L17  | C tokens    | `/api` router, bearer auth, `GET /api/me/v1`            | R2, R3    | L15           | done            |
| L18  | C tokens    | Rate limiting per token                                 | R2        | L17           | done            |
| L19  | D REST      | `PrDetail` type and `toPrDetail`                        | R5        | L03, L08–L12  | done            |
| L20  | D REST      | `GET /api/pr/v1/:owner/:repo/:number`                   | —         | L17, L19      | todo            |
| L21  | D REST      | `POST /api/prs-lookup/v1`                               | R4        | L14, L17, L19 | todo            |
| L22  | D REST      | `GET /api/board/v1` and `/api/board-bucket/v1`          | R6        | L17, L19      | todo            |
| L23  | D REST      | `ETag` / `If-None-Match`                                | —         | L20–L22       | todo            |
| L24  | D REST      | `GET /api/health/v1` (without propagation)              | —         | L17           | todo            |
| L25  | E propagate | Pre-images on, replica-set test infra                   | R1        | L01b, L02     | todo            |
| L26  | E propagate | Change stream consumer in webapp-server feeding liwi    | R1        | L03, L25      | todo            |
| L27  | E propagate | `orgMembers` and `repositories` in the consumer         | R1        | L26           | todo            |
| L28  | E propagate | Board ordering on pushed changes                        | R1        | L26           | todo            |
| L29  | E propagate | Health: `propagation` and `lagSeconds`                  | R1        | L24, L26      | todo            |
| L30  | F stream    | `cursor` in board and lookup responses                  | —         | —             | dropped         |
| L31  | F stream    | SSE endpoint: auth, heartbeat, limits, revocation       | R7        | L01, L17      | todo            |
| L32  | F stream    | Live `pr` / `prRemoved` events with per-caller scope    | R7        | L26, L31      | todo            |
| L33  | F stream    | Snapshot-then-live, `reset`, `scopeChanged`, coalescing | R7        | L32           | todo            |
| L34  | G extras    | Paginate checks past 100                                | Q5        | —             | dropped         |
| L35  | G extras    | `mergeable`                                             | R10       | —             | done            |
| L36  | G extras    | `unresolvedThreads`                                     | R9        | —             | todo            |
| L37  | H rollout   | Tell Elax members, enable tokens for the Elax account   | §9        | L18, L24      | todo            |
| L38  | H rollout   | Acceptance §12 against prod                             | §12       | M1, M2        | todo            |

Public doc: [api.md](api.md), linked from the webapp API tokens page. Each endpoint lot (L17, L20–L24, L31) documents its request and response there and flips its status to available.

Parallel tracks now: L01/L01b (operator), L08–L13, L15 → L16/L17…, L34–L36. L03 (liwi 14 is out).

## Amendments to the spec

Facts that changed or were wrong at `4ce3d6e8`, and decisions that change the request; the spec text stays as the request, these override it.

| #   | Spec     | Correction                                                                                                                                                                                                                                                                                                                                                                                                       |
| --- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | §7.2, §8 | Since `9a061871` the "owned" buckets match `assignees.id` **or** `creator.id` (`core/src/prBucketCriteria.ts:93-101`), confirmed by D11. Open authored PRs are already on the board; the stream's "authored" clause is only needed for **closed** ones. The vigie spec must be amended.                                                                                                                          |
| A2  | §6       | `headSha` already exists on `ReviewflowPr` (optional, indexed with `repo.id`). Only `headRef` / `baseRef` are new.                                                                                                                                                                                                                                                                                               |
| A3  | §7.2     | Group keys exist: `requesting-attention`, `in-progress` (`modules/src/prs/prBucketDisplay.ts:8`). Reuse them, don't invent `attention` / `inProgress`.                                                                                                                                                                                                                                                           |
| A4  | §4       | `orgTeams` is a plain `MongoStore`, not a subscribe store. Team membership that drives buckets is `orgMembers.teams`, which is already subscribed.                                                                                                                                                                                                                                                               |
| A5  | §6       | liwi ≤ 13 stamps `updated` on insert, and on replace/upsert only when the caller omits it; partial updates never touch it, so on `prs` `updated` ≈ insert time and the 12-month cleanup deletes by creation age. Fixed by liwi 14 (L03). `updated` is the app clock: fine for `updatedAt` and retention, not for ordering events (A17).                                                                          |
| A6  | §6, R4   | `headRef` is the join key and no stored document has it. A lookup cannot tell "no document" from "document without `headRef`", so without a backfill of **every** document (open and closed) it answers `noPr` for PRs merged before the deploy, and vigie does not fall back to `gh` on `noPr`. L14.                                                                                                            |
| A7  | §7.3     | `(owner/repo, headRef)` is ambiguous for fork PRs (several forks can push `main`). Store `headRepoFullName` and match on it (default: same repo).                                                                                                                                                                                                                                                                |
| A8  | R9       | `pull_request_review_thread` is already enabled in the GitHub App settings (operator, 2026-10-12): the events are delivered and ignored, no handler. L36 needs no settings change nor re-approval.                                                                                                                                                                                                               |
| A9  | §4       | liwi pushes are re-tested on criteria only; the client (`react-liwi` `applyCollectionChanges`) re-sorts inserts on `PrSummary`, which lacks `created` and `flowDates.openedAt`, and never re-sorts updates. Existing webapp bug (not re-verified in the client code). L28.                                                                                                                                       |
| A10 | §4       | liwi ≤ 13 emits the caller's object as `prev`, so handlers that mutate the loaded document before writing (`opened.ts:59-62`, `synchronize.ts:40-43`, `actions/utils/labels/reviewflowPrLabels.ts:31`, `updateAfterReviewChange.ts:21`) or overlap with another webhook make bucket leaves invisible. Fixed in-process by liwi 14 (L03); across processes, change-stream pre-images carry the true `prev` (L26). |
| A11 | §4, §8   | The startup cleanup deletes through the raw collection, bypassing the subscribe wrapper. Change streams see every write, raw ones included (L26).                                                                                                                                                                                                                                                                |
| A12 | §9       | ~~`orgs.config.allowPersonalTokens` can only be set in mongo by the instance operator.~~ Superseded by D14 (2026-10-12): GitHub org owners toggle it from the org settings, role checked live through the bot (L15b). Default: false (D9). The spec's "(default true)" in §5 is overridden by D9.                                                                                                                |
| A13 | §7       | No rate-limit middleware, no SSE anywhere, and the reverse proxy config is not in the repo (`docs/deployment.md` is a dead link). L01, L18, L31.                                                                                                                                                                                                                                                                 |
| A14 | §6       | `reviewState` cannot be "the same rules as prBucketCriteria": `changes-requested` and `waiting-for-review` overlap. Resolved by D6: derived from `calcCodeReviewStep`.                                                                                                                                                                                                                                           |
| A15 | —        | The repo had no mongo in its test setup. L02.                                                                                                                                                                                                                                                                                                                                                                    |
| A16 | §8, §12  | No 72 h replay (D12). Reconnecting means refetching: events are full state, and "what happened while away" is answered by state (§11). `reset` is the normal reconnect path; no `cursor` in `board` / `prs-lookup` responses. Acceptance 2 becomes: after a 12 h sleep, the client refetches and the board is correct.                                                                                           |
| A17 | §6, §8   | No `revision` in `PrDetail`. Ordering is done server-side: the stream sends the snapshot first, then only change-stream events newer than it (cluster time). `updated` is not an ordering key (app clock).                                                                                                                                                                                                       |

## Decisions

| #   | Decision                                                                                                                                                  | Options                                                                                                                                                                         | Recommendation / outcome                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Owner    | Status             |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------ |
| D1  | Propagation mechanism (§4, spec Q1)                                                                                                                       | (a) mongo change streams with pre/post images; (b) bot → webapp-server POST; (c) change log collection tailed by webapp-server; a message broker (RabbitMQ, …) was also weighed | Leaning (a). Prod is mongo 6.0.29 (pre-images exist since 6.0), standalone and shared with other projects; (a) needs it converted to a single-node replica set (L01b), **not validated**. (a) sees every write from every process with the true before/after and needs no write wrapper. (b) loses events while webapp-server is down; (c) and a broker need a write wrapper at every call site (a broker also needs an outbox to avoid dual writes). Only needed for M2: decide before L25. | operator | open (M2)          |
| D2  | Change log protocol if (c)                                                                                                                                | —                                                                                                                                                                               | Only if D1 = (c): log entry written before the document write, tailer diffs against its last-seen copy.                                                                                                                                                                                                                                                                                                                                                                                      | impl     | on hold (D1)       |
| D3  | `flowDates.approvedAt`: declared, never written, but `formatPrFlowDate` (`modules/src/prs/formatPrRow.ts:66-72`) already shows "approved <date>" when set | write it / drop it                                                                                                                                                              | Out of scope here, to do separately. `PrDetail.flowDates.approvedAt` stays `null` until then.                                                                                                                                                                                                                                                                                                                                                                                                | operator | decided 2026-10-07 |
| D4  | `automergeStatus`: declared, never written                                                                                                                | drop / implement                                                                                                                                                                | drop from the model (L13)                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | impl     | open               |
| D5  | Checks past 100 (spec Q5)                                                                                                                                 | paginate / `truncated: true`                                                                                                                                                    | paginate `listForRef` (L34); no `truncated` field (dropped 2026-10-12, never reached)                                                                                                                                                                                                                                                                                                                                                                                                        | impl     | open               |
| D6  | `reviewState` when changes are requested and a review is still pending (A14)                                                                              | `changesRequested` / `requested`                                                                                                                                                | `changesRequested`, without changing reviewflow's behaviour: derived from the existing `calcCodeReviewStep`, persisted at write time (L12).                                                                                                                                                                                                                                                                                                                                                  | operator | decided 2026-10-07 |
| D7  | Fork PRs in lookup (A7)                                                                                                                                   | store head repo and match / exclude forks                                                                                                                                       | store `headRepoFullName`, match it (L08, L21)                                                                                                                                                                                                                                                                                                                                                                                                                                                | impl     | open               |
| D8  | Order of vigie integration                                                                                                                                | REST polling first, SSE after / both together                                                                                                                                   | REST first (M1 then M2)                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | operator | decided 2026-10-07 |
| D9  | `allowPersonalTokens` default                                                                                                                             | true everywhere / false, operator enables per org / true for the operator's org only                                                                                            | false; enabled per org (by its GitHub owners since D14)                                                                                                                                                                                                                                                                                                                                                                                                                                      | operator | decided 2026-10-07 |
| D14 | Who enables `allowPersonalTokens`                                                                                                                         | instance operator in mongo / GitHub org owners from the webapp                                                                                                                  | GitHub org owners, role checked live through the bot on each write (L15b)                                                                                                                                                                                                                                                                                                                                                                                                                    | operator | decided 2026-10-12 |
| D10 | Lookup when `headRef` is unknown                                                                                                                          | backfill all documents / answer `notTracked` while a repo still has documents with null `headRef`                                                                               | backfill all (L14); keep the `notTracked` rule as a guard until the backfill reports done (L21)                                                                                                                                                                                                                                                                                                                                                                                              | impl     | open               |
| D11 | "Your PRs" ownership                                                                                                                                      | creator + assignee (code) / assignee only (spec)                                                                                                                                | creator + assignee                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | operator | decided 2026-10-07 |
| D12 | Stream resume after the client was away (spec §8: 72 h)                                                                                                   | 72 h replay / refetch on reconnect                                                                                                                                              | refetch on reconnect (A16): a refetch is a few indexed queries; replay adds retention, cursors and oplog sizing for no data vigie reads                                                                                                                                                                                                                                                                                                                                                      | operator | decided 2026-10-11 |
| D13 | No-op updates: since liwi 14 they are real writes (oplog entry, pre-image, change-stream event)                                                           | leave as is / skip in reviewflow with a DB-side condition / ask liwi for a `skipIfUnchanged` option on `$set` updates                                                           | Don't compare against the handler's loaded copy (stale → skipped real change). liwi 14 throws `NotFoundError` when an update's filter matches nothing, so a DB-side "only if changed" filter needs liwi support. Measure oplog volume after L01b before doing anything.                                                                                                                                                                                                                      | operator | open               |

## Phase 0 — Infra

### L01 — `docs/deployment.md`

- [x] Prod mongo: 6.0.29, standalone, shared with other projects (2026-10-11).
- [x] Reverse proxy (2026-10-12): nginx on the same host, `upstream 127.0.0.1:3000` (keepalive 64), HTTP/1.1, `Connection ""`, sets `Host`, `X-Real-IP`, `X-Forwarded-For` (`$proxy_add_x_forwarded_for`), `X-Forwarded-Proto`; `proxy_read_timeout 240s`. Nothing in front of nginx (to confirm). webapp-server runs with `TRUST_PROXY=loopback`.
- [ ] SSE on `/api/stream/*` (L31): the 240 s read timeout covers the 25 s heartbeat; nginx buffers responses by default, so the stream sends `X-Accel-Buffering: no` (or `proxy_buffering off` on that location).
- [ ] Public webapp-server URL (`REVIEWFLOW_APP_URL`), for vigie's settings (spec Q2).

Done when: the README link resolves and the facts are written down, including L01b's outcome.

### L01b — Mongo upgrade and replica set (operator)

The mongod is shared: every step restarts all projects on it. The upgrade is agreed; the replica set steps only apply if D1 = (a).

- [ ] Upgrade 6.0 (unsupported since 2025-07) → 7.0 → 8.0, one major at a time, `featureCompatibilityVersion` raised after each.
- [ ] If D1 = (a): convert to a single-node replica set (`--replSet`, `rs.initiate()`), with a member host every client of every project can reach; check each project's connection string.
- [ ] Size the oplog on the write volume of all databases. With D12 it only needs to cover a webapp-server restart, not 72 h; record the window (`rs.printReplicationInfo()`).
- [ ] Bound pre-image storage (`changeStreamOptions.preAndPostImages.expireAfterSeconds`).

Done when: prod runs as a replica set and the version, oplog window and pre-image expiry are in `docs/deployment.md`.

## Phase A — liwi 14 and test infra

### L02 — Mongo in tests and CI

- [x] `mongodb-memory-server` wired into the root vitest config for `core` and `reviewflow`.
- [x] CI runs it (configured; first CI run not observed yet).

`5beae838`. L02b `30e46015`: `init()` exposes `ready`, a fresh database no longer rejects unhandled, CI cache key on `hashFiles`. Servers do not await `ready`; index setup per collection is sequential, so a failing `createIndex` skips that collection's later indexes and cleanup.

- [-] L02c: dropped 2026-10-11 — tests stay on mongo 7.0.x, the prod target of the upcoming upgrade (L01b).

### L03 — liwi 14

liwi 14.0.0 published 2026-10-11 12:45 UTC. Its acceptance 8 holds in the code: a delete between an update and its `next` read makes `partialUpdateByKey` throw `DeletedAfterUpdateError` and emit nothing; `partialUpdateMany` skips that document (`SubscribeStore.ts`, tested in `SubscribeStore.test.ts`). The write itself succeeded: callers must not treat that error as a failed update.

- [x] Bump liwi packages to 14.
- [x] Remove the local `prsWriter` and the `revision` field (`fdc93274`): liwi now emits the true `prev` and stamps `updated`.
- [x] `NotFoundError`: find the writes (46 calls to `partialUpdate*` / `delete*` / `replaceOne` across stores) that can target a missing document — e.g. a webhook on a PR removed by retention — and handle it where the old silent no-op was relied on.
- [x] `ProtectedFieldUpdateError`: no write touching `created` / `updated` found outside `prsWriter` (grep, 2026-10-11); the test suite confirms.
- [x] `touchUpdated: false` on sync and maintenance writes that must not count as activity (at least the L14 backfill; review account/org syncs).

Done when: the suite passes on liwi 14 and `prsWriter` is gone.

`cec1056b`. All liwi packages on 14.0.0, react-liwi 14.0.1 (peer widened to `react ^19.0.0`, react stays 19.2.8 for Expo SDK 57). `NotFoundError` handled where reachable: `setRepositoryArchived`, `updateRepositoryAccount` (repository and PR loop), `startReview`; the 14 PR-handler writes are left to fail and log on a concurrent delete. `touchUpdated: false` on repo rename/transfer, label changes, team/repository syncs. Repeated `NotFoundError` try/catch (3 places) could become a helper.

### L04–L07 — dropped (2026-10-11)

Superseded: liwi 14 emits the true `prev` and stamps `updated` for every caller (L03). If D1 ends up (c), M2 brings back a write wrapper for the change log; with (a), change streams see every write, raw deletes included (L26).

## Phase B — Missing PR data

Old documents: every new field is `null` until written or backfilled, never guessed.

### L08 — Branches

- [x] Persist `headRef`, `baseRef`, `headRepoFullName` from `pull_request` opened, edited, synchronize, reopened.
- [x] Index for the lookup. Check what an org rename does to `account.login` first; if it is not updated, index on ids and resolve login → id in L21.

`be28944c`. Written in `editOpenedPR` (opened, edited, synchronize, reopened, and also readyForReview, convertedToDraft, commentBodyEdited) and on insert. `headRepoFullName`: `null` when the head repo was deleted, absent when unknown (minimal `check_run` PRs). Index `{account.id, repo.id, headRef}` on ids, since account renames are not handled: L21 resolves `owner/repo` to ids through `repositories`, and matches `headRepoFullName` unindexed.

### L09 — Merged

- [x] Persist `merged` on `pull_request.closed` (read at `closed.ts:51`, not stored); reset on reopened.

### L10 — Push and review dates

- [x] `flowDates.lastPushedAt` on opened and synchronize (receipt time).
- [x] `flowDates.lastReviewSubmittedAt` on review submitted.

### L11 — Per-reviewer dates

- [x] `requestedAt` on `review_requested`, `submittedAt` for every review kind (today only `reviews.reviewed[].endedAt`). Shape is the implementer's call; keep the existing `reviews` arrays unchanged for the bucket criteria.

### L12 — `reviewState`

- [x] Map `calcCodeReviewStep` (`reviewflow/src/events/pr-handlers/actions/utils/steps/codeReviewStep.ts`) to `none | requested | changesRequested | approved` (changes requested first, D6) and persist it wherever steps are recomputed. No change to `calcCodeReviewStep` itself.

### L13 — Drop `automergeStatus`

- [x] Remove the field from `ReviewflowPr` (D4).

### L14 — Backfill

- [x] Script for **all** `prs` documents: one REST `pulls.get` each for head, base, head repo, merged. Idempotent, rate-limit aware, per installation, records completion per repo (used by the L21 guard). Writes with `touchUpdated: false` so retention is not reset.
- [x] Run on prod (operator): one repository dry run first to size the quota, then all.

Done when: run on prod, completion recorded for every repo.

`ff5a5c83`, run on prod then removed (route, script, `prBranchesBackfilledAt`, `prsMissingBranchFieldsCriteria`): new documents get the fields from webhooks, so nothing needs it after the run. To run it again, revert the removal commit. It was an internal API route on the bot's loopback listener, dry run by default:

```sh
curl --max-time 0 -X POST http://127.0.0.1:3002/api/internal/backfill/pr-branches \
  -H "Authorization: Bearer $INTERNAL_API_SECRET" -H "Content-Type: application/json" \
  -d '{"repositoryId":123}'                  # dry run, one repository (reads github, writes nothing)
  # -d '{"dryRun":false}'                    # real run, all repositories
```

- Selects documents missing `headRef` / `baseRef` / `headRepoFullName`, or closed without `isMerged`; writes only the absent fields, `touchUpdated: false`.
- Stops an installation when `x-ratelimit-remaining` < 500 (quota shared with the bot) or on a rate-limit error; re-run after `rateLimitResetsAt`.
- PR 404 with the repo reachable: left as is, counted `notFoundOnGithub`, fetched again on each run. Repo 404: `repositoryGone`, fix with `/sync/repository`.
- Completion: `repositories.prBranchesBackfilledAt`, set only when a repository ends `complete`.
- Not repaired, only counted: `stateMismatches` (open/closed differs from github, e.g. a missed `closed` webhook).

## Phase C — Personal API tokens

### L15 — Store, liwi resource and webapp section (L16 merged in)

- [x] `personalTokens` collection: `userId`, `name`, `hash` (sha-256), `prefix`, `created` (liwi), `lastUsedAt`, `lastUsedIp`, `revokedAt`. Token `rfp_` + 32 random bytes base64url, returned once.
- [x] liwi resource: query own active tokens; create, regenerate, revoke (cookie session only: the websocket only reads the `auth_gh` cookie).
- [x] In `sections/user/UserScreen.tsx`: list, create with a name, copy once, regenerate, revoke; stories.

`461428b1`. Merged with L16 so the lot can be tested by hand. Active = `revokedAt` absent (`$exists: false`; liwi `Criteria` rejects `null`). Revocation is soft: the document keeps `lastUsedAt`/`lastUsedIp` for a leak investigation. Regenerate = revoke, then insert under the same name (a failure in between leaves no active token, never the old one valid). Limits: name 1–100 chars, 20 active tokens per user. Rows are static, so they sit in a `SettingsSection`, not a `ListSection`. Clipboard: `expo-clipboard` on native, `navigator.clipboard` on web (`clipboard.web.ts`): `expo-clipboard` breaks the vite dependency optimizer of the web stories.

### L16 — merged into L15

### L15b — Org owners allow personal tokens (D14)

Who decides: the GitHub owners of the org, since enabling it lets every member read the org's PR state from outside reviewflow. The owner role is checked live through the bot on every write, never trusted from the client.

- [x] `core`: export `OrgConfig`, add `allowPersonalTokens?: boolean` (absent = false, D9) and `allowPersonalTokensChangedBy?: { id; login; at }` for the audit.
- [x] Bot internal route `POST /org/member-role { orgId, userLogin }` → `200 { role: "admin" | "member" | null }`. It calls `orgs.getMembershipForUser` with the installation octokit; `null` on 404 or `state !== "active"`. First internal route returning JSON: `callBotApi` gets a variant that parses the response.
- [x] webapp-server: `requireOrgOwner` = `requireOrgMember` + bot role `admin`, otherwise `FORBIDDEN` ("Only an owner of <org> can change this").
- [x] `orgsService`:
  - query `queryOrgPersonalTokensPolicy({ orgId })`: single item on `orgs`, so a toggle pushes live → `{ _id, allowPersonalTokens, viewerIsOwner }`. `viewerIsOwner` is read once when the subscription is created; display only.
  - operation `setAllowPersonalTokens({ orgId, allow })`: `requireOrgOwner`, then `$set` the flag and `allowPersonalTokensChangedBy`.
- [x] `OrgSummary` (`queryMyOrgs`) gains `allowPersonalTokens: boolean`, pushed live through the existing `orgs` subscription.
- [x] Webapp, org settings: an "API tokens" section with a `Switch`, enabled for owners only, and a line on what it opens up. Non-owners see the state and "Only an owner of <org> can change this".
- [x] Webapp, API tokens page: a "Reaches" list with your own account (always) and each org, allowed or not. A `WarningMessage` per org that does not allow tokens: "Ask an owner of <org> to allow personal tokens in its settings."
- [x] Tests: the internal route (owner, member, not a member, 404), `requireOrgOwner`, the operation (owner OK, member and non-member `FORBIDDEN`), the JSON `callBotApi`; stories for the switch states and the per-org statuses.

To verify by hand: does the App's "Members: read" permission (already needed by `orgs.listMembers`) allow `GET /orgs/{org}/memberships/{username}`? Repo docs do not list the App's permissions.

Done when: an owner toggles the flag from the webapp, a member cannot (`FORBIDDEN`), and the API tokens page shows the new status without a reload.

`e6d96bf7`. `syncOrg` upserts orgs without `config`, so the flag is read defensively (`orgAllowsPersonalTokens.ts`, shared with the api since L17); writes on `config.*` create it. `viewerIsOwner` makes `queryOrgPersonalTokensPolicy` call the bot when the query opens: a bot down fails that section only. GitHub `billing_manager` counts as member, a pending invitation as no role. App permission verified 2026-10-12: "Members: read" is enough for `getMembershipForUser` (owner switch worked on the reviewflow org).

### L17 — `/api` router and `GET /api/me/v1`

- [x] Router on webapp-server; JSON; error envelope `{ error: { code, message } }`; no CORS.
- [x] Bearer middleware: lookup by hash (`hashPersonalToken` in `webapp-server/src/auth/personalTokens.ts`), reject revoked, `lastUsedAt`/`lastUsedIp` throttled to once per minute (`touchUpdated: false`).
- [x] Bearer auth on `/api` only, never on the resources websocket: token create/revoke must stay cookie-only.
- [x] HTTP variant of `requireAuth` memberships (today keyed on the websocket user object), same 5 s TTL.
- [x] `orgs.config.allowPersonalTokens`, default false (D9), applied per account in scope.
- [x] `GET /api/me/v1` (spec §7.1).

Done when: a token created in the webapp calls `/api/me/v1`; a revoked one gets `401`.

`f43d3e80`. `webapp-server/src/api/`: `apiRouter` mounted on `/api`, JSON error envelope (`apiErrors.ts`, also for unknown endpoints and unexpected failures), bearer lookup by hash among active tokens (`authenticatePersonalToken.ts`). Last use written at most once a minute, or at once when the ip changes, `touchUpdated: false`, never awaited. The HTTP memberships cache (`tokenAccounts.ts`) is keyed by token id, 5 s TTL; it drops orgs whose owners have not allowed tokens (D14) and always keeps the user's own account. The token now stores `userLogin` (the webapp login records no user; no token existed outside dev). `req.ip` is the proxy's address unless `TRUST_PROXY` is set (express values, e.g. `loopback`): record it in L01. Documented in [api.md](api.md). Manual check pending.

### L18 — Rate limiting

- [x] Per token, `429` with `Retry-After`.
- [x] Per ip on failed authentication (added for security, not in the spec), checked before the token lookup.

`ebf516a9`. In-memory token buckets (`api/rateLimiter.ts`; one webapp-server process). Per token: 60 at once, refilled 1/s. Per ip, failed auth only (missing, unknown or revoked token): 10 at once, refilled 10/min; a blocked ip is refused even with a valid token. Authentication now runs for every `/api` route, so an unknown endpoint answers `401` to an anonymous caller (`/api/health/v1`, L24, must be mounted before it). Documented in [api.md](api.md).

## Phase D — REST endpoints (M1)

### L19 — `PrDetail`

- [x] Type in `modules` (extends `PrSummary`), `toPrDetail` in core next to `toPrSummary`. No `revision` (A17); `updatedAt` from `updated` (A5).
- [x] `myBuckets`: evaluate `buildPrBucketQuery` criteria with mingo, no second implementation of the rules.
- [x] `reviewState`: stored value (L12).
- [x] `reviewers[]`: `submittedAt` from `reviews.reviewed[]`, `requestedAt` from `reviews.reviewRequested[]` (L11); drop the PR creator, as L10 does for `lastReviewSubmittedAt`.
- [x] `state` from `isClosed` / `isDraft` / `isMerged` (L09); a closed document without `isMerged` (one L14 could not reach) is unknown, never "closed".
- [x] `checks.passed/failed/pending/truncated` from the stored conclusion records and `getFailedOrWaitingChecksAndStatuses` rules.

`800bae4a`. `createToPrDetail(viewer)` in `core/src/prs/toPrDetail.ts` compiles the seven bucket criteria once per reader (mingo, now a core dependency) and converts each document; a test runs the same criteria in mongo over fixtures reaching every bucket and checks both agree. Deviations from spec §6:

- `PrDetail` omits `PrSummary`'s flat `openedAt`/`approvedAt` (in `flowDates`) and replaces `checks` with the extended counts; it adds `headRepoFullName` (A7).
- `state`, `reviewState`, every date and branch field are `null` when unknown; `flowDates.createdAt`/`openedAt` too (old documents have no `flowDates`).
- No `githubNodeId`: not recorded, so dropped (operator, 2026-10-12). `mergeable` is `"unknown"` until L35, `unresolvedThreads` `null` until L36.
- `checks.passed` counts `success`/`neutral`/`skipped` checks and `success` statuses only; checks allowed to fail and ignored pendings (codecov, `/hold-`) count nowhere. No `truncated`: dropped 2026-10-12 (operator), no pull request reaches 100 checks.
- `reviewers` excludes teams (in `requestedTeams`) and the author.
  The shape is documented in [api.md](api.md) ("Pull request shape").

### L20 — `GET /api/pr/v1/:owner/:repo/:number`

### L21 — `POST /api/prs-lookup/v1`

- [ ] Up to 200 targets, same order; per-target `forbidden`; match `headRepoFullName` (D7). No `cursor` (A16).
- [ ] `notTracked`: no installation, `shouldIgnoreRepo`, or no document.
- [ ] D10 guard: when no document matches the branch, answer `notTracked` (not `noPr`) if the repository still has documents without `headRef`. Covers both the documents L14 could not reach (no installation, repository gone, PR 404) and those created from a minimal `check_run` payload, which have no `headRef` until their next `pull_request` event. The `prBranchesBackfilledAt` stamp was removed with the backfill.

### L22 — Board

- [ ] `GET /api/board/v1?account=` in `prBucketsInOrder` order, with `prBucketDisplay` group keys and titles (A3). No `cursor` (A16).
- [ ] `GET /api/board-bucket/v1?bucket=&account=&page=`.

### L23 — `ETag`

- [ ] `ETag` / `If-None-Match` on L20–L22.

### L24 — Health

- [ ] `GET /api/health/v1`, unauthenticated; `propagation` reported as unknown until L29.

## Phase E — Cross-process propagation (R1)

### L25 — Pre-images and replica-set tests

- [ ] `init()` enables `changeStreamPreAndPostImages` on `prs`, `orgMembers`, `repositories` when connected to a replica set (idempotent `collMod`; skipped on standalone).
- [ ] Test infra: `MongoMemoryReplSet` (single node) for the tests that need change streams, prod version.

### L26 — Change stream consumer

- [ ] webapp-server watches `prs` with `fullDocument` and `fullDocumentBeforeChange` set to `"required"`, and feeds liwi subscriptions with `callSubscribed` and the true `[prev, next]`.
- [ ] webapp-server's own writes reach subscribers twice (liwi's local emit, then the change event): both carry the same state; drop one or show it is harmless.
- [ ] Stream error or restart: reopen from now; connected clients get `reset` (D12).
- [ ] Update README "Because liwi subscriptions are in-process", drop the dead `plans/` link; update the comment at `reviewsAfterRequestingAgain.ts:31-33`.

Done when: a write from the bot process reaches a webapp-server subscription within 5 s, including a bucket leave.

### L27 — `orgMembers` and `repositories`

- [ ] Same consumer, so membership and repository changes reach subscribers.

### L28 — Board ordering

- [ ] Fix ordering on pushed changes (A9): sort keys in `PrSummary` and re-sort updates, or tell the subscription to refetch.

### L29 — Health propagation

- [ ] `propagation` and `lagSeconds` in `/api/health/v1` from the consumer (time since the last event's cluster time, stream liveness).

## Phase F — SSE stream (M2)

### L30 — dropped (2026-10-11)

No cursor: reconnect means refetch (D12, A16).

### L31 — SSE endpoint

- [ ] `GET /api/stream/v1`, bearer auth, `heartbeat` every 25 s, one stream per token (`429` on a second).
- [ ] Re-check the token at most every 60 s; close on revocation (acceptance 5).
- [ ] Verified behind the real proxy (L01).

### L32 — Live events

- [ ] Per-connection scope: on the caller's board, or assignee, or creator, open or closed (A1).
- [ ] `pr` on any write in scope; `prRemoved` (`outOfScope`, `deleted`) on a transition out.

### L33 — Snapshot then live

- [ ] On connect, send the caller's snapshot first, then only change-stream events newer than it, with no gap (A17).
- [ ] `reset` on stream restart; `scopeChanged` on membership or team changes.
- [ ] Coalesce per `_id` within 1 s.

## Phase G — Extras

### L34 — dropped (2026-10-12)

Operator: no pull request reaches 100 checks; `listForRef` stays one page, and `PrDetail` has no `truncated`.

### L35 — `mergeable` (R10)

- [x] From `pull_request` payloads; `null` from GitHub → `unknown`.
- [x] Back to `unknown` on a push to the base branch (decided 2026-10-12: invalidate only, no re-read).
- [x] Delayed re-read and merge conflict DM (decided 2026-10-12, reverses "no re-read"): the `pr-merge-conflicts` DM needs `conflicting` when it happens, not at the next payload.

`ba1c9c9b`. Written next to the branch fields (insert and `editOpenedPR`) when the payload carries `mergeable`; minimal payloads leave it alone. GitHub sends no event when a base push creates a conflict, so `pushInvalidatesMergeable` resets open pull requests based on the pushed branch (`mergeable` `conflicting`/`mergeable` only, no no-op writes). Absent on older documents → `unknown`.

Re-read (`refreshMergeable.ts`): 10 s after a base push, one GraphQL query lists the open pull requests on that base with their `mergeable` (one call per 100, the read also starts GitHub's computation); after `synchronize` returns `mergeable: null`, one `pulls.get` of that pull request. Retried at 30 s then 90 s for the pull requests still `UNKNOWN`, then given up. A base push with no open pull request in mongo on it costs nothing (every head-branch push is a `push` too). `pulls.get` per pull request on base push stays rejected (N calls); only conflicting pull requests pay one, to build the message. Timers are in memory: a restart drops them, leaving `unknown` until the next payload.

DM (`mergeConflictSlackMessage.ts`, category `pr-merge-conflicts`, sent-message type `pr-merge-conflicts`, keyed per pull request): sent to the owner and the other assignees on `conflicting`, struck through on `mergeable` or when the pull request closes, untouched on `unknown`. Fed by every `editOpenedPR` payload carrying `mergeable` and by the re-read.

### L36 — `unresolvedThreads` (R9)

- [ ] Handle `pull_request_review_thread` resolved/unresolved (already delivered, A8), seed with one GraphQL `reviewThreads` read.

## Phase H — Rollout

### L37 — Elax

- [ ] Tell the Elax org members before enabling (spec §9): what leaves reviewflow (state, no comment bodies), where it goes, who can switch it off (the org owners, from the org settings: D14).
- [ ] An Elax owner allows personal tokens from the org settings (L15b). Other installations stay off (D9).

### L38 — Acceptance §12 against prod

Record date and result per item.

- [ ] 3. Ignored repo → `notTracked`, vigie falls back to `gh` (M1).
- [ ] 4. Same groups, titles, order, counts as the webapp (M1).
- [ ] 1. Review on GitHub → vigie board via stream < 10 s, no `gh` call (M2).
- [ ] 2. 12 h sleep → refetch on reconnect, board correct (M2, A16).
- [ ] 5. Revocation → next request and open stream `401` within 60 s (M2).

## Outside this plan

- [x] `codeReviewStep.ts:53-54` tested `hasRequestedReviewers` twice instead of `hasRequestedTeams`. Fixed in `d4d1480d`.
- `auth_gh` JWT carries a `repo`-scoped GitHub token in clear (spec §5 last paragraph).
- D3 `approvedAt`.
- No handler for account renames (`organization.renamed`, user rename): `account.login` embedded in `prs`, `repositories` and others goes stale; `buildPullRequestUrl`, `reviewAsUser`, `toPrSummary.orgLogin` read it.
- [x] (`c4f1ba52`) Comment density in `be28944c` (field JSDoc restating names, long index comment): trim per the no-comment-by-default rule.
- liwi request: [liwi-change-integrity-spec.md](liwi-change-integrity-spec.md) (delivered as liwi 14, unreleased).

## Log

| Date       | Lot  | Note                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-07 | —    | Spec reviewed against `9a061871`; tracking doc created and critiqued.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-10-07 | —    | Prod mongo is standalone. D3, D6, D8, D9, D11 decided.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-10-07 | —    | Split into PR-sized lots L01–L38.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-10-07 | L02  | `5beae838`. Core tests pass on a real mongod. L02b follow-up opened.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-10-07 | L02  | L02b `30e46015`: `init().ready`, fresh-db fix, CI cache key.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-10-07 | L03  | `fdc93274`: local `prsWriter.updateOne(id, update)` with true `prev`, `updated`, `revision`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-10-07 | L03  | liwi request written: [liwi-change-integrity-spec.md](liwi-change-integrity-spec.md).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-10-11 | L03  | liwi reports L1–L6, L8–L11 delivered as liwi 14 (not on npm yet: latest 13.4.0); acceptance 8 not listed. Upsert `next` still merged in memory (exact for top-level fields). `updated` = app clock: retention only, not event ordering. No-op updates now write; `touchUpdated: false` for sync/maintenance. Mongo ≥ 4.2.                                                                                                                                                                                                                                                                                  |
| 2026-10-11 | —    | Prod mongo 6.0.29, shared; upgrade agreed. D1 leaning (a), replica set not validated, needed for M2 only. D12 no replay, refetch on reconnect; D13 opened. L04–L07 and L30 dropped; L03 becomes the liwi 14 move; L01b and L25 added/rewritten.                                                                                                                                                                                                                                                                                                                                                            |
| 2026-10-11 | L03  | `cec1056b`: liwi 14 (react-liwi 14.0.1), `prsWriter` removed. Suite passes (398 tests).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-10-11 | L02  | L02c dropped: tests stay on mongo 7 (prod target). L08 started.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 2026-10-11 | L08  | `be28944c`: branch fields + index on ids. Verified: core + reviewflow 271 tests.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-10-11 | L09  | `7f08c18e`: `isMerged?: boolean` (closed: payload `merged`; reopened: false; absent on old closed docs = unknown, L19 must not map it to "closed"). Verified: reviewflow 199 tests.                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-10-11 | L10  | `edb396dc`: `lastPushedAt` (opened, synchronize; receipt time), `lastReviewSubmittedAt` (reviews by non-owners only — "reviews received"; skipped when the doc has no `flowDates` yet). Dismissals do not touch it (decide in L11/L19). Verified: reviewflow 202 tests.                                                                                                                                                                                                                                                                                                                                    |
| 2026-10-11 | L11  | `5a63dc84`: `reviews.reviewed[].submittedAt` (last review of any kind, from github `submitted_at`, re-derived on every recompute); `reviews.reviewRequested[].requestedAt` (receipt time of `review_requested`, carried over from the loaded document; dropped when the request goes). Team requests have no date. Known gap: two overlapping webhooks can lose a `requestedAt` (the recompute rewrites `reviews` from a stale copy) → absent, never wrong. `submittedAt` includes the author; L19 drops the creator from `reviewers` to match L10. Verified: core + reviewflow + webapp-server 369 tests. |
| 2026-10-11 | L12  | `a736b905`: `reviewState` via `toReviewState(codeReview)`: changesRequested > pending request > approved; approvals not meeting repo rules (`restrictAutoMergeTo`) → `requested`; else `none`. Written with `reviews` in one `$set` (`updateOnlyReviewflowPrReviews` inlined), in `editOpenedPR` and `closed`; not on checks/labels-only recomputes (D13). Verified: 379 tests.                                                                                                                                                                                                                            |
| 2026-10-11 | L13  | `52fd3f44`: `automergeStatus` removed (no reader or writer; no migration). Phase B code lots L08–L13 done; L14 (backfill) next on the M1 path.                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-10-11 | —    | Rebased onto origin/main (6 dependency bumps, lockfile only) and pushed; hashes in this file updated. tsc + 379 server tests pass after the rebase.                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-10-11 | —    | `c4f1ba52`: comment-only trim on the new PR fields. L14 started.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-10-11 | L14  | `0f351915`: backfill as internal API route, dry run by default, completion on `repositories.prBranchesBackfilledAt`. Verified: 401 server tests. Prod run pending (operator). L21 guard extended for `check_run`-created docs without `headRef`.                                                                                                                                                                                                                                                                                                                                                           |
| 2026-10-12 | L14  | Run on prod. Backfill code removed (route, script, stamp, criteria); L21 guard now relies only on documents without `headRef`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-10-12 | L15  | `461428b1`: personal tokens store, resource (create, regenerate, revoke) and webapp section; L16 merged in. Verified: 446 tests (whole suite), tsc, lint. Manual check in the webapp pending.                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-10-12 | L15b | `84ac4bca`: API tokens moved to a dedicated `/settings/tokens` page. `e6d96bf7`: org owners allow personal tokens (D14), role read live through the bot (`POST /org/member-role`); per-org status on the tokens page. Verified: 470 tests (whole suite), tsc, lint. Manual check pending, including the App permission.                                                                                                                                                                                                                                                                                    |
| 2026-10-12 | L17  | `f43d3e80`: `/api` router, personal token auth, `GET /api/me/v1`, `docs/api.md` updated. Verified: 28 api/token tests, core store test, tsc, lint. Dev tokens created before it lack `userLogin`: regenerate them.                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-10-12 | L18  | `ebf516a9`: rate limits per token and per ip on failed auth. Verified: 21 api tests, tsc, lint. L15b owner switch checked by hand on the reviewflow org.                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-10-12 | L19  | `800bae4a`: `PrDetail` + `createToPrDetail`, mingo/mongo agreement test on every bucket. Verified: 511 tests (whole suite), tsc, lint.                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-10-12 | L19  | `checks.truncated` dropped (operator: 100 checks never happens).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-10-12 | L19  | `a6f2d9a4`: `githubNodeId` dropped (operator: no field reviewflow does not record). `fd486a3c`: `checks.truncated` dropped.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-10-12 | L34  | Dropped (operator).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-10-12 | L35  | `ba1c9c9b`: `mergeable` from payloads, reset on base push. Verified: reviewflow project 233 tests, core `toPrDetail`, tsc, lint.                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
