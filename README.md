<h1 align="center">
  reviewflow
</h1>

<h3>📦 Packages</h3>

This repository is a monorepo using workspaces.

| Package                                             | Version                                                                                                                                | Description                                                                                                                                                                                                                                                                           |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [@reviewflow/app](packages/app)                     | <a href="https://npmjs.org/package/@reviewflow/app"><img src="https://img.shields.io/npm/v/@reviewflow/app.svg?style=flat-square"></a> | reviewflow app: review any GitHub pull request locally (npx @reviewflow/app), a loopback server on 127.0.0.1:7450 over your gh login serving the expo app                                                                                                                             |
| [@reviewflow/app-expo](packages/app-expo)           |                                                                                                                                        | Expo Router app that opens any GitHub pull request on its local server (@reviewflow/app): conversation, checks, commits and the git diff.                                                                                                                                             |
| [@reviewflow/core](packages/core)                   |                                                                                                                                        | mongo stores, models and account configs shared by the reviewflow servers                                                                                                                                                                                                             |
| [@reviewflow/modules](packages/modules)             |                                                                                                                                        | shared types and service contracts between the reviewflow server and the webapp                                                                                                                                                                                                       |
| [@reviewflow/reviewflow](packages/reviewflow)       |                                                                                                                                        | 🚦 Open Source GitHub bot that improves PR flow from opening to merging.                                                                                                                                                                                                              |
| [@reviewflow/sdk](packages/sdk)                     | <a href="https://npmjs.org/package/@reviewflow/sdk"><img src="https://img.shields.io/npm/v/@reviewflow/sdk.svg?style=flat-square"></a> | pull request model shared by the reviewflow app server and its ui: diff and api types, pure utils, the GitHub layer behind an injected transport, and (node only) reading a diff from a local checkout (@reviewflow/sdk/git) and editing a text file in place (@reviewflow/sdk/files) |
| [@reviewflow/ui](packages/ui)                       | <a href="https://npmjs.org/package/@reviewflow/ui"><img src="https://img.shields.io/npm/v/@reviewflow/ui.svg?style=flat-square"></a>   | react-native pull request screen components. Consumed as SOURCES (no build): exports resolve `default` to ./src/index.ts, which metro transforms like the app&#39;s own files; the consuming app&#39;s css must @source this package&#39;s src so tailwind keeps its classes.         |
| [@reviewflow/webapp](packages/webapp)               |                                                                                                                                        | Expo Router app to configure reviewflow and follow your pull requests.                                                                                                                                                                                                                |
| [@reviewflow/webapp-server](packages/webapp-server) |                                                                                                                                        | serves the reviewflow webapp, its oauth flows and its resources websocket                                                                                                                                                                                                             |

<p align="center">
  Open source GitHub bot that improves the pull request flow from opening to merging.
  <br>
  <a href="https://reviewflow.chapplications.com/"><strong>reviewflow.chapplications.com</strong></a>
</p>

<h3>Use reviewflow</h3>

reviewflow runs at
[reviewflow.chapplications.com](https://reviewflow.chapplications.com/): sign
in with GitHub to configure your organizations, repositories and Slack
notifications, and follow your pull requests.

<h3>Review pull requests locally: the app</h3>

[@reviewflow/app](packages/app) is where you review a GitHub pull request
yourself, on your machine: read the conversation, checks, commits and the diff,
then comment and submit your review with your own `gh` login.

It is built to be fast: opening a pull request or switching between its tabs
never reloads the page, and the diff is read from your local git checkout
instead of being rendered by github.com.

```sh
npx @reviewflow/app   # http://127.0.0.1:7450
```

It needs macOS, node 24.14.1 or later and the
[GitHub CLI](https://cli.github.com) logged in (`gh auth login`).

Connected to reviewflow, it follows your pull requests in real time: the home
page lists them as reviewflow sorts them and changes as they do, and an open
pull request refreshes its conversation, checks, commits and files as soon as
reviewflow sees them change, without reloading. That needs a **reviewflow API
token**, available on request only: contact [contact@chapplications.com](mailto:contact@chapplications.com)
to have your account enabled, then create the token in the webapp under
**Settings → API tokens** and paste it in the app's settings. See
[connecting reviewflow](packages/app-expo/README.md#connect-reviewflow-the-pull-request-list).

<h3>🏗 Architecture</h3>

Two node processes share the same mongo database, so that webapp traffic cannot
slow down or take down webhook handling:

| Process                                              | Serves                                                                                                                   | Port                                         |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| [reviewflow](packages/reviewflow/src/index.ts)       | `/api/github/webhooks` (probot), the slack home worker, the smee client, and `/api/internal` on a loopback only listener | `PORT`, `3001` (`INTERNAL_API_PORT`, `3002`) |
| [webapp-server](packages/webapp-server/src/index.ts) | the oauth flows under `/app`, the resources websocket on `/ws`, the read api on `/api`, the webapp                       | `PORT`, `3000`                               |

The webapp never calls a REST api: it reads and writes through the
[liwi](https://github.com/christophehurpeau/liwi) resources websocket on `/ws`,
which is authenticated with the same `auth_gh` cookie the oauth flow sets.

Only the webhook server holds the github app credentials, so the webapp server
delegates anything needing them — syncing an org or a user, refreshing slack
after an install — to `/api/internal` on the webhook server, authenticated with
the shared `INTERNAL_API_SECRET`. That api listens on `INTERNAL_API_PORT`, bound
to `INTERNAL_API_HOST` (`127.0.0.1`), not on the public webhook port: it must
never be exposed publicly.

A reverse proxy in front of both must send `/api/github/webhooks` to the webhook
server and everything else to the webapp server. Both servers answer
`GET /api/health` on their public port: `200` with `{"status":"ok"}`, or `503`
when mongo does not answer, for load balancer and container probes (through the
proxy it reaches the webapp server). Set `TRUST_PROXY` on the webapp
server to that proxy (`loopback` when it runs on the same host), so the read api
records callers' ips rather than the proxy's. The read api, for tools outside the
webapp, is authenticated by personal tokens: see [docs/api.md](docs/api.md). See
[docs/deployment.md](docs/deployment.md).

liwi subscriptions are in-process, so the webhook server relays the keys it
writes to `prs`, `orgs`, `orgMembers`, `repositories` and `users` to the webapp
server, over a websocket on its internal api listener
(`/api/internal/store-relay`, same `INTERNAL_API_SECRET`). The webapp server
re-reads those documents for its subscriptions, and refetches every open
subscription each time the relay connects: writes made while it is down are not
replayed. One instance of each server: several would need a broker.
`STORE_RELAY_DISABLED=true` on both servers switches it off.

<h3>💻 Development</h3>

In two terminals:

```sh
pnpm dev                          # core watch, webhook server :3001, webapp server :3000
pnpm --filter @reviewflow/webapp run start    # http://localhost:8081
```

Copy `packages/reviewflow/.env.example`, `packages/webapp-server/.env.example`
and `packages/webapp/.env.example` to `.env` first. `MONGO_*`, `REVIEWFLOW_NAME`
and `INTERNAL_API_SECRET` must match between the two servers.

Both servers report errors to Sentry when `SENTRY_DSN` is set (nothing is sent
otherwise); `SENTRY_ENVIRONMENT` optionally tags the environment. One Sentry
project fits both. The webapp server sets Sentry up in `initErrorReporting`
(`@reviewflow/core`): logs go through nightingale to the console, and logged
errors are forwarded to Sentry. The webhook server leaves Sentry to probot,
which reports what goes through its logger (`context.log`, `probot.log`); its
own nightingale logs only reach the console.

In development the webapp is served by the expo dev server on another port, so
`REVIEWFLOW_APP_URL` must point at it; in production the webapp server serves
both and no `EXPO_PUBLIC_*` url is needed.
