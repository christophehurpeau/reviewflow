import type { Meta, StoryObj } from "@storybook/react-native";
import type { AdminAccountSummary } from "reviewflow-modules";
import { fn } from "storybook/test";
import { Story } from "#storybook/Story.tsx";
import { AdminAccountsList } from "./AdminAccountsList.tsx";

const onSetEnabled = fn(() => Promise.resolve());

const enabledOrg: AdminAccountSummary = {
  _id: 1,
  login: "elax",
  type: "Organization",
  knownSince: new Date("2026-03-04T09:00:00Z"),
  paidEnabled: true,
};

const disabledOrg: AdminAccountSummary = {
  _id: 2,
  login: "acme",
  type: "Organization",
  knownSince: new Date("2026-09-20T09:00:00Z"),
  paidEnabled: false,
};

const unknownDateUser: AdminAccountSummary = {
  _id: 3,
  login: "jane-doe",
  type: "User",
  paidEnabled: false,
};

const meta = {
  component: AdminAccountsList,
  parameters: {
    componentSubtitle: "Installed accounts, with the paid features switch",
  },
  args: {
    title: "Organizations",
    accounts: [enabledOrg, disabledOrg],
    onSetEnabled,
  },
} satisfies Meta<typeof AdminAccountsList>;

export default meta;

export const PreviewStory: StoryObj<typeof meta> = {
  name: "AdminAccountsList Preview",
};

export const VariantsStory: StoryObj<typeof meta> = {
  name: "AdminAccountsList Variants",
  render: () => (
    <Story>
      <Story.Section title="empty">
        <AdminAccountsList
          title="Organizations"
          accounts={[]}
          onSetEnabled={onSetEnabled}
        />
      </Story.Section>
      <Story.Section title="one account, enabled">
        <AdminAccountsList
          title="Organizations"
          accounts={[enabledOrg]}
          onSetEnabled={onSetEnabled}
        />
      </Story.Section>
      <Story.Section title="mixed">
        <AdminAccountsList
          title="Organizations"
          accounts={[enabledOrg, disabledOrg]}
          onSetEnabled={onSetEnabled}
        />
      </Story.Section>
      <Story.Section title="installation date unknown">
        <AdminAccountsList
          title="Personal accounts"
          accounts={[unknownDateUser]}
          onSetEnabled={onSetEnabled}
        />
      </Story.Section>
    </Story>
  ),
};
