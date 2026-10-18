import type { Meta, StoryObj } from "@storybook/react-native";
import { fn } from "storybook/test";
import { Story } from "#storybook/Story.tsx";
import { PersonalTokensPolicySection } from "./PersonalTokensPolicySection.tsx";

const onSetAllow = fn(() => Promise.resolve());

const meta = {
  component: PersonalTokensPolicySection,
  parameters: {
    componentSubtitle: "Lets the org owners allow personal API tokens",
  },
  args: {
    orgLogin: "acme",
    policy: {
      _id: 1,
      allowPersonalTokens: false,
      paidEnabled: true,
      viewerIsOwner: true,
    },
    onSetAllow,
  },
} satisfies Meta<typeof PersonalTokensPolicySection>;

export default meta;

export const PreviewStory: StoryObj<typeof meta> = {
  name: "PersonalTokensPolicySection Preview",
};

export const VariantsStory: StoryObj<typeof meta> = {
  name: "PersonalTokensPolicySection Variants",
  render: () => (
    <Story>
      <Story.Section title="owner, not allowed">
        <PersonalTokensPolicySection
          orgLogin="acme"
          policy={{
            _id: 1,
            allowPersonalTokens: false,
            paidEnabled: true,
            viewerIsOwner: true,
          }}
          onSetAllow={onSetAllow}
        />
      </Story.Section>
      <Story.Section title="owner, allowed">
        <PersonalTokensPolicySection
          orgLogin="acme"
          policy={{
            _id: 1,
            allowPersonalTokens: true,
            paidEnabled: true,
            viewerIsOwner: true,
          }}
          onSetAllow={onSetAllow}
        />
      </Story.Section>
      <Story.Section title="member, not allowed">
        <PersonalTokensPolicySection
          orgLogin="acme"
          policy={{
            _id: 1,
            allowPersonalTokens: false,
            paidEnabled: true,
            viewerIsOwner: false,
          }}
          onSetAllow={onSetAllow}
        />
      </Story.Section>
      <Story.Section title="member, allowed">
        <PersonalTokensPolicySection
          orgLogin="acme"
          policy={{
            _id: 1,
            allowPersonalTokens: true,
            paidEnabled: true,
            viewerIsOwner: false,
          }}
          onSetAllow={onSetAllow}
        />
      </Story.Section>
      <Story.Section title="not enabled: the switch is off and disabled">
        <PersonalTokensPolicySection
          orgLogin="acme"
          policy={{
            _id: 1,
            allowPersonalTokens: false,
            paidEnabled: false,
            viewerIsOwner: true,
          }}
          onSetAllow={onSetAllow}
        />
      </Story.Section>
      <Story.Section title="not enabled, still allowed: the owner can switch it off">
        <PersonalTokensPolicySection
          orgLogin="acme"
          policy={{
            _id: 1,
            allowPersonalTokens: true,
            paidEnabled: false,
            viewerIsOwner: true,
          }}
          onSetAllow={onSetAllow}
        />
      </Story.Section>
    </Story>
  ),
};
