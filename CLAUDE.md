# CLAUDE.md

## What this monorepo is

Reviewflow is an open source GitHub bot that improves the pull request flow from
opening to merging: it rewrites the PR body with a status checklist, applies
labels, enforces commit/title conventions, tracks reviews and checks, automerges,
and notifies reviewers and authors over Slack (including DMs, whose settings live
under the `dm/` folders). A companion webapp lets a user configure their account
and follow their pull requests.

pnpm workspaces, TypeScript everywhere, ESM only. See [README.md](README.md) for
the architecture (two node processes on one mongo db, the internal api, the
reverse proxy) and for deployment.

## Packages

| Package                                          | Kind          | Role                                                                                                   |
| ------------------------------------------------ | ------------- | ------------------------------------------------------------------------------------------------------ |
| [packages/reviewflow](packages/reviewflow)       | node server   | The bot: GitHub webhook handlers, the Slack home worker, and the loopback-only internal api            |
| [packages/webapp-server](packages/webapp-server) | node server   | Serves the webapp, the GitHub/Slack oauth flows, and the resources websocket                           |
| [packages/webapp](packages/webapp)               | universal app | File-routed app to configure reviewflow (org, repositories, settings, user) and follow pull requests   |
| [packages/core](packages/core)                   | shared lib    | Mongo stores and models, per-account configs (labels, review groups, rules), shared by the two servers |
| [packages/modules](packages/modules)             | shared lib    | Types and resource/service contracts shared by the servers and the webapp                              |

`core` is node-only; `modules` builds for both node and browser, which is why
anything the webapp needs must live there and not in `core`.

## Technology

- **Runtime / packaging**: node, pnpm workspaces, ESM. Libraries and servers are
  bundled with rollup + esbuild via the `pob` toolchain; `pob` config lives in
  each `package.json`.
- **Bot**: probot on top of express for GitHub App webhooks, octokit (REST and
  GraphQL) for the GitHub api, commitlint for commit/title conventions, the Slack
  web api client for messages and app home, Sentry for error reporting.
- **Webapp server**: express, oauth via simple-oauth2, a signed `auth_gh` cookie
  (jsonwebtoken) shared with the websocket.
- **Data**: mongo through [liwi](https://github.com/christophehurpeau/liwi)
  (`liwi-mongo` stores, `liwi-resources-*` for the websocket resources layer).
  The webapp has no REST api: it reads and writes through liwi resources over the
  websocket, with `react-liwi` bindings.
- **Webapp UI**: Expo (Router, react-native-web) so the same code runs on web and
  native, styled with the `alouette` design system on nativewind/tailwind, icons
  from `alouette-icons` (Phosphor).
- **Tooling**: vitest (root-level, run per package with a path filter), eslint,
  oxfmt for formatting, renovate for dependency updates, conventional commits.

Prefer the `alouette-*` skills over reading its source when working in the webapp.

## Commands

```sh
pnpm test                         # vitest, whole repo
pnpm --filter reviewflow run test # vitest, one package
pnpm tsc                          # typecheck the whole build graph
pnpm lint                         # oxfmt + eslint
```

## Webapp UI (alouette)

Never nest raised surfaces. `Surface` (and `SettingsSection`, which wraps it) and
`PressableListItem` / `PressableBox variant="contained"` each carry their own
`shadow-s`, background and radius, so one inside the other reads as a double
elevation.

- A list of pressable rows goes on the screen background, wrapped in
  `ListSection` for its heading.
- `Surface` / `SettingsSection` is for static content only.

The webapp ships its own palette instead of alouette's default: GitHub-Primer
hues (green `brand` and `success`, Primer blue, red, amber, cool grays) declared
in [packages/webapp/build-theme.ts](packages/webapp/build-theme.ts). It generates
`src/palette.css`, `src/palette-oklch.css` and `src/themeVariables.ts` — all
three generated, committed and never edited by hand. Change a hue in the script
then `pnpm --filter webapp run build:theme`.
