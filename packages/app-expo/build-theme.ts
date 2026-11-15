import { readFileSync, writeFileSync } from "node:fs";
import { reviewflowPalette } from "@reviewflow/ui/palette";
import { writeTheme } from "alouette/theme-generator";
import { writeVioletTheme } from "./violetTheme.ts";

const themeVariablesPath = "src/themeVariables.ts";

writeTheme({ outDir: "src", overrides: reviewflowPalette });
// alouette 25 writes a camelcase directive no rule reports, which oxlint
// rejects as unused; alouette 26 no longer writes it.
writeFileSync(
  themeVariablesPath,
  readFileSync(themeVariablesPath, "utf8").replace(
    "/* oxlint-disable eslint-js/camelcase */\n",
    "",
  ),
);
writeVioletTheme({ outDir: "src", palette: reviewflowPalette });
