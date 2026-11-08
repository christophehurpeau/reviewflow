/**
 * Turning a line into a heading, a list item, a quote or a fence, as a pure
 * string transform: strip whatever prefix the line has, then apply the new
 * one. Ported from vscode-extension-markdown-beautiful-editor
 * (`src/shared/lineTypes.ts`).
 */
export type LineType =
  | "code"
  | "h1"
  | "h2"
  | "h3"
  | "ol"
  | "paragraph"
  | "quote"
  | "task"
  | "ul";

/**
 * Most specific first. These consume the separator space too, so what is left
 * is the bare content.
 */
export const stripLinePrefix = (line: string): string =>
  line
    .replace(/^(?:-{3,}|\*{3,}|_{3,})\s*$/u, "")
    .replace(/^#{1,6}\s/u, "")
    .replace(/^[-*+]\s\[[ x]\]\s/iu, "")
    .replace(/^[-*+]\s/u, "")
    .replace(/^\d+\.\s/u, "")
    .replace(/^>+\s?/u, "")
    .replace(/^```\w*\s*/u, "");

export const applyLinePrefix = (content: string, type: LineType): string => {
  switch (type) {
    case "paragraph":
      return content;
    case "h1":
      return `# ${content}`;
    case "h2":
      return `## ${content}`;
    case "h3":
      return `### ${content}`;
    case "ul":
      return `- ${content}`;
    case "ol":
      return `1. ${content}`;
    case "task":
      return `- [ ] ${content}`;
    case "quote":
      return `> ${content}`;
    case "code":
      return `\`\`\`\n${content}\n\`\`\``;
    default:
      return content;
  }
};
