import type {
  DiffGroup,
  DiffOmittedFile,
  DiffReadingOrderResponse,
} from "@reviewflow/sdk";
import type { Meta, StoryObj } from "@storybook/react-native";
import { ScreenScrollView, View } from "alouette";
import { Story } from "../stories/Story.tsx";
import * as fixtures from "../stories/fixtures.ts";
import { PullRequestDiffOverview } from "./pull-request-diff-overview.tsx";
import type { DiffTreeFileStatus } from "./pull-request-diff-tree-files.ts";

const noop = (): void => {};

const meta = {
  component: PullRequestDiffOverview,
  parameters: {
    componentSubtitle:
      "What a range of the diff touches, by workspace: file counts and the roots to start reading from; aside the diff, every file as a tree row",
  },
  args: {
    groups: fixtures.readingOrderDiff.groups,
    omitted: [],
    readingOrder: fixtures.readingOrder,
    readingOrderStatus: "ready",
    displayOrder: null,
    onFilePress: noop,
    aside: false,
  },
  render: (args) => (
    <ScreenScrollView className="bg-screen" contentContainerClassName="p-l">
      <PullRequestDiffOverview {...args} />
    </ScreenScrollView>
  ),
} satisfies Meta<typeof PullRequestDiffOverview>;

export default meta;

export const PreviewStory: StoryObj<typeof PullRequestDiffOverview> = {
  name: "PullRequestDiffOverview Preview",
};

const manyGroups: DiffGroup[] = [
  {
    name: "packages/core",
    paths: Array.from(
      { length: 30 },
      (_, index) => `packages/core/src/model-${String(index)}.ts`,
    ),
  },
  {
    name: "packages/ui",
    paths: Array.from(
      { length: 25 },
      (_, index) => `packages/ui/src/screen-${String(index)}.tsx`,
    ),
  },
];

const manyReadingOrder: DiffReadingOrderResponse = {
  groups: manyGroups.map(({ name, paths }) => ({
    name,
    files: paths.map((path) => ({
      path,
      entry: false,
      root: true,
      attached: [],
    })),
  })),
};

const omitted: DiffOmittedFile[] = [
  { path: "packages/sdk/src/cart/fixture.json", reason: "tooLarge" },
  { path: "packages/app/assets/logo.png", reason: "binary" },
];

const statuses = new Map<string, DiffTreeFileStatus>([
  ["packages/app/src/cart-screen.tsx", "modified"],
  ["packages/sdk/src/cart/totals.ts", "modified"],
  ["packages/sdk/src/cart/cache.ts", "added"],
  ["packages/sdk/src/cart/totals.test.ts", "added"],
]);

const kindsGroups: DiffGroup[] = [
  {
    name: "packages/web",
    paths: [
      "packages/web/src/app.tsx",
      "packages/web/src/legacy.js",
      "packages/web/src/theme.css",
      "packages/web/package.json",
      "packages/web/README.md",
      "packages/web/public/index.html",
      "packages/web/public/icon.svg",
    ],
  },
  {
    name: "",
    paths: [".github/workflows/ci.yml", "pnpm-lock.yaml", "scripts/release.sh"],
  },
];

const kindsStatuses = new Map<string, DiffTreeFileStatus>([
  ["packages/web/src/app.tsx", "modified"],
  ["packages/web/src/legacy.js", "deleted"],
  ["packages/web/src/theme.css", "renamed"],
  ["packages/web/package.json", "modified"],
  ["packages/web/README.md", "added"],
  ["packages/web/public/index.html", "modified"],
  ["packages/web/public/icon.svg", "added"],
  [".github/workflows/ci.yml", "modified"],
  ["pnpm-lock.yaml", "modified"],
  ["scripts/release.sh", "added"],
]);

const noRootGroups: DiffGroup[] = [
  {
    name: "packages/sdk",
    paths: ["packages/sdk/src/cart/totals.test.ts", "packages/sdk/README.md"],
  },
];

export const VariantsStory: StoryObj<typeof PullRequestDiffOverview> = {
  name: "PullRequestDiffOverview Variants",
  render: () => (
    <Story>
      <Story.Section title="with entry points">
        <PullRequestDiffOverview
          groups={fixtures.readingOrderDiff.groups}
          omitted={[]}
          readingOrder={fixtures.readingOrder}
          readingOrderStatus="ready"
          displayOrder={null}
          aside={false}
          onFilePress={noop}
        />
      </Story.Section>
      <Story.Section title="files in reading order, as the diff shows them">
        <PullRequestDiffOverview
          groups={fixtures.readingOrderDiff.groups}
          omitted={[]}
          readingOrder={fixtures.readingOrder}
          readingOrderStatus="ready"
          displayOrder={fixtures.readingOrder}
          aside={false}
          onFilePress={noop}
        />
      </Story.Section>
      <Story.Section title="aside the diff, on a wide screen: every file, tests below their subject">
        <View className="w-[280px]">
          <PullRequestDiffOverview
            aside
            groups={fixtures.readingOrderDiff.groups}
            omitted={[]}
            readingOrder={fixtures.readingOrder}
            readingOrderStatus="ready"
            displayOrder={fixtures.readingOrder}
            onFilePress={noop}
          />
        </View>
      </Story.Section>
      <Story.Section title="aside: git statuses, a file viewed, the file the diff is scrolled to">
        <View className="w-[280px]">
          <PullRequestDiffOverview
            aside
            groups={fixtures.readingOrderDiff.groups}
            omitted={[]}
            readingOrder={fixtures.readingOrder}
            readingOrderStatus="ready"
            displayOrder={fixtures.readingOrder}
            statuses={statuses}
            viewedPaths={["packages/sdk/src/cart/cache.ts"]}
            currentPath="packages/sdk/src/cart/totals.ts"
            onFilePress={noop}
          />
        </View>
      </Story.Section>
      <Story.Section title="aside: omitted files left out, nothing to go to">
        <View className="w-[280px]">
          <PullRequestDiffOverview
            aside
            groups={fixtures.readingOrderDiff.groups}
            omitted={omitted}
            readingOrder={fixtures.readingOrder}
            readingOrderStatus="ready"
            displayOrder={fixtures.readingOrder}
            statuses={statuses}
            onFilePress={noop}
          />
        </View>
      </Story.Section>
      <Story.Section title="aside: an icon per file type, every status, the root workspace">
        <View className="w-[280px]">
          <PullRequestDiffOverview
            aside
            groups={kindsGroups}
            omitted={[]}
            readingOrder={null}
            readingOrderStatus="none"
            displayOrder={null}
            statuses={kindsStatuses}
            onFilePress={noop}
          />
        </View>
      </Story.Section>
      <Story.Section title="git statuses on the names">
        <PullRequestDiffOverview
          groups={kindsGroups}
          omitted={[]}
          readingOrder={null}
          readingOrderStatus="none"
          displayOrder={null}
          statuses={kindsStatuses}
          aside={false}
          onFilePress={noop}
        />
      </Story.Section>
      <Story.Section title="without checkout: file names, by first directory">
        <PullRequestDiffOverview
          groups={[
            {
              name: "packages",
              paths: fixtures.readingOrderDiff.groups.flatMap(
                ({ paths }) => paths,
              ),
            },
          ]}
          omitted={[]}
          readingOrder={null}
          readingOrderStatus="none"
          displayOrder={null}
          aside={false}
          onFilePress={noop}
        />
      </Story.Section>
      <Story.Section title="reading the entry points">
        <PullRequestDiffOverview
          groups={fixtures.readingOrderDiff.groups}
          omitted={[]}
          readingOrder={null}
          readingOrderStatus="reading"
          displayOrder={null}
          aside={false}
          onFilePress={noop}
        />
      </Story.Section>
      <Story.Section title="entry points failed">
        <PullRequestDiffOverview
          groups={fixtures.readingOrderDiff.groups}
          omitted={[]}
          readingOrder={null}
          readingOrderStatus="failed"
          displayOrder={null}
          aside={false}
          onFilePress={noop}
        />
      </Story.Section>
      <Story.Section title="omitted files counted in their workspace">
        <PullRequestDiffOverview
          groups={fixtures.readingOrderDiff.groups}
          omitted={omitted}
          readingOrder={fixtures.readingOrder}
          readingOrderStatus="ready"
          displayOrder={null}
          aside={false}
          onFilePress={noop}
        />
      </Story.Section>
      <Story.Section title="a commit: one file">
        <PullRequestDiffOverview
          groups={[
            {
              name: "packages/sdk",
              paths: ["packages/sdk/src/cart/cache.ts"],
            },
          ]}
          omitted={[]}
          readingOrder={fixtures.readingOrder}
          readingOrderStatus="ready"
          displayOrder={null}
          aside={false}
          onFilePress={noop}
        />
      </Story.Section>
      <Story.Section title="only tests and non-TypeScript files">
        <PullRequestDiffOverview
          groups={noRootGroups}
          omitted={[]}
          readingOrder={null}
          readingOrderStatus="none"
          displayOrder={null}
          aside={false}
          onFilePress={noop}
        />
      </Story.Section>
      <Story.Section title="over 50 names: counts only">
        <PullRequestDiffOverview
          groups={manyGroups}
          omitted={[]}
          readingOrder={manyReadingOrder}
          readingOrderStatus="ready"
          displayOrder={null}
          aside={false}
          onFilePress={noop}
        />
      </Story.Section>
      <Story.Section title="impacts: touched exports and what is not analyzed">
        <PullRequestDiffOverview
          groups={fixtures.readingOrderDiff.groups}
          omitted={[]}
          readingOrder={fixtures.readingOrder}
          readingOrderStatus="ready"
          displayOrder={null}
          aside={false}
          impacts={fixtures.impacts}
          impactsStatus="ready"
          onFilePress={noop}
        />
      </Story.Section>
      <Story.Section title="impacts: no touched export used outside the diff">
        <PullRequestDiffOverview
          groups={fixtures.readingOrderDiff.groups}
          omitted={[]}
          readingOrder={fixtures.readingOrder}
          readingOrderStatus="ready"
          displayOrder={null}
          aside={false}
          impacts={{
            tooLarge: false,
            files: [],
            notAnalyzed: [],
            unresolvedIn: [],
          }}
          impactsStatus="ready"
          onFilePress={noop}
        />
      </Story.Section>
      <Story.Section title="impacts: repository too large">
        <PullRequestDiffOverview
          groups={fixtures.readingOrderDiff.groups}
          omitted={[]}
          readingOrder={fixtures.readingOrder}
          readingOrderStatus="ready"
          displayOrder={null}
          aside={false}
          impacts={{ tooLarge: true, reason: "files" }}
          impactsStatus="ready"
          onFilePress={noop}
        />
      </Story.Section>
      <Story.Section title="impacts: reading">
        <PullRequestDiffOverview
          groups={fixtures.readingOrderDiff.groups}
          omitted={[]}
          readingOrder={fixtures.readingOrder}
          readingOrderStatus="ready"
          displayOrder={null}
          aside={false}
          impacts={null}
          impactsStatus="reading"
          onFilePress={noop}
        />
      </Story.Section>
      <Story.Section title="impacts: failed">
        <PullRequestDiffOverview
          groups={fixtures.readingOrderDiff.groups}
          omitted={[]}
          readingOrder={fixtures.readingOrder}
          readingOrderStatus="ready"
          displayOrder={null}
          aside={false}
          impacts={null}
          impactsStatus="failed"
          onFilePress={noop}
        />
      </Story.Section>
    </Story>
  ),
};
