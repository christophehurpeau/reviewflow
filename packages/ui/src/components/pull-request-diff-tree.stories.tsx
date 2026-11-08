import type { Meta, StoryObj } from "@storybook/react-native";
import { View } from "alouette";
import type { ReactNode } from "react";
import { fn } from "storybook/test";
import { Story } from "../stories/Story.tsx";
import type { DiffTreeFile } from "./pull-request-diff-tree-files.ts";
import PullRequestDiffTree from "./pull-request-diff-tree.tsx";

/** the aside column's width; the tree virtualizes, so it needs a height */
function AsideFrame({ children }: { children: ReactNode }): ReactNode {
  return <View className="h-[360px] w-[280px]">{children}</View>;
}

const files: DiffTreeFile[] = [
  { path: "packages/sdk/src/diff/types.ts", status: "modified" },
  { path: "packages/sdk/src/diff/readingOrder.ts", status: "modified" },
  { path: "packages/sdk/src/diff/readingOrder.test.ts", status: "added" },
  {
    path: "packages/ui/src/components/pull-request-diff-tree.tsx",
    status: "added",
  },
  {
    path: "packages/ui/src/components/pull-request-diff-view.tsx",
    status: "modified",
  },
  { path: "packages/ui/src/components/legacy-list.tsx", status: "deleted" },
  { path: "packages/ui/src/components/moved-here.tsx", status: "renamed" },
  { path: "README.md", status: "modified" },
  { path: "assets/logo.png", status: null },
];

const manyFiles: DiffTreeFile[] = Array.from({ length: 400 }, (_, index) => ({
  path: `packages/package-${String(index % 8)}/src/module-${String(index)}.ts`,
  status: "modified",
}));

const meta = {
  component: PullRequestDiffTree,
  parameters: {
    componentSubtitle:
      "The range's files by folder, searchable, with each file's git status and viewed mark",
  },
  args: {
    files,
    viewedPaths: ["packages/sdk/src/diff/types.ts", "README.md"],
    theme: "github",
    onFilePress: fn(),
  },
  render: (args) => (
    <AsideFrame>
      <PullRequestDiffTree {...args} />
    </AsideFrame>
  ),
} satisfies Meta<typeof PullRequestDiffTree>;

export default meta;

export const PreviewStory: StoryObj<typeof PullRequestDiffTree> = {
  name: "PullRequestDiffTree Preview",
};

export const VariantsStory: StoryObj<typeof PullRequestDiffTree> = {
  name: "PullRequestDiffTree Variants",
  render: () => (
    <Story>
      <Story.Section title="every status, viewed and left out files">
        <AsideFrame>
          <PullRequestDiffTree
            files={files}
            viewedPaths={["packages/sdk/src/diff/types.ts", "README.md"]}
            theme="github"
            onFilePress={fn()}
          />
        </AsideFrame>
      </Story.Section>
      <Story.Section title="theme without git colors: the accents">
        <AsideFrame>
          <PullRequestDiffTree
            files={files}
            viewedPaths={[]}
            theme="vscode"
            onFilePress={fn()}
          />
        </AsideFrame>
      </Story.Section>
      <Story.Section title="nothing viewed">
        <AsideFrame>
          <PullRequestDiffTree
            files={files}
            viewedPaths={[]}
            theme="github"
            onFilePress={fn()}
          />
        </AsideFrame>
      </Story.Section>
      <Story.Section title="400 files: virtualized">
        <AsideFrame>
          <PullRequestDiffTree
            files={manyFiles}
            viewedPaths={[]}
            theme="github"
            onFilePress={fn()}
          />
        </AsideFrame>
      </Story.Section>
      <Story.Section title="no file">
        <AsideFrame>
          <PullRequestDiffTree
            files={[]}
            viewedPaths={[]}
            theme="github"
            onFilePress={fn()}
          />
        </AsideFrame>
      </Story.Section>
    </Story>
  ),
};
