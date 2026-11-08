# @reviewflow/app-expo

Expo (web) app that opens any GitHub pull request: conversation, checks,
commits and the git diff. It is the client of `@reviewflow/app`
(`packages/app`), a local node server on `127.0.0.1:7450` that reads and writes
GitHub with your `gh` login and serves this app's web export.

## Run it

macOS only (the credentials key lives in the login keychain), node 24.14.1 or
later, and `gh auth login` done once.

```sh
npx @reviewflow/app                                # http://127.0.0.1:7450
```

`@reviewflow/app` is the published `packages/app`, with this app's web export
copied into its `client/` at pack time.

### From the repository

From the repository root:

```sh
pnpm --filter @reviewflow/sdk run build
```

Option A, one origin (the server serves the exported expo app):

```sh
pnpm --filter @reviewflow/app-expo run build    # expo export -> packages/app-expo/dist
pnpm --filter @reviewflow/app run build
node packages/app/build/index-node.mjs             # http://127.0.0.1:7450
```

Option B, expo dev server (hot reload) next to the server:

```sh
pnpm --filter @reviewflow/app run build && REVIEWFLOW_APP_DEV=1 node packages/app/build/index-node.mjs
pnpm --filter @reviewflow/app-expo run start    # http://localhost:8085
```

Open the page, press Open a pull request and enter `https://github.com/owner/repo/pull/123`,
`owner/repo#123` or `owner/repo/123`. A pull request is also reachable at
`/pull-request?repo=owner/repo&number=123&tab=review&commit=<oid>`.

## Connect reviewflow: the pull request list

The home page lists your pull requests as reviewflow sorts them (the board).
That needs a reviewflow API token:

1. Open the app, open Settings in the header or press Connect reviewflow on the home page.
2. The reviewflow URL defaults to `https://reviewflow.chapplications.com`.
3. Paste the token and press Save. The server checks it against reviewflow first
   and shows the refusal as it is when it does not work; nothing is stored then.
4. The token is kept by the server only, in `$REVIEWFLOW_APP_HOME/credentials.json`
   (mode 0600, AES-256-GCM, the key in the macOS login keychain under
   `com.christophehurpeau.reviewflow-app.credentials-key`). No route returns it,
   and it is never written in clear.
5. Settings also shows the login, the accounts the token reads and the stream
   state; Forget deletes the token after a confirmation.

### Live list

While the app is open it holds one `GET /api/events` connection (server-sent
events). The server follows reviewflow's stream as long as a page is connected,
and for 5 minutes after the last one leaves; never otherwise.

- `board`: the list is replaced as it changes, no refresh needed.
- `reviewflowStatus`: the settings status follows.
- `pullRequestChanged`: the listed parts of that pull request (conversation,
  checks, commits, files) are re-read at once if its screen is open, and when
  next shown otherwise.

A part of a pull request read more than a minute ago is read again when shown
(a tab switch). The progress bar at the top of its screen, the only one for
every part, hides that re-read when reviewflow is trusted to have announced any
change: this page is `live`, the server's reviewflow stream is `live`, the pull
request is on the board, and no event, reload or edit marked that part stale.
Otherwise it shows it.

The header badge says `live`, `connecting` or `reconnecting` for this page's
connection; the browser reconnects by itself. The refresh button beside the list's title
reads the board from reviewflow again (`?refresh=1`). The web build only: a
native runtime without `EventSource` shows `no live updates`.

## Drafts

What is being written on a pull request survives a reload: the new comment,
replies, an edit of a comment or description, the inline comment on the diff,
the review summary, and the pending comments of a review with the commit range
they were written on. They are kept in the browser's `localStorage`
(`reviewflow:draft:*`), per pull request, and dropped once sent or cancelled, or
7 days after their last change. The web build only: on native they live as long
as the screen.

## Config file: checkouts for the diff

The diff is read from a local git checkout (the commits are fetched into it by
sha, no ref is written). A repository with no checkout opens without its files
changed, with a banner on every tab saying the repository is not attached.
Edit it in Settings → Checkouts (the banner's "Add it in Settings" opens it with
the entry already added, unsaved), or by hand. `~/.reviewflow-app/config.json`:

```json
{
  "repoPaths": ["~/dev/", "~/work/"],
  "repos": { "acme/widgets": "/Users/me/code/widgets" }
}
```

A path is absolute or starts with `~/` (the home folder). It counts only if it exists and its `remote.origin.url` names that
repository. A repository missing from `repos` is searched in `repoPaths`, folder by folder
(`["~/dev/"]` when unset; the former `"defaultRepoPath": "~/dev/"` still reads
as a one-folder list and is rewritten as `repoPaths` on the next save from
Settings): `<path>/<repo>`, then `<path>/<owner>/<repo>`, then
`<path>/<any directory>/<repo>`, the first whose origin names it. Settings →
Checkouts → "Repositories folders" adds and removes folders; "Autodiscover"
offers the usual folders of the home directory (`~/dev`, `~/code`, `~/src`,
`~/projects`… and their subfolders, never `~/Documents`, `~/Desktop` or
`~/Downloads`) that hold checkouts. A save is refused when the text is not that
shape or the file changed on disk since the editor opened it (reload, or keep
editing); a missing path, a checkout of another repository or a folder that is
not a directory is saved with a warning.

The Repositories screen lists the checkouts directly under `repoPaths`. The
scan is cached in `~/.reviewflow-app/cache/repositories.json`, read again until
`repoPaths` changes or the screen's refresh button scans anew: a checkout
cloned since the last scan shows only after a refresh.

## Environment

| Variable                            | Read by | Default                 | Meaning                                               |
| ----------------------------------- | ------- | ----------------------- | ----------------------------------------------------- |
| `REVIEWFLOW_APP_PORT`               | server  | `7450`                  | port, bound on 127.0.0.1 only                         |
| `REVIEWFLOW_APP_HOME`               | server  | `~/.reviewflow-app`     | folder of `config.json`, `credentials.json`, `cache/` |
| `REVIEWFLOW_APP_DEV`                | server  | unset                   | `1` trusts the expo dev server origin (`:8085`)       |
| `EXPO_PUBLIC_REVIEWFLOW_APP_SERVER` | app     | `http://127.0.0.1:7450` | server url in dev (`expo start`) and native builds    |

The exported app uses its own origin; a dev build uses the variable above. The
server refuses requests whose `Host` is not loopback or whose `Origin` is not
itself or, with `REVIEWFLOW_APP_DEV=1`, the app's expo dev server, pinned to
`localhost:8085` because the reviewflow webapp's dev server already holds
expo's default 8081. An api request a foreign page sends without `Origin`
(`<img src>`) is refused from its `Sec-Fetch-Site`.
