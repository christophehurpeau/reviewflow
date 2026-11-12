# @reviewflow/ui

React Native pull request screens from the
[reviewflow](https://github.com/christophehurpeau/reviewflow) local app:
conversation, checks, commits, files and diff, review and edits, plus the pull
request board. Built on [alouette](https://github.com/christophehurpeau/alouette)
(nativewind / tailwind), web first.

## Install

```sh
npm install @reviewflow/ui @reviewflow/sdk
```

Peer dependencies your app provides: `alouette` `^25.0.0` (and what it
requires: `alouette-icons`, `nativewind`, `tailwindcss`, `react-native-svg`),
`react` `^19.2.3` and `react-native`. On web, `react-dom` too.

## Shipped as sources

There is no build: every export resolves to a `.ts` / `.tsx` file under `src/`,
transformed by your bundler like your own files.

| Import                            | What                                                                                         |
| --------------------------------- | -------------------------------------------------------------------------------------------- |
| `@reviewflow/ui`                  | `PullRequestScreen`, its panels, the board, editors, data source and slot providers          |
| `@reviewflow/ui/diff-worker-pool` | `DiffWorkerPool`: shiki highlighting in web workers (`browser` condition), a no-op elsewhere |

- **Metro** (Expo): nothing to configure beyond alouette's own
  `withAlouetteConfig`; metro transforms TypeScript in `node_modules` and bundles
  the diff worker from its `new Worker(new URL(...))` call.
- **Tailwind**: classes are only emitted for files tailwind scans. Add this
  package's sources to your css entry, next to alouette's:

  ```css
  @import "alouette/core.css";
  @source "../node_modules/@reviewflow/ui/src/**/*.{ts,tsx}";
  ```

  The path is relative to the css file; adjust it to where `node_modules` is.

- **TypeScript**: the sources import with a `.ts` extension, so set
  `"allowImportingTsExtensions": true`. Your app's own ambient types must
  cover what the sources rely on: `react-native-css/types` (`className` on
  React Native components, which the nativewind setup already adds) and a
  `declare module "*.css";`.
- `sideEffects` lists `*.css`: the editors import their stylesheet, and a
  tree-shaking bundler must keep it.

## Wiring

The screens read nothing on their own: you provide a data source.

```tsx
import { AlouetteProvider } from "alouette";
import type { PullRequestDataSource } from "@reviewflow/ui";
import {
  PullRequestDataSourceProvider,
  PullRequestScreen,
} from "@reviewflow/ui";

const dataSource: PullRequestDataSource = {
  usePart, // detail, checks, timeline, commits, files: a read state per part
  useCandidates,
  useRevisions,
  useDiff,
  useDiffs,
  readFileAtSha,
  edit,
  reload,
  // optional: useSummary, useRepositoryAttachment, useReviewflowPr, useReadingOrder, useImpacts
};

<AlouetteProvider themeVariables={themeVariables}>
  <PullRequestDataSourceProvider value={dataSource}>
    <PullRequestScreen
      ownerRepo="octocat/hello-world"
      number={1}
      tab={tab}
      onTabChange={setTab}
    />
  </PullRequestDataSourceProvider>
</AlouetteProvider>;
```

Every hook answers with a `PullRequestReadState` (`value`, `cached`,
`reading`, `error`); the payload types come from `@reviewflow/sdk`, so a
source is usually `fetchPullRequestPart` and `readPullRequestDiff` from the sdk
behind your own cache and server. The board takes a `BoardDataSource`
(`useBoard`, `useReviewflowStatus`, `useClosedPullRequests`, `startReview`, `useStartedReviews`, `refresh`) through
`BoardDataSourceProvider`. `PullRequestSlotsProvider` (or the `slots` prop)
replaces the markdown editor or adds an action to the "no checkout" notice.

## A pull request in a side column

`PullRequestSideCard` is the screen's status, merge, checks and reviewers in
one fluid column, for a panel beside something else. It takes its data as
props and needs no provider of this package; it draws no surface and does not
scroll. `onEdit` writes one edit and reads the pull request again before
resolving:

```tsx
import { pullRequestPartsStaleAfter } from "@reviewflow/sdk";
import { PullRequestSideCard } from "@reviewflow/ui";

const detail = usePart(ref, "detail").value;
const checks = usePart(ref, "checks");
const summary = useSummary(ref); // optional: reviewflow's review status
const candidates = useCandidates(ref).value; // optional: offers asking reviewers

detail === null ? null : (
  <PullRequestSideCard
    detail={detail}
    checks={checks}
    summary={summary}
    candidates={candidates}
    onEdit={async (change) => {
      await edit(ref, change);
      await reload(
        ref,
        pullRequestPartsStaleAfter(change, detail.pullRequest.id),
      );
    }}
  />
);
```

## A diff in a side column

`ChangedFilesTree` lists the files of one diff, each with its status and line
counts, for a host that shows the pressed file's diff somewhere else:
`DiffViewer` (`@reviewflow/ui/diff-viewer`, loaded lazily) takes that file's
`path` and renders it alone, from the patch it has already parsed. The tree
fills its parent, which must give it a bounded height; on the web it is the
pull request's file tree, elsewhere a plain list. One tree per diff:
`readCheckoutBranchDiff` answers one scope at a time.

```tsx
import { changedFilesOf, ChangedFilesTree } from "@reviewflow/ui";

const DiffViewer = lazy(() => import("@reviewflow/ui/diff-viewer"));

<ChangedFilesTree
  files={changedFilesOf(diff)} // a CheckoutBranchDiffResponse
  selectedPath={selected}
  onSelect={setSelected}
/>;

// elsewhere on the screen: without `path`, every file of the patch
selected === null ? null : (
  <Suspense fallback={null}>
    <DiffViewer
      patch={diff.patch}
      groups={diff.groups}
      path={selected}
      // diffStyle, theme, themeType, fontFamily, wordWrap, stickyTop, collapse
    />
  </Suspense>
);
```

## License

ISC
