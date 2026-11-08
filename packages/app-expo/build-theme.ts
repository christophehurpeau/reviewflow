import { reviewflowPalette } from "@reviewflow/ui/palette";
import { writeTheme } from "alouette/theme-generator";
import { writeVioletTheme } from "./violetTheme.ts";

writeTheme({ outDir: "src", overrides: reviewflowPalette });
writeVioletTheme({ outDir: "src", palette: reviewflowPalette });
