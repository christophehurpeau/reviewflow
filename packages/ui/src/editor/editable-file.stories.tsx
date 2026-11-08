import type { Meta, StoryObj } from "@storybook/react-native";
import { Box, Button, Text } from "alouette";
import { useState } from "react";
import type { ReactNode } from "react";
import { expect, userEvent, within } from "storybook/test";
import { Story } from "../stories/Story.tsx";
import type {
  EditableFileProps,
  EditableFileSaveResult,
} from "./editable-file.tsx";
import { EditableFile } from "./editable-file.tsx";

const config =
  '{\n  "repos": {\n    "acme/storefront": "/Users/ada/dev/storefront"\n  }\n}\n';
const edited = config.replace(
  'storefront"\n',
  'storefront",\n    "acme/web": "/Users/ada/dev/web"\n',
);

/** An editor opened on the config, whose save answers `answer` after a beat. */
function Case({
  answer,
  initialValue,
  cursor,
}: {
  answer: (source: string) => EditableFileSaveResult;
  initialValue?: string;
  cursor?: number;
}): ReactNode {
  return (
    <Box className="surface surface-sm">
      <EditableFile
        language="json"
        aria-label="config.json"
        path="/Users/ada/.reviewflow-app/config.json"
        source={config}
        initialValue={initialValue}
        cursor={cursor}
        onSave={(source) =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve(answer(source));
            }, 300);
          })
        }
      />
    </Box>
  );
}

const meta = {
  component: EditableFile,
  parameters: {
    componentSubtitle:
      "A file edited as the text it is, with a save that can refuse, warn or find the file changed",
  },
} satisfies Meta<typeof EditableFile>;

export default meta;

type Props = EditableFileProps;
type Story_ = StoryObj<Props>;

export const CleanStory: Story_ = {
  name: "EditableFile Clean",
  render: () => (
    <Case answer={(source) => ({ status: "saved", source, warnings: [] })} />
  ),
};

export const UnsavedSuggestionStory: Story_ = {
  name: "EditableFile Unsaved suggestion",
  render: () => (
    <Case
      answer={(source) => ({ status: "saved", source, warnings: [] })}
      initialValue={edited}
      cursor={edited.indexOf('"/Users/ada/dev/web"') + 1}
    />
  ),
};

export const ValidationErrorStory: Story_ = {
  name: "EditableFile Validation error",
  render: () => (
    <Case
      initialValue={edited}
      answer={() => ({
        status: "invalid",
        error: 'repos["acme/web"] must be an absolute path',
      })}
    />
  ),
};

export const WarningsStory: Story_ = {
  name: "EditableFile Warnings",
  render: () => (
    <Case
      initialValue={edited}
      answer={(source) => ({
        status: "saved",
        source,
        warnings: [
          "acme/web: /Users/ada/dev/web does not exist or is not a directory",
        ],
      })}
    />
  ),
};

export const ConflictStory: Story_ = {
  name: "EditableFile Conflict",
  render: () => (
    <Case
      initialValue={edited}
      answer={() => ({
        status: "conflict",
        source: '{\n  "repos": {}\n}\n',
      })}
    />
  ),
};

/** Unsaved edits, then the file read again with what someone else wrote on disk. */
function RefetchedCase(): ReactNode {
  const [source, setSource] = useState(config);
  return (
    <Box className="surface surface-sm gap-xs">
      <Button
        text="Change it on disk"
        onPress={() => {
          setSource('{\n  "repos": {}\n}\n');
        }}
      />
      <EditableFile
        language="json"
        aria-label="config.json"
        source={source}
        initialValue={edited}
        onSave={(saved) =>
          Promise.resolve({ status: "saved", source: saved, warnings: [] })
        }
      />
    </Box>
  );
}

export const RefetchedWhileEditingStory: Story_ = {
  name: "EditableFile Refetched while editing",
  render: () => <RefetchedCase />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole("button", { name: "Change it on disk" }),
    );
    await expect(
      await canvas.findByText("The file changed on disk since it was opened."),
    ).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Save" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  },
};

export const VariantsStory: Story_ = {
  name: "EditableFile Markdown",
  render: () => (
    <Story>
      <Story.Section title="language=markdown">
        <Box className="surface surface-sm gap-xs">
          <Text className="text-sm text-muted">A template, edited raw.</Text>
          <EditableFile
            language="markdown"
            aria-label="template.md"
            source={"---\nname: Deslop\n---\n/deslop\n"}
            onSave={(source) =>
              Promise.resolve({ status: "saved", source, warnings: [] })
            }
          />
        </Box>
      </Story.Section>
    </Story>
  ),
};
