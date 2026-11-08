import { Parser } from "htmlparser2";

export type HtmlToken =
  | { kind: "close"; tag: string }
  | { kind: "open"; tag: string; attrs: Record<string, string> }
  | { kind: "text"; value: string };

/**
 * The tags and text of one raw `html` / `inlineHtml` value, in order. Comments
 * are dropped.
 *
 * The parser's implied closes at the end of its input are discarded: a value
 * holding only `<details>` is not a complete element, its `</details>` is in a
 * later sibling, so closing it here would cut the pairing short. Void elements
 * and the parser's own mid-stream rules (`<li>` after `<li>`) do close.
 *
 * The parser ignores a close tag it has no open tag for, and a value holding
 * only `</details>` has none: `openTags`, the caller's currently open tags
 * outermost first, are replayed into the parser first so it can match them.
 */
export const tokenizeHtml = (
  value: string,
  openTags: string[] = [],
): HtmlToken[] => {
  const tokens: HtmlToken[] = [];
  let ended = false;
  let replaying = true;

  const parser = new Parser({
    onopentag(tag, attrs) {
      if (!ended && !replaying) tokens.push({ kind: "open", tag, attrs });
    },
    onclosetag(tag) {
      if (!ended && !replaying) tokens.push({ kind: "close", tag });
    },
    ontext(text) {
      if (replaying) return;
      const last = tokens.at(-1);
      if (last?.kind === "text") last.value += text;
      else tokens.push({ kind: "text", value: text });
    },
  });

  openTags.forEach((tag) => {
    parser.write(`<${tag}>`);
  });
  replaying = false;
  parser.write(value);
  ended = true;
  parser.end();

  return tokens;
};

/**
 * The markdown parser leaves `&amp;` and `&#x1F600;` as typed, which is not
 * what GitHub shows. The text goes through the html parser with its `<`
 * escaped, so only entities are decoded and no tag is ever read out of it.
 */
export const decodeEntities = (value: string): string =>
  value.includes("&")
    ? tokenizeHtml(value.replaceAll("<", "&lt;"))
        .map((token) => (token.kind === "text" ? token.value : ""))
        .join("")
    : value;

/**
 * What follows the complete HTML comments a value starts with, or null when it
 * does not start with one or nothing follows. CommonMark makes a line starting
 * with `<!--` an html block that runs to the end of the line, so the markdown
 * after a comment (`- [ ] <!-- id -->[a link](url)`) reaches here unparsed,
 * where GitHub reads it as the rest of the paragraph.
 */
export const textAfterLeadingComments = (value: string): string | null => {
  let end = 0;
  let leading = true;

  const parser = new Parser({
    oncomment() {
      if (!leading) return;
      if (value.slice(end, parser.startIndex).trim() === "") {
        end = parser.endIndex + 1;
      } else {
        leading = false;
      }
    },
  });
  parser.write(value);
  parser.end();

  const rest = value.slice(end);
  return end > 0 && rest.trim() !== "" ? rest : null;
};
