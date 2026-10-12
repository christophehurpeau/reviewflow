import type { Meta, StoryObj } from "@storybook/react-native";
import { SlackConnectionCard } from "#/components/slack-connection-card.tsx";
import { Story } from "#storybook/Story.tsx";

const meta = {
  component: SlackConnectionCard,
  parameters: {
    componentSubtitle: "Slack link of the organization and of the user",
  },
  args: {
    orgId: 1,
    orgLogin: "reviewflow",
    slack: {
      state: "linked",
      teamName: "reviewflow",
      teamId: "T01495JH7RS",
      userId: "U0141JJ4JSZ",
      usesDeprecatedCustomApp: false,
    },
  },
} satisfies Meta<typeof SlackConnectionCard>;

export default meta;

export const PreviewStory: StoryObj<typeof meta> = {
  name: "SlackConnectionCard Preview",
};

export const VariantsStory: StoryObj<typeof meta> = {
  name: "SlackConnectionCard Variants",
  render: () => (
    <Story>
      <Story.Section title="app not installed">
        <SlackConnectionCard
          orgId={1}
          orgLogin="reviewflow"
          slack={{ state: "app-not-installed", usesDeprecatedCustomApp: false }}
        />
      </Story.Section>
      <Story.Section title="user not linked">
        <SlackConnectionCard
          orgId={1}
          orgLogin="reviewflow"
          slack={{
            state: "user-not-linked",
            teamName: "reviewflow",
            teamId: "T01495JH7RS",
            usesDeprecatedCustomApp: false,
          }}
        />
      </Story.Section>
      <Story.Section title="linked">
        <SlackConnectionCard
          orgId={1}
          orgLogin="reviewflow"
          slack={{
            state: "linked",
            teamName: "reviewflow",
            teamId: "T01495JH7RS",
            userId: "U0141JJ4JSZ",
            usesDeprecatedCustomApp: false,
          }}
        />
      </Story.Section>
      <Story.Section title="token revoked">
        <SlackConnectionCard
          orgId={1}
          orgLogin="reviewflow"
          slack={{
            state: "token-revoked",
            teamName: "reviewflow",
            teamId: "T01495JH7RS",
            userId: "U0141JJ4JSZ",
            usesDeprecatedCustomApp: false,
          }}
        />
      </Story.Section>
      <Story.Section title="team without name">
        <SlackConnectionCard
          orgId={1}
          orgLogin="reviewflow"
          slack={{
            state: "linked",
            teamId: "T01495JH7RS",
            userId: "U0141JJ4JSZ",
            usesDeprecatedCustomApp: false,
          }}
        />
      </Story.Section>
      <Story.Section title="deprecated custom app">
        <SlackConnectionCard
          orgId={1}
          orgLogin="reviewflow"
          slack={{
            state: "linked",
            teamName: "reviewflow",
            userId: "U0141JJ4JSZ",
            usesDeprecatedCustomApp: true,
          }}
        />
      </Story.Section>
    </Story>
  ),
};
