import type { Meta, StoryObj } from "@storybook/react-native";
import { View } from "alouette";
import type { ReactNode } from "react";
import { fn } from "storybook/test";
import { Story } from "../stories/Story.tsx";
import { ChangedFilesTree } from "./changed-files-tree.tsx";
import type { DiffTreeFile } from "./pull-request-diff-tree-files.ts";

/** the narrowest side panel the tree is laid out for; it needs a height to virtualize */
function NarrowFrame({ children }: { children: ReactNode }): ReactNode {
  return <View className="h-[360px] w-[320px]">{children}</View>;
}

/** the widest side panel the tree is laid out for */
function WideFrame({ children }: { children: ReactNode }): ReactNode {
  return <View className="h-[360px] w-full max-w-[1000px]">{children}</View>;
}

const files: DiffTreeFile[] = [
  {
    path: "packages/sdk/src/diff/types.ts",
    status: "modified",
    additions: 32,
    deletions: 0,
  },
  {
    path: "packages/sdk/src/git/readBranchDiff.ts",
    status: "modified",
    additions: 186,
    deletions: 24,
  },
  {
    path: "packages/ui/src/components/changed-files-tree.tsx",
    status: "added",
    additions: 190,
    deletions: 0,
  },
  {
    path: "packages/ui/src/components/legacy-list.tsx",
    status: "deleted",
    additions: 0,
    deletions: 88,
  },
  {
    path: "packages/ui/src/components/moved-here.tsx",
    status: "renamed",
    additions: 0,
    deletions: 0,
  },
  {
    path: "assets/logo.png",
    status: "added",
    omitted: "binary",
    additions: null,
    deletions: null,
  },
  {
    path: "pnpm-lock.yaml",
    status: "modified",
    omitted: "tooLarge",
    additions: 4210,
    deletions: 3977,
  },
  { path: "README.md", status: "modified", additions: 3, deletions: 1 },
];

/** what a diff without git stats gives: statuses from the patch, no counts */
const filesWithoutCounts: DiffTreeFile[] = [
  { path: "packages/sdk/src/diff/types.ts", status: "modified" },
  { path: "packages/ui/src/components/new-file.tsx", status: "added" },
  { path: "assets/logo.png", status: null },
];

const manyFiles: DiffTreeFile[] = Array.from({ length: 400 }, (_, index) => ({
  path: `packages/package-${String(index % 8)}/src/module-${String(index)}.ts`,
  status: "modified",
  additions: index % 37,
  deletions: index % 11,
}));

const meta = {
  component: ChangedFilesTree,
  parameters: {
    componentSubtitle:
      "One diff's files by folder, each with its status and line counts, the selected one shown elsewhere",
  },
  args: {
    files,
    selectedPath: "packages/sdk/src/git/readBranchDiff.ts",
    onSelect: fn(),
  },
  render: (args) => (
    <NarrowFrame>
      <ChangedFilesTree {...args} />
    </NarrowFrame>
  ),
} satisfies Meta<typeof ChangedFilesTree>;

export default meta;

export const PreviewStory: StoryObj<typeof ChangedFilesTree> = {
  name: "ChangedFilesTree Preview",
};

export const VariantsStory: StoryObj<typeof ChangedFilesTree> = {
  name: "ChangedFilesTree Variants",
  render: () => (
    <Story>
      <Story.Section title="every status, counts and left out files, one selected">
        <NarrowFrame>
          <ChangedFilesTree
            files={files}
            selectedPath="packages/sdk/src/git/readBranchDiff.ts"
            onSelect={fn()}
          />
        </NarrowFrame>
      </Story.Section>
      <Story.Section title="nothing selected">
        <NarrowFrame>
          <ChangedFilesTree files={files} selectedPath={null} onSelect={fn()} />
        </NarrowFrame>
      </Story.Section>
      <Story.Section title="a left out file selected">
        <NarrowFrame>
          <ChangedFilesTree
            files={files}
            selectedPath="assets/logo.png"
            onSelect={fn()}
          />
        </NarrowFrame>
      </Story.Section>
      <Story.Section title="no counts: statuses read from the patch">
        <NarrowFrame>
          <ChangedFilesTree
            files={filesWithoutCounts}
            selectedPath={null}
            onSelect={fn()}
          />
        </NarrowFrame>
      </Story.Section>
      <Story.Section title="wide panel">
        <WideFrame>
          <ChangedFilesTree
            files={files}
            selectedPath="README.md"
            onSelect={fn()}
          />
        </WideFrame>
      </Story.Section>
      <Story.Section title="400 files: virtualized">
        <NarrowFrame>
          <ChangedFilesTree
            files={manyFiles}
            selectedPath={null}
            onSelect={fn()}
          />
        </NarrowFrame>
      </Story.Section>
      <Story.Section title="no file">
        <NarrowFrame>
          <ChangedFilesTree files={[]} selectedPath={null} onSelect={fn()} />
        </NarrowFrame>
      </Story.Section>
    </Story>
  ),
};
