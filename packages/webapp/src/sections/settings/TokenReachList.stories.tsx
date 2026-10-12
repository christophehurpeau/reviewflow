import type { Meta, StoryObj } from "@storybook/react-native";
import type { OrgSummary } from "reviewflow-modules";
import { Story } from "#storybook/Story.tsx";
import { TokenReachList } from "./TokenReachList.tsx";

const buildOrg = (
  _id: number,
  login: string,
  allowPersonalTokens: boolean,
): OrgSummary => ({ _id, login, status: "active", allowPersonalTokens });

const meta = {
  component: TokenReachList,
  parameters: {
    componentSubtitle: "The accounts a personal token can read",
  },
  args: {
    userLogin: "christophehurpeau",
    orgs: [buildOrg(1, "elax", true), buildOrg(2, "acme", false)],
  },
} satisfies Meta<typeof TokenReachList>;

export default meta;

export const PreviewStory: StoryObj<typeof meta> = {
  name: "TokenReachList Preview",
};

export const VariantsStory: StoryObj<typeof meta> = {
  name: "TokenReachList Variants",
  render: () => (
    <Story>
      <Story.Section title="no org">
        <TokenReachList userLogin="christophehurpeau" orgs={[]} />
      </Story.Section>
      <Story.Section title="every org allows">
        <TokenReachList
          userLogin="christophehurpeau"
          orgs={[buildOrg(1, "elax", true)]}
        />
      </Story.Section>
      <Story.Section title="one org does not allow">
        <TokenReachList
          userLogin="christophehurpeau"
          orgs={[buildOrg(1, "elax", true), buildOrg(2, "acme", false)]}
        />
      </Story.Section>
      <Story.Section title="several orgs do not allow">
        <TokenReachList
          userLogin="christophehurpeau"
          orgs={[
            buildOrg(2, "acme", false),
            buildOrg(3, "globex", false),
            buildOrg(4, "initech", false),
          ]}
        />
      </Story.Section>
    </Story>
  ),
};
