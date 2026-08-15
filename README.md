<h1 align="center">
  
</h1>

<h3>📦 Packages</h3>

This repository is a monorepo using workspaces.

| Package                                 | Version | Description                                                              |
| --------------------------------------- | ------- | ------------------------------------------------------------------------ |
| [reviewflow](packages/reviewflow)       |         | 🚦 Open Source GitHub bot that improves PR flow from opening to merging. |
| [webapp-server](packages/webapp-server) |         | Serves the webapp, its oauth flows and its resources websocket.          |
| [webapp](packages/webapp)               |         | Expo Router app to configure reviewflow and follow your pull requests.   |
| [core](packages/core)                   |         | Mongo stores and models, account configs, shared by the two servers.     |
| [modules](packages/modules)             |         | Types and service contracts shared by the servers and the webapp.        |

<h3>🏗 Architecture</h3>

Two node processes share the same mongo database, so that webapp traffic cannot
slow down or take down webhook handling:

| Process                                              | Serves                                                                                                                   | Port                                         |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| [reviewflow](packages/reviewflow/src/index.ts)       | `/api/github/webhooks` (probot), the slack home worker, the smee client, and `/api/internal` on a loopback only listener | `PORT`, `3001` (`INTERNAL_API_PORT`, `3002`) |
| [webapp-server](packages/webapp-server/src/index.ts) | the oauth flows under `/app`, the resources websocket on `/ws`, the webapp                                               | `PORT`, `3000`                               |

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
server and everything else to the webapp server. See
[docs/deployment.md](docs/deployment.md).

Because liwi subscriptions are in-process, a document written by the webhook
server does not notify a webapp subscription, and vice versa: screens only
update on their own writes and on refetch. See
[plans/webapp-server-change-propagation.md](plans/webapp-server-change-propagation.md).

<h3>💻 Development</h3>

In two terminals:

```sh
pnpm dev                          # core watch, webhook server :3001, webapp server :3000
pnpm --filter webapp run start    # http://localhost:8081
```

Copy `packages/reviewflow/.env.example`, `packages/webapp-server/.env.example`
and `packages/webapp/.env.example` to `.env` first. `MONGO_*`, `REVIEWFLOW_NAME`
and `INTERNAL_API_SECRET` must match between the two servers.

In development the webapp is served by the expo dev server on another port, so
`REVIEWFLOW_APP_URL` must point at it; in production the webapp server serves
both and no `EXPO_PUBLIC_*` url is needed.
