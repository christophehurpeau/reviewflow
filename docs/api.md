# Reviewflow read API

A read-only HTTP API on the reviewflow webapp server, for tools that follow your pull requests from outside the webapp (vigie, scripts).

> **Status:** early. `GET /api/me/v1`, `GET /api/pr/v1/<owner>/<repo>/<number>` and `POST /api/prs-lookup/v1` are available; the other endpoints ship one by one, and the table below says which ones are.

## Authentication

1. In the webapp, open **Settings → API tokens** and create a token. It is shown once: copy it then. A lost token can only be regenerated.
2. Send it on every request:

   ```http
   Authorization: Bearer rfp_…
   ```

Tokens start with `rfp_`, so secret scanners can recognise a leaked one. Revoke a token from the same page; regenerating one revokes the old token immediately.

## What a token can read

A token is read-only and reads what you can read in the webapp:

- your own account;
- each organization you are a member of, **if an owner of that organization allows personal tokens** (organization settings → API tokens). It is off by default.

The **API tokens** page lists which of your accounts a token reaches. Memberships and organization policies are re-read at most 5 seconds apart, so leaving an organization, or an owner switching tokens off, takes effect within seconds without revoking the token.

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

  | Status | Code              | When                                                    |
  | ------ | ----------------- | ------------------------------------------------------- |
  | 400    | `badRequest`      | malformed request body                                  |
  | 401    | `unauthenticated` | missing, unknown or revoked token                       |
  | 403    | `forbidden`       | the account is outside what the token can read          |
  | 404    | `notFound`        | unknown resource or endpoint (after authentication)     |
  | 429    | `rateLimited`     | too many requests; retry after the `Retry-After` header |
  | 500    | `internal`        | unexpected server failure                               |

## Rate limits

- **Per token**: 60 requests at once, refilled at one per second. A poll every few seconds stays well below it.
- **Per IP address, failed authentication only**: after 10 requests with a missing, unknown or revoked token, the address waits about 6 seconds per further attempt, whatever token it sends. Successful requests do not count.

Past a limit the API answers `429 rateLimited` with a `Retry-After` header, in seconds. Wait that long before retrying.

## Pull request shape

Every endpoint returning pull requests returns this object. Everything but `myBuckets` is the same whoever asks, so a cache keyed on `_id` holds across users. A field reviewflow cannot know for an older pull request is `null`, never a guess.

| Field                                                                                         | Type                                                              | Notes                                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `_id`                                                                                         | string                                                            | reviewflow's id, stable for the pull request's lifetime                                                                                                                                                |
| `accountId`, `repoId`                                                                         | number                                                            | GitHub ids                                                                                                                                                                                             |
| `ownerRepo`                                                                                   | string                                                            | `owner/name`                                                                                                                                                                                           |
| `orgLogin`, `repoName`, `number`, `title`, `url`                                              |                                                                   |                                                                                                                                                                                                        |
| `headRef`, `baseRef`, `headSha`                                                               | string \| null                                                    | branches and head commit                                                                                                                                                                               |
| `headRepoFullName`                                                                            | string \| null                                                    | `owner/name` of the head branch: a fork for fork pull requests                                                                                                                                         |
| `state`                                                                                       | `open` \| `draft` \| `closed` \| `merged` \| null                 | `null` for a pull request closed before reviewflow recorded merges                                                                                                                                     |
| `isDraft`                                                                                     | boolean                                                           |                                                                                                                                                                                                        |
| `mergeable`                                                                                   | `mergeable` \| `conflicting` \| `unknown`                         | `unknown` while GitHub computes it after a push to the pull request or its base; reviewflow reads it again about 10 s later, retrying for up to 2 minutes                                              |
| `flowDates`                                                                                   | object of string \| null                                          | `createdAt`, `openedAt`, `readyAt`, `reviewStartedAt`, `approvedAt`, `closedAt`, `lastPushedAt`, `lastReviewSubmittedAt`                                                                               |
| `reviewState`                                                                                 | `none` \| `requested` \| `changesRequested` \| `approved` \| null | changes requested wins over a pending request                                                                                                                                                          |
| `reviewers`                                                                                   | array                                                             | `{ id, login, state, submittedAt, requestedAt }`, the author left out; `state` is `requested`, `reRequested` (asked again after reviewing), `approved`, `changesRequested`, `commented` or `dismissed` |
| `requestedTeams`                                                                              | string[]                                                          | team names asked for a review                                                                                                                                                                          |
| `approvedBy`, `changesRequestedBy`, `requestedReviewers`, `reRequestedReviewers`, `assignees` | `{ id, login }[]`                                                 |                                                                                                                                                                                                        |
| `creator`                                                                                     | `{ id, login }`                                                   | absent on old pull requests                                                                                                                                                                            |
| `unresolvedThreads`                                                                           | number \| null                                                    | number of unresolved review threads (outdated ones included); `null` until reviewflow has read them once                                                                                               |
| `checks`                                                                                      | object                                                            | `conclusion` (`passed`, `failed`, `in-progress`, `unknown`), `runningCount`, `failedNames`, and the counts `passed`, `failed`, `pending`                                                               |
| `lintFailed`, `statusLinks`, `changes`                                                        |                                                                   | reviewflow's title and commit lint, linked statuses, changed files and lines                                                                                                                           |
| `myBuckets`                                                                                   | string[]                                                          | where it sits on your board, in board order; empty when on none                                                                                                                                        |
| `updatedAt`                                                                                   | string                                                            | last time reviewflow wrote it                                                                                                                                                                          |

Dates are ISO 8601 strings in UTC.

## Endpoints

| Endpoint                                 | Returns                                                     | Status        |
| ---------------------------------------- | ----------------------------------------------------------- | ------------- |
| `GET /api/me/v1`                         | your user, the accounts the token reaches, the token's name | available     |
| `GET /api/board/v1?account=<login>`      | your pull requests board, grouped like the webapp           | not available |
| `GET /api/board-bucket/v1`               | one board bucket, paginated                                 | not available |
| `POST /api/prs-lookup/v1`                | pull requests by repository and branch, up to 200 at once   | available     |
| `GET /api/pr/v1/<owner>/<repo>/<number>` | one pull request                                            | available     |
| `GET /api/health/v1`                     | server health, unauthenticated                              | not available |
| `GET /api/stream/v1`                     | server-sent events: pull request changes as they happen     | not available |

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

- `accounts`: your own account first, then each organization the token reaches. An organization whose owners have not allowed personal tokens is left out.
- `teams`: your GitHub teams in that organization, as last synced by reviewflow.
- Dates are ISO 8601 in UTC.

Errors: `401` for a missing, unknown or revoked token, `429` past a rate limit.

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

| Status | Code              | When                                                                                                                                                                            |
| ------ | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 401    | `unauthenticated` | missing, unknown or revoked token                                                                                                                                               |
| 403    | `forbidden`       | `owner` is not an account the token reads: not yours, an organization whose owners have not allowed tokens, or unknown to reviewflow. The answer is the same in all three cases |
| 404    | `notFound`        | `owner` is readable but the repository or the pull request is unknown, or the number is not a positive integer                                                                  |
| 429    | `rateLimited`     | past a rate limit                                                                                                                                                               |

`403` depends on the owner only, never on whether the repository or pull request exists, so it cannot be used to probe private repositories.

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
