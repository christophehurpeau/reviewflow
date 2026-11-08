# @reviewflow/sdk

The pull request model behind the [reviewflow](https://github.com/christophehurpeau/reviewflow)
local app: diff and api types, pure utils, the GitHub layer behind a transport you
supply, the reviewflow api client, and (node only) reading a pull request diff
from a local git checkout.

## Install

```sh
npm install @reviewflow/sdk
```

ESM only. The node entries need node `>=24.14.1`; the root entry also has a
browser build.

## Entry points

| Import                  | Runs on       | What                                                                              |
| ----------------------- | ------------- | --------------------------------------------------------------------------------- |
| `@reviewflow/sdk`       | node, browser | types, utils, GitHub queries and edits, reviewflow api client and stream          |
| `@reviewflow/sdk/git`   | node          | read a diff, reading order and impacts from a local checkout (runs `git`)         |
| `@reviewflow/sdk/files` | node          | read and save a text file in place, behind validation and a changed-on-disk check |

`@reviewflow/sdk/git` needs a `git` executable on `PATH`.

## Wiring

The sdk never authenticates nor picks an HTTP client: you inject them.

```ts
import {
  createGitHubTransport,
  createReviewflowClient,
  fetchPullRequestPart,
} from "@reviewflow/sdk";

// GitHub: you send the bytes, the sdk builds the GraphQL, REST and diff calls.
const transport = createGitHubTransport(
  async ({ method, path, accept, body }) => {
    const response = await fetch(`https://api.github.com/${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, accept },
      body,
    });
    return { status: response.status, body: await response.text() };
  },
);

const detail = await fetchPullRequestPart(
  transport,
  { ownerRepo: "octocat/hello-world", number: 1 },
  "detail",
);

// reviewflow's read api, with a user's api token (`fetch` is injectable too).
const reviewflow = createReviewflowClient({
  url: "https://reviewflow.example",
  token: apiToken,
});
```

On node, `@reviewflow/sdk/git` reads the same pull request from a checkout and
falls back to GitHub through the same transport:

```ts
import { readPullRequestDiff } from "@reviewflow/sdk/git";

const diff = await readPullRequestDiff({
  checkout: "/path/to/clone", // or null to read from GitHub only
  transport,
  ref: { ownerRepo: "octocat/hello-world", number: 1 },
  head: headSha,
  base: baseSha,
});
```

## TypeScript

The `types` condition points at the TypeScript sources (`src/`), which import
each other with a `.ts` extension. Your `tsconfig.json` needs
`"allowImportingTsExtensions": true` (with `noEmit` or `emitDeclarationOnly`),
or the checker reports TS5097 inside this package.

## License

ISC
