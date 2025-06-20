import ElaxEnergie from "./Elax-Energie.ts";
import christophehurpeau from "./christophehurpeau.ts";
import liwijs from "./liwijs.ts";
import ornikar from "./ornikar.ts";
import reviewflow from "./reviewflow.ts";
import type { Config as ConfigType } from "./types.ts";

export type Config<TeamNames extends string = any> = ConfigType<TeamNames>;

export const accountConfigs: Record<string, Config> = {
  liwijs,
  ornikar,
  christophehurpeau,
  reviewflow,
  "Elax-Energie": ElaxEnergie,
};

export { default as defaultConfig } from "./defaultConfig.ts";
