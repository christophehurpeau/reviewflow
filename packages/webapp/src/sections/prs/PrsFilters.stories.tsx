import type { Meta, StoryObj } from "@storybook/react-native";
import { fn } from "storybook/test";
import { PrsFilters } from "#/sections/prs/PrsFilters.tsx";
import { Story } from "#storybook/Story.tsx";

const accounts = [
  { id: 1, login: "elax" },
  { id: 2, login: "acme" },
];
const options = {
  repos: ["acme/api", "elax/reviewflow"],
  authors: ["ada", "frank"],
  labels: [":green_heart: checks/fail", "cleanup"],
};

const meta = {
  component: PrsFilters,
  parameters: {
    componentSubtitle: "The open or closed view and what narrows its rows",
  },
  args: {
    accounts,
    selectedAccountLogin: undefined,
    state: "open",
    filters: {},
    options,
    onSelectAccountLogin: fn(),
    onStateChange: fn(),
    onFiltersChange: fn(),
  },
} satisfies Meta<typeof PrsFilters>;

export default meta;

export const PreviewStory: StoryObj<typeof PrsFilters> = {
  name: "PrsFilters Preview",
};

export const VariantsStory: StoryObj<typeof PrsFilters> = {
  name: "PrsFilters Variants",
  render: (args) => (
    <Story>
      <Story.Section title="a single account: no account filter">
        <PrsFilters {...args} accounts={[accounts[0]!]} />
      </Story.Section>
      <Story.Section title="closed">
        <PrsFilters {...args} state="closed" />
      </Story.Section>
      <Story.Section title="filters active: they can be cleared">
        <PrsFilters
          {...args}
          selectedAccountLogin="acme"
          filters={{
            repo: "acme/api",
            author: "ada",
            draft: "ready",
            checks: "failed",
            search: "retry",
            review: "approved",
            label: ":green_heart: checks/fail",
          }}
        />
      </Story.Section>
      <Story.Section title="nothing loaded yet">
        <PrsFilters
          {...args}
          options={{ repos: [], authors: [], labels: [] }}
        />
      </Story.Section>
    </Story>
  ),
};
