# Reviewflow read API

A read-only HTTP API on the reviewflow webapp server, for tools that follow your pull requests from outside the webapp (vigie, scripts).

> **Status:** personal tokens can be created, but no endpoint accepts them yet. The endpoints below ship one by one; this page says which ones are available.

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

The **API tokens** page lists which of your accounts a token reaches. Membership is checked on every request, so leaving an organization removes its pull requests from the API without revoking the token.

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
  | 404    | `notFound`        | unknown resource                                        |
  | 429    | `rateLimited`     | too many requests; retry after the `Retry-After` header |

## Endpoints

| Endpoint                                 | Returns                                                     | Status        |
| ---------------------------------------- | ----------------------------------------------------------- | ------------- |
| `GET /api/me/v1`                         | your user, the accounts the token reaches, the token's name | not available |
| `GET /api/board/v1?account=<login>`      | your pull requests board, grouped like the webapp           | not available |
| `GET /api/board-bucket/v1`               | one board bucket, paginated                                 | not available |
| `POST /api/prs-lookup/v1`                | pull requests by repository and branch, up to 200 at once   | not available |
| `GET /api/pr/v1/<owner>/<repo>/<number>` | one pull request                                            | not available |
| `GET /api/health/v1`                     | server health, unauthenticated                              | not available |
| `GET /api/stream/v1`                     | server-sent events: pull request changes as they happen     | not available |

Each endpoint gets its request and response documented here when it ships.
