import type { Meta, StoryObj } from "@storybook/react-native";
import type { PersonalTokenSummary } from "reviewflow-modules";
import { fn } from "storybook/test";
import { Story } from "#storybook/Story.tsx";
import { PersonalTokensList } from "./PersonalTokensList.tsx";

const createdToken = { _id: "new-token", token: "rfp_new" };

const neverUsedToken: PersonalTokenSummary = {
  _id: "never-used",
  name: "vigie on MacBook",
  prefix: "rfp_x7Kq",
  createdAt: new Date("2026-10-12T09:00:00Z"),
};

const usedToken: PersonalTokenSummary = {
  _id: "used",
  name: "vigie on the CI runner",
  prefix: "rfp_9fZa",
  createdAt: new Date("2026-09-03T09:00:00Z"),
  lastUsedAt: new Date("2026-10-11T17:42:00Z"),
  lastUsedIp: "203.0.113.42",
};

const usedWithoutIpToken: PersonalTokenSummary = {
  _id: "used-without-ip",
  name: "scripts",
  prefix: "rfp_Lm2c",
  createdAt: new Date("2026-08-20T09:00:00Z"),
  lastUsedAt: new Date("2026-08-21T08:00:00Z"),
};

const longNameToken: PersonalTokenSummary = {
  _id: "long-name",
  name: "vigie on the shared build machine in the office, the one under the desk near the window",
  prefix: "rfp_Qp0d",
  createdAt: new Date("2026-10-01T09:00:00Z"),
};

const callbacks = {
  onCreate: fn(() => Promise.resolve(createdToken)),
  onRegenerate: fn(() => Promise.resolve(createdToken)),
  onRevoke: fn(() => Promise.resolve()),
};

// tokens hold dates: kept out of `args`, which storybook walks to infer argTypes
const meta = {
  component: PersonalTokensList,
  parameters: {
    componentSubtitle: "Lists, creates, regenerates and revokes API tokens",
  },
  args: callbacks,
  render: (args) => (
    <PersonalTokensList {...args} tokens={[neverUsedToken, usedToken]} />
  ),
} satisfies Meta<typeof PersonalTokensList>;

export default meta;

export const PreviewStory: StoryObj<typeof PersonalTokensList> = {
  name: "PersonalTokensList Preview",
};

export const VariantsStory: StoryObj<typeof PersonalTokensList> = {
  name: "PersonalTokensList Variants",
  render: () => (
    <Story>
      <Story.Section title="no token">
        <PersonalTokensList {...callbacks} tokens={[]} />
      </Story.Section>
      <Story.Section title="never used">
        <PersonalTokensList {...callbacks} tokens={[neverUsedToken]} />
      </Story.Section>
      <Story.Section title="used, with and without the ip">
        <PersonalTokensList
          {...callbacks}
          tokens={[usedToken, usedWithoutIpToken]}
        />
      </Story.Section>
      <Story.Section title="name long enough to wrap">
        <PersonalTokensList {...callbacks} tokens={[longNameToken]} />
      </Story.Section>
    </Story>
  ),
};
