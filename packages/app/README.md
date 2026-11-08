# @reviewflow/app

Review any GitHub pull request locally: conversation, checks, commits and the
git diff, read and written with your own `gh` login.

```sh
npx @reviewflow/app
```

Then open http://127.0.0.1:7450.

Requires macOS (the credentials key lives in the login keychain), node 24.14.1
or later, and the [GitHub CLI](https://cli.github.com) logged in (`gh auth login`).

| Variable                 | Default                       | Purpose                                         |
| ------------------------ | ----------------------------- | ----------------------------------------------- |
| `REVIEWFLOW_APP_PORT`    | `7450`                        | port of the loopback server                     |
| `REVIEWFLOW_APP_HOME`    | `~/.reviewflow-app`           | where `config.json` and `credentials.json` live |
| `REVIEWFLOW_APP_GH_PATH` | `gh` found in the usual paths | the GitHub CLI to use                           |

See the [expo app README](https://github.com/christophehurpeau/reviewflow/tree/main/packages/app-expo)
for local checkouts, connecting reviewflow and drafts.
