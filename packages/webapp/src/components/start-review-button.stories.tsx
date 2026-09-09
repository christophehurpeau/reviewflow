import type { Meta, StoryObj } from "@storybook/react-native";
import { HStack, PressableListItem, Text, VStack } from "alouette";
import { fn } from "storybook/test";
import { StartReviewButton } from "#/components/start-review-button.tsx";
import { Story } from "#storybook/Story.tsx";

const succeeds = (): Promise<void> => Promise.resolve();

const fails = (): Promise<void> =>
  Promise.reject(new Error("You can not review your own pull request"));

const meta = {
  component: StartReviewButton,
  parameters: {
    componentSubtitle: "Tells github and reviewflow a review has begun",
  },
  args: {
    onStartReview: succeeds,
  },
} satisfies Meta<typeof StartReviewButton>;

export default meta;

export const PreviewStory: StoryObj<typeof StartReviewButton> = {
  name: "StartReviewButton Preview",
};

export const VariantsStory: StoryObj<typeof StartReviewButton> = {
  name: "StartReviewButton Variants",
  render: () => (
    <Story>
      <Story.Section title="press succeeds">
        <StartReviewButton onStartReview={succeeds} />
      </Story.Section>

      <Story.Section title="press fails, with github's own reason">
        <StartReviewButton onStartReview={fails} />
      </Story.Section>

      {/* the row press must not fire, and the failure message stays flat */}
      <Story.Section title="inside the row it acts on">
        <PressableListItem onPress={fn()}>
          <HStack className="items-start gap-sm">
            <VStack className="flex-1">
              <Text className="font-body-bold">
                Fix flaky worker retry loop
              </Text>
            </VStack>
            <StartReviewButton onStartReview={fails} />
          </HStack>
        </PressableListItem>
      </Story.Section>
    </Story>
  ),
};
