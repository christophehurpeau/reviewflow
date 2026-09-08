import AsyncStorage from "@react-native-async-storage/async-storage";
// generated at metro config load from main.ts, see metro.config.cjs
import { view } from "./storybook.requires.ts";

const StorybookUIRoot = view.getStorybookUI({
  storage: {
    getItem: AsyncStorage.getItem,
    setItem: AsyncStorage.setItem,
  },
});

export default StorybookUIRoot;
