import { reviewflowPalette } from "@reviewflow/ui/palette";
import { writeTheme } from "alouette/theme-generator";

writeTheme({ outDir: "src", overrides: reviewflowPalette });
