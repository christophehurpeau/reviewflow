---
name: storybook
description: >
  Write and run stories for the reviewflow webapp. Covers where the two
  storybook configs live (on-device `.storybook` rendered on the `/storybook`
  route, web `.storybook-web` used by the vitest browser project), the shape a
  stories file must have — a `Preview` story driven by args and a `Variants`
  story with one `Story.Section` per state — and the rules for screens, which
  get one exported story per case instead. Load when adding, changing or
  reviewing a `*.stories.tsx` in packages/webapp, or when a story fails under
  `pnpm test`.
---

# Storybook (reviewflow webapp)

Two configs over the same stories, and no storybook dev server:

| Dir              | What it is                            | How it runs                            |
| ---------------- | ------------------------------------- | -------------------------------------- |
| `.storybook`     | on-device storybook (metro, alouette) | `/storybook` route of `expo start`     |
| `.storybook-web` | react-native-web + vite mirror        | `pnpm test` (vitest browser, chromium) |

Both point at `../src/**/*.stories.?(ts|tsx)`; **keep the two `stories` globs in
sync**. `.storybook/storybook.requires.ts` is generated at every metro config
load and committed — never edit it.

`.storybook/preview.tsx` is the single preview both configs use. Anything global
a component needs (providers, theme, safe area) goes there, not in a story: the
`/storybook` route renders outside the app providers, with no websocket and no
session.

## Shared rules

- Include `componentSubtitle` in `parameters` on the meta.
- **`args` hold JSON-serializable values only — never a React element** (no
  `children`, no `icon`): storybook deep-walks every arg value to infer its
  argTypes, and on device that walk reaches an expo-router context that throws
  `Couldn't find an UnhandledLinkingContext context.`. `pnpm test` misses it —
  the react-native-web run has no expo-router in the tree. Pass elements from
  `render`, and when the component requires `children`, type the stories
  `StoryObj<typeof Component>` rather than `StoryObj<typeof meta>` so the prop
  `render` already supplies isn't demanded in `args`.
- Exported story functions end with `Story` (`PreviewStory`, `VariantsStory`),
  each with an explicit `name`.
- Use `fn()` from `storybook/test` instead of hand-written fake callbacks.
- Don't add light/dark variants. The story follows the OS color scheme through
  `AlouetteProvider`. Wrap a story in `ScopedTheme theme="dark"` only when dark
  mode is the point of that story — there is no mode toolbar on device.
- Stories render fullscreen (`preview.tsx` sets `parameters.layout`), so a story
  gets exactly the frame the app would: don't set `layout` per story, and don't
  wrap a screen story in a fixed-size frame. `<Story>` supplies its own padding.
- The alouette nesting rules still apply inside a story: never put a `Surface`
  or a `PressableListItem` inside another raised surface.

## Components

Not every component needs a story — write one when the component has states
worth seeing in isolation.

A component stories file is composed of two stories (unlike what is commonly
done in storybook):

- `"<ComponentName> Preview"` — always first, driven by `args`, never wrapped in
  `<Story>`, showing the component in its most basic form.
- `"<ComponentName> Variants"` — every state at once, one `Story.Section` per
  variant. Cover exhaustively every prop that changes behavior or appearance,
  including boundary values (a `rows` prop needs unset, `1` and the default;
  empty and non-empty children). Do this from the start, not after being asked.

Split into extra stories only when a variant needs a fullscreen layout.

A `play`/test-only story never substitutes for a variant. Every distinct shape
or state exercised in a test must also appear as its own `Story.Section` so it
renders under `pnpm test`.

```tsx
import type { Meta, StoryObj } from "@storybook/react-native";
import { Text } from "alouette";
import { Story } from "#storybook/Story.tsx";
import { SettingsSection } from "#/components/settings-section.tsx";

const meta = {
  component: SettingsSection,
  parameters: { componentSubtitle: "Titled block of static settings rows" },
  args: { title: "Slack" },
  render: (args) => (
    <SettingsSection {...args}>
      <Text>Connected as @chris</Text>
    </SettingsSection>
  ),
} satisfies Meta<typeof SettingsSection>;

export default meta;

export const PreviewStory: StoryObj<typeof SettingsSection> = {
  name: "SettingsSection Preview",
};

export const VariantsStory: StoryObj<typeof SettingsSection> = {
  name: "SettingsSection Variants",
  render: () => (
    <Story>
      <Story.Section title="one row">
        <SettingsSection title="Slack">
          <Text>Connected as @chris</Text>
        </SettingsSection>
      </Story.Section>
      <Story.Section title="no row">
        <SettingsSection title="Slack">{null}</SettingsSection>
      </Story.Section>
    </Story>
  ),
};
```

Written examples: [packages/webapp/src/components/list-section.stories.tsx](../../../packages/webapp/src/components/list-section.stories.tsx)
and [packages/webapp/src/components/skeleton.stories.tsx](../../../packages/webapp/src/components/skeleton.stories.tsx).

## Screens

Screens get their own stories, and **cannot use a Variants story** — each case is
its own exported story.

Keep it to the main cases, in particular those that change the layout (loading,
empty, error, populated, a breakpoint-specific arrangement). Don't re-enumerate
variations already covered by the components the screen composes.

A screen that reads liwi resources or the authenticated user cannot be rendered
as-is: extract the presentational part (the `#/sections/**` component taking
plain props) and write the stories against that, not against the route.

## Running

```sh
pnpm --filter webapp run start   # then open /storybook
pnpm test                        # renders every story in chromium, fails on a render error
```

The vitest project needs chromium installed once:

```sh
pnpm --filter webapp exec playwright install chromium
```
