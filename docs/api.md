# Reviewflow read API

A read-only HTTP API on the reviewflow webapp server, for tools that follow your pull requests from outside the webapp (vigie, scripts).

> **Status:** early. `GET /api/me/v1`, `GET /api/board/v1`, `GET /api/board-bucket/v1`, `GET /api/pr/v1/<owner>/<repo>/<number>`, `POST /api/prs-lookup/v1`, `GET /api/stream/v1`, `GET /api/health/v1` and `GET /api/health` are available.

## Authentication

1. In the webapp, open **Settings → API tokens** and create a token. It is shown once: copy it then. A lost token can only be regenerated.
2. Send it on every request:

   ```http
   Authorization: Bearer rfp_…
   ```

Tokens start with `rfp_`, so secret scanners can recognise a leaked one. Revoke a token from the same page; regenerating one revokes the old token immediately.

## What a token can read

A token is read-only and reads what you can read in the webapp:

- your own account, **if the reviewflow admin enabled it** (a paid feature);
- each organization you are a member of, **if the reviewflow admin enabled it and an owner of that organization allows personal tokens** (organization settings → API tokens). Personal tokens are off by default.

An account that is not enabled is not read at all: it is left out of `/me/v1`, and answers `403` like an account the token cannot read. To enable one, contact contact@chapplications.com.

The **API tokens** page lists which of your accounts a token reaches. Memberships, organization policies and enablings are re-read at most 5 seconds apart, so leaving an organization, an owner switching tokens off, or an account being disabled takes effect within seconds without revoking the token. An open stream ends with `scopeChanged` within about a minute.

The token page also shows when and from which IP address each token was last used.

A token never carries your GitHub credentials, and nothing in this API calls GitHub on your behalf.

## Conventions

- Base URL: the webapp server, e.g. `https://<reviewflow host>/api`.
- Versioned per endpoint: `/api/<endpoint>/v<n>`.
- JSON in and out. No CORS: a browser should never hold a token.
- Errors use one envelope:

  ```json
  { "error": { "code": "unauthenticated", "message": "…" } }
  ```

  | Status | Code              | When                                                                 |
  | ------ | ----------------- | -------------------------------------------------------------------- |
  | 400    | `badRequest`      | malformed request body or query parameter                            |
  | 401    | `unauthenticated` | missing, unknown or revoked token                                    |
  | 403    | `forbidden`       | the account is outside what the token can read                       |
  | 404    | `notFound`        | unknown resource or endpoint (after authentication)                  |
  | 429    | `rateLimited`     | too many requests; retry after the `Retry-After` header              |
  | 500    | `internal`        | unexpected server failure                                            |
  | 503    | `unavailable`     | the server cannot serve it now; retry after the `Retry-After` header |

- Conditional requests: a successful `GET` of a pull request, the board or a board bucket carries a weak `ETag`, a hash of the response body. Send it back as `If-None-Match` to get `304 Not Modified` with no body when nothing changed, and keep your copy. A `304` still counts against the rate limits and still authenticates the token. The `ETag` is per reader: the same pull request has a different one for each user, because `myBuckets` depends on who asks, so never share one between tokens of different users. Errors, `POST /api/prs-lookup/v1`, `GET /api/me/v1` (its `serverTime` changes on every call, so its `ETag` never helps) and `GET /api/health/v1` are not conditional: no usable `ETag`, no `304`.

## Rate limits

- **Per token**: 60 requests at once, refilled at one per second. A poll every few seconds stays well below it.
- **Per IP address, failed authentication only**: after 10 requests with a missing, unknown or revoked token, the address waits about 6 seconds per further attempt, whatever token it sends. Successful requests do not count.

Past a limit the API answers `429 rateLimited` with a `Retry-After` header, in seconds. Wait that long before retrying.

## Pull request shape

Every endpoint returning pull requests returns this object. Everything but `myBuckets` is the same whoever asks, so a cache keyed on `_id` holds across users. A field reviewflow cannot know for an older pull request is `null`, never a guess.

| Field                                                                                         | Type                                                              | Notes                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `_id`                                                                                         | string                                                            | reviewflow's id, stable for the pull request's lifetime                                                                                                                                                                                                                                                                                                                                                      |
| `accountId`, `repoId`                                                                         | number                                                            | GitHub ids                                                                                                                                                                                                                                                                                                                                                                                                   |
| `ownerRepo`                                                                                   | string                                                            | `owner/name`                                                                                                                                                                                                                                                                                                                                                                                                 |
| `orgLogin`, `repoName`, `number`, `title`, `url`                                              |                                                                   |                                                                                                                                                                                                                                                                                                                                                                                                              |
| `headRef`, `baseRef`, `headSha`, `baseSha`                                                    | string \| null                                                    | branches, head commit, and base branch tip as of the last update of the pull request (not refreshed on a push to the base, not the merge base)                                                                                                                                                                                                                                                               |
| `headRepoFullName`                                                                            | string \| null                                                    | `owner/name` of the head branch: a fork for fork pull requests                                                                                                                                                                                                                                                                                                                                               |
| `state`                                                                                       | `open` \| `draft` \| `closed` \| `merged` \| null                 | `null` for a pull request closed before reviewflow recorded merges                                                                                                                                                                                                                                                                                                                                           |
| `isDraft`                                                                                     | boolean                                                           |                                                                                                                                                                                                                                                                                                                                                                                                              |
| `mergeable`                                                                                   | `mergeable` \| `conflicting` \| `unknown`                         | `unknown` while GitHub computes it after a push to the pull request or its base; reviewflow reads it again about 10 s later, retrying for up to 2 minutes                                                                                                                                                                                                                                                    |
| `flowDates`                                                                                   | object of string \| null                                          | `createdAt`, `openedAt`, `readyAt`, `reviewStartedAt`, `approvedAt`, `closedAt`, `lastPushedAt`, `lastReviewSubmittedAt`, `lastCommentActivityAt` (a conversation comment created, edited or deleted), `lastReviewCommentActivityAt` (the same for a review comment), `lastBodyEditedAt` (the description edited; reviewflow's own rewrites are not counted)                                                 |
| `reviewState`                                                                                 | `none` \| `requested` \| `changesRequested` \| `approved` \| null | changes requested wins over a pending request                                                                                                                                                                                                                                                                                                                                                                |
| `reviewers`                                                                                   | array                                                             | `{ id, login, state, submittedAt, requestedAt }`, the author left out; `state` is `requested`, `reRequested` (asked again after reviewing), `approved`, `changesRequested`, `commented` or `dismissed`                                                                                                                                                                                                       |
| `requestedTeams`                                                                              | string[]                                                          | team names asked for a review                                                                                                                                                                                                                                                                                                                                                                                |
| `labels`                                                                                      | `{ id, name }[]`                                                  | GitHub labels on the pull request                                                                                                                                                                                                                                                                                                                                                                            |
| `approvedBy`, `changesRequestedBy`, `requestedReviewers`, `reRequestedReviewers`, `assignees` | `{ id, login }[]`                                                 |                                                                                                                                                                                                                                                                                                                                                                                                              |
| `creator`                                                                                     | `{ id, login }`                                                   | absent on old pull requests                                                                                                                                                                                                                                                                                                                                                                                  |
| `unresolvedThreads`                                                                           | number \| null                                                    | number of unresolved review threads (outdated ones included); `null` until reviewflow has read them once                                                                                                                                                                                                                                                                                                     |
| `checks`                                                                                      | object                                                            | `conclusion` (`passed`, `failed`, `in-progress`, `unknown`), `runningCount`, `failedNames`, and the counts `passed`, `failed`, `pending`; `checkRuns` (`{ name, status, conclusion, title, detailsUrl }`, `title` being GitHub's `output.title`) and `statuses` (`{ context, state, description, targetUrl }`), sorted by name, with GitHub's values, `null` where reviewflow had not recorded the field yet |
| `lintFailed`, `statusLinks`, `changes`                                                        |                                                                   | reviewflow's title and commit lint, linked statuses, changed files and lines                                                                                                                                                                                                                                                                                                                                 |
| `myBuckets`                                                                                   | string[]                                                          | where it sits on your board, in board order; empty when on none                                                                                                                                                                                                                                                                                                                                              |
| `updatedAt`                                                                                   | string                                                            | last time reviewflow wrote it                                                                                                                                                                                                                                                                                                                                                                                |

Dates are ISO 8601 strings in UTC.

## Endpoints

| Endpoint                                 | Returns                                                     | Status    |
| ---------------------------------------- | ----------------------------------------------------------- | --------- |
| `GET /api/me/v1`                         | your user, the accounts the token reaches, the token's name | available |
| `GET /api/board/v1?account=<login>`      | your pull requests board, grouped like the webapp           | available |
| `GET /api/board-bucket/v1`               | one board bucket, paginated                                 | available |
| `POST /api/prs-lookup/v1`                | pull requests by repository and branch, up to 200 at once   | available |
| `GET /api/pr/v1/<owner>/<repo>/<number>` | one pull request                                            | available |
| `GET /api/health/v1`                     | server health, unauthenticated                              | available |
| `GET /api/health`                        | server health as an HTTP status, for probes                 | available |
| `GET /api/stream/v1`                     | server-sent events: pull request changes as they happen     | available |

Each endpoint gets its request and response documented here when it ships.

### `GET /api/me/v1`

Who the token belongs to and what it reaches. Use it to check a token right after storing it, and as a health probe.

```http
GET /api/me/v1
Authorization: Bearer rfp_…
```

```json
{
  "user": { "id": 42, "login": "octocat" },
  "accounts": [
    { "id": 42, "login": "octocat", "type": "User", "teams": [] },
    {
      "id": 1,
      "login": "acme",
      "type": "Organization",
      "teams": [{ "id": 7, "slug": "web", "name": "Web" }]
    }
  ],
  "token": {
    "name": "vigie on MacBook",
    "createdAt": "2026-10-12T09:00:00.000Z",
    "scopes": ["read"]
  },
  "serverTime": "2026-10-12T09:30:00.000Z"
}
```

- `accounts`: your own account first, then each organization the token reaches. An account that is not enabled, or an organization whose owners have not allowed personal tokens, is left out.
- `teams`: your GitHub teams in that organization, as last synced by reviewflow.
- Dates are ISO 8601 in UTC.
- Not conditional: `serverTime` changes on every call, so its `ETag` is of no use: do not send `If-None-Match`.

Errors: `401` for a missing, unknown or revoked token, `429` past a rate limit.

### `GET /api/health/v1`

Whether the server is up and can read its data. No token needed.

```http
GET /api/health/v1
```

```json
{ "status": "ok", "propagation": "ok", "lagSeconds": 4 }
```

- `status`: `ok`, or `degraded` when the server is reachable but its database does not answer within 2 seconds, or when `propagation` is `lagging`. The HTTP status is `200` either way: read the body.
- `propagation`: `ok`, or `lagging` when the server no longer sees the changes made by the bot live: its link to the bot is down, or nothing arrived from it for 30 seconds (the bot sends a heartbeat every 15 seconds, so that is two missed). Webapp screens then stop updating until the link is back, and the server still answers. `disabled` when the operator switched the link off (`STORE_RELAY_DISABLED`): the status is not degraded, and screens only update on their own changes. Treat any other value as unknown.
- `lagSeconds`: whole seconds since the last message from the bot, heartbeats included, or `null` before the first one since the server started.
- Never carries an `ETag`: always read the body.
- The answer is shared between callers for 5 seconds, and is not subject to the rate limits above, nor blocked by them.

### `GET /api/health`

The same check as `GET /api/health/v1`, for load balancers and container probes that read the HTTP status only. No token needed, unversioned.

```http
GET /api/health
```

```json
{ "status": "ok" }
```

- `200` with `{ "status": "ok" }`, or `503` with `{ "status": "degraded" }` when the database does not answer within 2 seconds.
- Shares its answer, its cache and its exemption from the rate limits with `GET /api/health/v1`.
- Only the database decides the status: a `lagging` propagation does not turn it into `503`, so a restart of the bot does not take the server out of a load balancer.

### `GET /api/board/v1`

The board as the webapp shows it, for the pull requests you own or are asked to review. Same buckets, same membership, same order: the code is the webapp's.

```http
GET /api/board/v1?account=acme
Authorization: Bearer rfp_…
```

```json
{
  "groups": [
    {
      "key": "requesting-attention",
      "title": "PRs requesting your attention",
      "buckets": [
        {
          "key": "requested-reviews",
          "title": "Requested reviews",
          "total": 130,
          "prs": [{ "_id": "6718f0c2a1b2c3d4e5f60718", "number": 412 }],
          "nextPage": "b2Zmc2V0OjEwMA"
        }
      ]
    },
    { "key": "in-progress", "title": "Your PRs in progress", "buckets": [] }
  ]
}
```

- `account` is the login of one account the token reads. Omitted, the board spans every account the token reads, like the webapp's "all accounts".
- Groups and buckets are always all there, in display order, even empty: `requesting-attention` (`re-requested-reviews`, `requested-reviews`, `ready-to-merge`, `changes-requested`) then `in-progress` (`opened-missing-review-request`, `drafts`, `waiting-for-review`). Render them as given.
- Each bucket holds its first 100 pull requests (`prs`, the [pull request object](#pull-request-shape)), sorted like the webapp, and the `total` it holds. `myBuckets` is computed over the same accounts as the board.
- "Your PRs" are the open pull requests you created or are assigned to.
- `nextPage` is `null` when `prs` holds everything, otherwise pass it as `page` to [`GET /api/board-bucket/v1`](#get-apiboard-bucketv1).
- There is no cursor: to catch up after being away, fetch the board again.

Errors:

| Status | Code              | When                                                                                                                                                                              |
| ------ | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 400    | `badRequest`      | `account` is empty or repeated                                                                                                                                                    |
| 401    | `unauthenticated` | missing, unknown or revoked token                                                                                                                                                 |
| 403    | `forbidden`       | `account` is not an account the token reads: not yours, not enabled, an organization whose owners have not allowed tokens, or unknown to reviewflow, the same answer in all cases |
| 429    | `rateLimited`     | past a rate limit                                                                                                                                                                 |

Conditional: `ETag` / `If-None-Match`, see [conventions](#conventions). Poll with it: an unchanged board answers `304` with no body.

### `GET /api/board-bucket/v1`

One bucket of the board, 100 pull requests at a time.

```http
GET /api/board-bucket/v1?bucket=requested-reviews&account=acme&page=b2Zmc2V0OjEwMA
Authorization: Bearer rfp_…
```

The response is one bucket of the board response: `{ key, title, total, prs, nextPage }`.

- `bucket` is required, one of the bucket keys above. `account` is as for the board and must be the same one the `page` came from.
- Omit `page` for the first page; otherwise pass the `nextPage` you were given, untouched. A page token is opaque and only valid for this API: do not build or parse one.
- Pages are read live. A pull request entering or leaving the bucket between two requests can shift the next page by a row: a pull request can appear twice or be missed. `total` is the bucket's size at the time of each request.
- Conditional: `ETag` / `If-None-Match`, see [conventions](#conventions). `total` and the rows are in the hash, so any change to the bucket changes it.

Errors: as for the board, and `400 badRequest` when `bucket` is missing or unknown, or `page` is not a token this API issued.

### `GET /api/pr/v1/<owner>/<repo>/<number>`

One pull request, in the [shape above](#pull-request-shape), with `myBuckets` computed for you in that account.

```http
GET /api/pr/v1/acme/api/412
Authorization: Bearer rfp_…
```

The response is the pull request object, abridged here:

```json
{
  "_id": "6718f0c2a1b2c3d4e5f60718",
  "ownerRepo": "acme/api",
  "number": 412,
  "state": "open",
  "reviewState": "requested",
  "myBuckets": ["requested-reviews"],
  "updatedAt": "2026-10-12T10:00:00.000Z"
}
```

- `owner` and `repo` are case-insensitive.
- Only pull requests reviewflow has handled are known; one it never saw is `404`.

Errors:

| Status | Code              | When                                                                                                                                                                                   |
| ------ | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 401    | `unauthenticated` | missing, unknown or revoked token                                                                                                                                                      |
| 403    | `forbidden`       | `owner` is not an account the token reads: not yours, not enabled, an organization whose owners have not allowed tokens, or unknown to reviewflow. The answer is the same in all cases |
| 404    | `notFound`        | `owner` is readable but the repository or the pull request is unknown, or the number is not a positive integer                                                                         |
| 429    | `rateLimited`     | past a rate limit                                                                                                                                                                      |

`403` depends on the owner only, never on whether the repository or pull request exists, so it cannot be used to probe private repositories.

Conditional: `ETag` / `If-None-Match`, see [conventions](#conventions). Different for each reader, since `myBuckets` is.

### `POST /api/prs-lookup/v1`

The newest pull request of each `(repository, head branch)`, for up to 200 branches in one request. Meant for a tool that tracks branches, not pull requests.

```http
POST /api/prs-lookup/v1
Authorization: Bearer rfp_…
Content-Type: application/json

{ "targets": [{ "ownerRepo": "acme/api", "headRef": "feat/read-api" }] }
```

```json
{
  "results": [
    {
      "found": true,
      "pr": { "_id": "6718f0c2a1b2c3d4e5f60718", "number": 412 }
    },
    { "found": false, "reason": "noPr" }
  ]
}
```

`results` has one entry per target, in the same order. `pr` is the [pull request object](#pull-request-shape), `myBuckets` computed for you.

- `ownerRepo` is the repository the pull request targets, and is case-insensitive; `headRef` is the branch name, case-sensitive.
- Only pull requests whose head branch lives in that repository match: a fork pushing a branch with the same name is not a match.
- The newest pull request is the one with the highest number, open or closed.
- An empty `targets` returns an empty `results`. Identical targets are looked up once.
- Not conditional: a `POST` carries no `ETag` and is never answered `304`, whatever `If-None-Match` it sends. To poll cheaply, resolve the branches to pull request numbers once, then poll `GET /api/pr/v1/...`, which is.

When `found` is `false`, `reason` tells what to do next:

| Reason       | Meaning                                                                                                                                                                                                                             |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `noPr`       | reviewflow tracks the repository and knows no pull request from that branch: there is none                                                                                                                                          |
| `notTracked` | reviewflow cannot tell: the repository is unknown to it, not installed, ignored by the account's configuration, or still holds pull requests recorded without their branch. Ask GitHub instead                                      |
| `forbidden`  | the owner is not an account the token reads (see [what a token can read](#what-a-token-can-read)). The answer is the same whether or not the repository exists. One forbidden target does not fail the others, the status stays 200 |

Errors:

| Status | Code              | When                                                                                               |
| ------ | ----------------- | -------------------------------------------------------------------------------------------------- |
| 400    | `badRequest`      | the body is not JSON, `targets` is not an array of at most 200 `{ ownerRepo, headRef }` of strings |
| 401    | `unauthenticated` | missing, unknown or revoked token                                                                  |
| 429    | `rateLimited`     | past a rate limit                                                                                  |

### `GET /api/stream/v1`

Your pull requests as they change, as [server-sent events](https://html.spec.whatwg.org/multipage/server-sent-events.html): the board, kept current, without polling.

```http
GET /api/stream/v1?account=acme&closedWithinDays=7
Authorization: Bearer rfp_…
Accept: text/event-stream
```

```text
event: pr
data: {"_id":"6718f0c2a1b2c3d4e5f60718","number":412,"state":"open", …}

event: ready
data: {"serverTime":"2026-10-18T10:00:00.000Z"}

event: pr
data: {"_id":"6718f0c2a1b2c3d4e5f60718","number":412,"state":"merged", …}

event: heartbeat
data: {"serverTime":"2026-10-18T10:00:25.000Z"}
```

The scope is every pull request on your board, every open pull request you created or are assigned to, and, with `closedWithinDays`, the ones you created or are assigned to that closed within that many days.

- `account` is as for [the board](#get-apiboardv1): omitted, every account the token reads.
- `closedWithinDays`: an integer from 0 to 30, `0` by default.
- On connect, one `pr` event per pull request in scope, then `ready`. Then the changes as they happen.

| Event          | Data                                                  | When                                                                                                                                                                 |
| -------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pr`           | the [pull request object](#pull-request-shape)        | a pull request in scope changed or entered it. A pull request that closes gets a last `pr` with its closed or merged `state`, even when closed ones are out of scope |
| `prRemoved`    | `{ "_id", "reason": "outOfScope" \| "deleted" }`      | a pull request left the scope for another reason (no longer assigned, review request removed…), or was deleted                                                       |
| `ready`        | `{ "serverTime" }`                                    | the pull requests in scope have all been sent                                                                                                                        |
| `heartbeat`    | `{ "serverTime" }`                                    | every 25 s, so that a proxy keeps the connection and you can tell a dead one                                                                                         |
| `scopeChanged` | `{}`                                                  | the accounts the token reads, or your teams, changed. The stream then ends: reconnect                                                                                |
| `reset`        | `{ "reason": "resync" \| "tokenRevoked" \| "error" }` | the stream ends: reconnect, which sends the scope again. `tokenRevoked`: reconnecting answers `401`                                                                  |

- Events are state, not deltas: each `pr` carries the whole pull request. Several changes of one pull request within a second are sent as one event with the latest state, and a change of `updatedAt` alone is not sent.
- There is no resume: after a disconnection, reconnect and take the `pr` events before `ready` as the current state; drop what you held that they do not include.
- A revoked token or a membership change is noticed within a minute.
- One stream per token: a second one is refused with `429` while the first is open. Each stream holds one of the live connections the server allows per user and in total: past them, `503 unavailable`.
- Changes reach the stream within a second or two of reviewflow receiving the GitHub webhook.
- Behind a reverse proxy, turn response buffering off for this path (the server already sends `X-Accel-Buffering: no` for nginx).

Errors, before the stream starts:

| Status | Code              | When                                                                                      |
| ------ | ----------------- | ----------------------------------------------------------------------------------------- |
| 400    | `badRequest`      | `account` is empty or repeated, `closedWithinDays` is not an integer from 0 to 30         |
| 401    | `unauthenticated` | missing, unknown or revoked token                                                         |
| 403    | `forbidden`       | `account` is not an account the token reads                                               |
| 429    | `rateLimited`     | past a rate limit, or the token already has an open stream                                |
| 503    | `unavailable`     | the server holds too many live connections for you or in total; retry after `Retry-After` |
