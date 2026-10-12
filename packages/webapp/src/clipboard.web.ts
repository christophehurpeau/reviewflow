// expo-clipboard is kept out of the web bundle: its expo-modules-core sources
// break the vite dependency optimizer the stories render with
export const copyToClipboard = async (text: string): Promise<void> => {
  // oxlint-disable-next-line node-js/no-unsupported-features/node-builtins -- the browser navigator
  await navigator.clipboard.writeText(text);
};
