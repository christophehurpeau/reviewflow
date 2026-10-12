# Reviewflow read API

A read-only HTTP API on the reviewflow webapp server, for tools that follow your pull requests from outside the webapp (vigie, scripts).

> **Status:** early. `GET /api/me/v1` is available; the other endpoints ship one by one, and the table below says which ones are.

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
  | 401    | `unauthenticated` | missing, unknown or revoked token                       |
  | 403    | `forbidden`       | the account is outside what the token can read          |
  | 404    | `notFound`        | unknown resource or endpoint (after authentication)     |
  | 429    | `rateLimited`     | too many requests; retry after the `Retry-After` header |
  | 500    | `internal`        | unexpected server failure                               |

## Rate limits

- **Per token**: 60 requests at once, refilled at one per second. A poll every few seconds stays well below it.
- **Per IP address, failed authentication only**: after 10 requests with a missing, unknown or revoked token, the address waits about 6 seconds per further attempt, whatever token it sends. Successful requests do not count.

Past a limit the API answers `429 rateLimited` with a `Retry-After` header, in seconds. Wait that long before retrying.

## Endpoints

| Endpoint                                 | Returns                                                     | Status        |
| ---------------------------------------- | ----------------------------------------------------------- | ------------- |
| `GET /api/me/v1`                         | your user, the accounts the token reaches, the token's name | available     |
| `GET /api/board/v1?account=<login>`      | your pull requests board, grouped like the webapp           | not available |
| `GET /api/board-bucket/v1`               | one board bucket, paginated                                 | not available |
| `POST /api/prs-lookup/v1`                | pull requests by repository and branch, up to 200 at once   | not available |
| `GET /api/pr/v1/<owner>/<repo>/<number>` | one pull request                                            | not available |
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
