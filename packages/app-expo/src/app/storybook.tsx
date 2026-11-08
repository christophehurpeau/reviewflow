import { Redirect } from "expo-router";
import type { ReactNode } from "react";
import StorybookUIRoot from "../../.storybook/index.ts";

/** On-device storybook, dev only: metro stubs `.storybook/` out of a production bundle. */
export default function StorybookRoute(): ReactNode {
  if (process.env.NODE_ENV === "production") {
    return <Redirect href="/" />;
  }

  return <StorybookUIRoot />;
}
