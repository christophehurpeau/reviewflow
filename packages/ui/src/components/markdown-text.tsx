import type { BlockNode, InlineNode, TableNode } from "@tanstack/markdown";
import { parseMarkdown } from "@tanstack/markdown/parser";
import {
  Box,
  Code,
  ErrorMessage,
  ExternalLink,
  ExternalLinkText,
  Icon,
  InteractiveBox,
  PressableBox,
  Separator,
  Text,
  View,
} from "alouette";
import { CaretDownRegularIcon } from "alouette-icons/phosphor-icons/CaretDown";
import { CaretRightRegularIcon } from "alouette-icons/phosphor-icons/CaretRight";
import { CheckFatFillIcon } from "alouette-icons/phosphor-icons/CheckFat";
import {
  type ReactNode,
  createContext,
  memo,
  use,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Image } from "react-native";
import type { ViewProps } from "react-native";
import {
  type GhImage,
  collectImages,
  isImageRun,
  textOf,
} from "../markdown-github/flatten.ts";
import {
  type GhBlockNode,
  type GhElement,
  type GhListItem,
  type GhTableCell,
  isInlineNode,
  pairGithubHtml,
} from "../markdown-github/pair-html.ts";
import { isSafeUrl } from "../markdown-github/safe-url.ts";
import { columnWeights } from "../markdown-github/table-columns.ts";
import { toggleTask } from "../markdown-github/toggle-task.ts";
import { emojify } from "../services/emojify.ts";
import { imageSourceOf, useGithubImages } from "../services/githubImages.tsx";
import { CopyableCodeBlock } from "./copyable-code-block.tsx";
import { SuggestedChange } from "./markdown-suggestion.tsx";

/**
 * An agent answers in markdown, so a transcript that shows the source shows
 * `**this**` and a table as a row of pipes — which is most of what an agent's
 * summary is made of.
 *
 * `@tanstack/markdown/parser` is the parser and nothing else: its `./react`
 * entry point renders dom elements, and the webapp is react-native-web where a
 * raw `<p>` is the exception that had to be argued for (see the archive
 * button's `title`). What comes back is a typed tree, and every node below is
 * an alouette component, so this renders on native too.
 *
 * The parser is pre-1.0 (0.0.13). The blast radius is this file: nothing else
 * imports it, and a tree it refuses is caught where it is parsed.
 */

const markdownSeparatorClass = "my-xs border-border-muted";

const headingClass = (depth: number): string => {
  if (depth === 1) return "font-heading-extrabold text-2xl";
  if (depth === 2) return "font-heading-bold text-xl";
  if (depth === 3) return "font-heading-bold text-lg";
  return "font-body-bold text-sm";
};

/** A link needs its label as one string, so the run is flattened for it. */
const inlineText = (nodes: InlineNode[]): string =>
  nodes
    .map((node) => {
      if (node.type === "text" || node.type === "inlineCode") return node.value;
      if ("children" in node) return inlineText(node.children);
      return "";
    })
    .join("");

/**
 * Inline nodes are rendered as children of one `Text`, which is what lets bold
 * and code sit inside a sentence rather than breaking it into boxes: nested
 * `Text` is how react-native does a run of styled text.
 */
function InlineNodes({ nodes }: { nodes: InlineNode[] }): ReactNode {
  return nodes.map((node, index) => {
    const key = `${node.type}-${String(index)}`;

    if (node.type === "text") {
      return <Text key={key}>{node.value}</Text>;
    }
    if (node.type === "inlineCode") {
      return (
        <Code key={key} accent="info" className="text-accent">
          {node.value}
        </Code>
      );
    }
    if (node.type === "strong") {
      return (
        <Text key={key} className="font-body-bold">
          <InlineNodes nodes={node.children} />
        </Text>
      );
    }
    if (node.type === "emphasis") {
      return (
        <Text key={key} className="italic">
          <InlineNodes nodes={node.children} />
        </Text>
      );
    }
    if (node.type === "strike") {
      return (
        <Text key={key} className="line-through">
          <InlineNodes nodes={node.children} />
        </Text>
      );
    }
    if (node.type === "link") {
      if (!isSafeUrl(node.href)) {
        return <Text key={key}>{inlineText(node.children)}</Text>;
      }
      return (
        <ExternalLinkText
          key={key}
          accent="info"
          icon={null}
          size="sm"
          href={node.href}
          text={inlineText(node.children)}
        />
      );
    }
    if (node.type === "image") {
      return <Text key={key}>{`[${node.alt}]`}</Text>;
    }
    if (node.type === "break") return <Text key={key}>{"\n"}</Text>;
    // Raw html is shown as its source rather than dropped: an agent writing a
    // tag meant something by it, and this renders no dom to give it to.
    if (node.type === "inlineHtml") {
      return <Text key={key}>{node.value}</Text>;
    }
    return null;
  });
}

/**
 * A table is a grid of `Text`, not a dom `<table>`: the same reason the rest of
 * this file is alouette. Every cell wraps and each column grows by the weight of
 * its content (`columnWeights`). On web a flex item will not shrink below its
 * min-content width, so without `min-w-0` and `wrap-anywhere` one unbreakable
 * identifier widens its cell and shifts that row out of the grid.
 */
function MarkdownTable({ node }: { node: TableNode }): ReactNode {
  const weights = columnWeights(
    [node.header, ...node.rows].map((row) =>
      row.map((cell) => inlineText(cell.children)),
    ),
  );
  return (
    <View className="gap-0 rounded-sm border border-border-muted">
      <View className="flex-row gap-xs border-border-muted border-b px-xs py-xxs">
        {node.header.map((cell, index) => (
          <Text
            key={`header-${String(index)}`}
            className="min-w-0 basis-0 text-xs font-body-bold web:wrap-anywhere"
            style={{ flexGrow: weights[index] }}
          >
            <InlineNodes nodes={cell.children} />
          </Text>
        ))}
      </View>
      {node.rows.map((row, rowIndex) => (
        <View
          key={`row-${String(rowIndex)}`}
          className="flex-row gap-xs px-xs py-xxs"
        >
          {row.map((cell, index) => (
            <Text
              key={`cell-${String(index)}`}
              className="min-w-0 basis-0 select-auto text-xs web:wrap-anywhere"
              style={{ flexGrow: weights[index] }}
            >
              <InlineNodes nodes={cell.children} />
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

const blockquoteRole = "blockquote" as NonNullable<ViewProps["role"]>;

/**
 * alouette's `Blockquote` wraps its children in a `Paragraph`, a `<p>` on web,
 * and a markdown quote holds blocks — a list or a table there is a `<div>` in a
 * `<p>`. Same frame, block children — until alouette#374 lands.
 */
function MarkdownQuote({ children }: { children: ReactNode }): ReactNode {
  return (
    <Box role={blockquoteRole} className="gap-xs border-l-4 border-accent pl-m">
      {children}
    </Box>
  );
}

function BlockNodes({ nodes }: { nodes: BlockNode[] }): ReactNode {
  return nodes.map((node, index) => {
    const key = `${node.type}-${String(index)}`;

    if (node.type === "paragraph") {
      return (
        <Text key={key} className="select-auto text-sm">
          <InlineNodes nodes={node.children} />
        </Text>
      );
    }
    if (node.type === "heading") {
      return (
        <Text key={key} className={`select-auto ${headingClass(node.depth)}`}>
          <InlineNodes nodes={node.children} />
        </Text>
      );
    }
    if (node.type === "code") {
      return (
        <CopyableCodeBlock
          key={key}
          size="sm"
          title={node.title ?? node.lang}
          text={node.value}
        />
      );
    }
    if (node.type === "list") {
      // Inline rather than its own component, because an item holds blocks and
      // a list is therefore mutually recursive with this: one of the two would
      // have to be used before it is defined.
      return (
        <View key={key} className="gap-xxs">
          {node.items.map((item, itemIndex) => (
            <View
              key={`item-${String(itemIndex)}`}
              className="flex-row items-baseline gap-xs pl-xs"
            >
              <Text className="text-sm text-muted">
                {node.ordered
                  ? `${String((node.start ?? 1) + itemIndex)}.`
                  : "•"}
              </Text>
              <View className="min-w-0 flex-1 gap-xxs">
                <BlockNodes nodes={item.children} />
              </View>
            </View>
          ))}
        </View>
      );
    }
    if (node.type === "table") return <MarkdownTable key={key} node={node} />;
    if (node.type === "blockquote" || node.type === "callout") {
      return (
        <MarkdownQuote key={key}>
          <BlockNodes nodes={node.children} />
        </MarkdownQuote>
      );
    }
    if (node.type === "thematicBreak") {
      return <Separator key={key} className={markdownSeparatorClass} />;
    }
    if (node.type === "html") {
      return (
        <Text key={key} className="select-auto font-mono text-xs text-muted">
          {node.value}
        </Text>
      );
    }
    return null;
  });
}

/*
 * GitHub rendering. A second set of components over the paired tree
 * (`markdown-github/pair-html.ts`) rather than flags in the ones above, so the
 * transcript's rendering cannot change with it.
 */

interface TaskToggleValue {
  /** Null: the boxes are read-only. */
  toggle: ((taskIndex: number) => void) | null;
  busy: boolean;
}

const TaskToggleContext = createContext<TaskToggleValue>({
  toggle: null,
  busy: false,
});

const externalLinkBehavior = {
  native: "webBrowser",
  web: "targetBlank",
} as const;

const maxImageWidth = 600;

/**
 * An image has no size until it is loaded, and react-native-web renders it at
 * 0x0 without one. The size is data read at runtime, so it goes through `style`,
 * like a label's colour in `label-pill.tsx`.
 */
function GithubImage({ src, alt }: GhImage): ReactNode {
  const safe = isSafeUrl(src, ["http:", "https:"]);
  const proxies = useGithubImages();
  const source = safe ? imageSourceOf(src, proxies) : null;
  const [size, setSize] = useState<
    "failed" | { width: number; height: number } | null
  >(null);

  useEffect(() => {
    if (source === null) return undefined;
    let cancelled = false;
    Image.getSize(
      source,
      (width, height) => {
        if (!cancelled) setSize({ width, height });
      },
      () => {
        if (!cancelled) setSize("failed");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [source]);

  if (!safe) return <Text className="text-sm">{alt || src}</Text>;
  // a host GitHub does not proxy would learn who reads the pull request
  if (source === null || size === "failed") {
    return (
      <ExternalLinkText
        accent="info"
        size="sm"
        href={src}
        text={alt || src}
        icon={null}
      />
    );
  }
  if (size === null) {
    return <Text className="text-xs text-muted">{alt}</Text>;
  }
  return (
    <Image
      source={{ uri: source }}
      alt={alt}
      resizeMode="contain"
      style={{
        width: Math.min(size.width, maxImageWidth),
        maxWidth: "100%",
        aspectRatio: size.width / Math.max(size.height, 1),
      }}
    />
  );
}

function GithubImageLink({
  href,
  images,
}: {
  href: string;
  images: GhImage[];
}): ReactNode {
  return (
    <ExternalLink
      as={PressableBox}
      variant="soft"
      href={href}
      openLinkBehavior={externalLinkBehavior}
      className="rounded-sm"
    >
      <View className="flex-row flex-wrap items-center gap-xs">
        {images.map((image, index) => (
          <GithubImage key={`${image.src}-${String(index)}`} {...image} />
        ))}
      </View>
    </ExternalLink>
  );
}

const droppedTags = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "textarea",
  "title",
  "head",
]);

/** The class of a tag that only styles its text, or none. */
const textTagClass = (tag: string): string | undefined => {
  if (tag === "b" || tag === "strong") return "font-body-bold";
  if (tag === "i" || tag === "em" || tag === "cite" || tag === "var") {
    return "italic";
  }
  if (tag === "s" || tag === "del" || tag === "strike") return "line-through";
  if (tag === "ins" || tag === "u") return "underline";
  // No baseline shift outside the web: the size alone sets them apart there.
  if (tag === "sub") return "text-xs web:align-sub";
  if (tag === "sup") return "text-xs web:align-super";
  if (tag === "small") return "text-xs";
  return undefined;
};

function GithubInlines({ nodes }: { nodes: GhBlockNode[] }): ReactNode {
  const renderElement = (node: GhElement, key: string): ReactNode => {
    const { tag, attrs, children } = node;

    if (droppedTags.has(tag)) return null;
    if (tag === "br") return <Text key={key}>{"\n"}</Text>;
    if (tag === "img") {
      return (
        <GithubImage key={key} src={attrs.src ?? ""} alt={attrs.alt ?? ""} />
      );
    }
    if (tag === "picture") {
      return collectImages(children)
        .slice(0, 1)
        .map((image) => <GithubImage key={image.src} {...image} />);
    }
    if (tag === "code") {
      return (
        <Code key={key} accent="info" className="text-accent">
          {textOf(children)}
        </Code>
      );
    }
    if (tag === "kbd") return <Code key={key}>{textOf(children)}</Code>;
    if (tag === "a") {
      const href = attrs.href;
      if (href === undefined || !isSafeUrl(href)) {
        return <GithubInlines key={key} nodes={children} />;
      }
      const images = collectImages(children);
      if (images.length > 0) {
        return <GithubImageLink key={key} href={href} images={images} />;
      }
      return (
        <ExternalLinkText
          key={key}
          accent="info"
          icon={null}
          size="sm"
          href={href}
          text={emojify(textOf(children))}
        />
      );
    }

    const className = textTagClass(tag);
    if (className === undefined) {
      return <GithubInlines key={key} nodes={children} />;
    }
    return (
      <Text key={key} className={className}>
        <GithubInlines nodes={children} />
      </Text>
    );
  };

  return nodes.map((node, index) => {
    const key = `${node.type}-${String(index)}`;

    switch (node.type) {
      case "text":
        return <Text key={key}>{emojify(node.value)}</Text>;
      case "inlineCode":
        return (
          <Code key={key} accent="info" className="text-accent">
            {node.value}
          </Code>
        );
      case "strong":
        return (
          <Text key={key} className="font-body-bold">
            <GithubInlines nodes={node.children} />
          </Text>
        );
      case "emphasis":
        return (
          <Text key={key} className="italic">
            <GithubInlines nodes={node.children} />
          </Text>
        );
      case "strike":
        return (
          <Text key={key} className="line-through">
            <GithubInlines nodes={node.children} />
          </Text>
        );
      case "link": {
        if (!isSafeUrl(node.href)) {
          return <GithubInlines key={key} nodes={node.children} />;
        }
        const images = collectImages(node.children);
        if (images.length > 0) {
          return <GithubImageLink key={key} href={node.href} images={images} />;
        }
        return (
          <ExternalLinkText
            key={key}
            accent="info"
            icon={null}
            size="sm"
            href={node.href}
            text={emojify(textOf(node.children))}
          />
        );
      }
      case "image":
        return <GithubImage key={key} src={node.src} alt={node.alt} />;
      case "break":
        return <Text key={key}>{"\n"}</Text>;
      case "element":
        return renderElement(node, key);
      case "footnoteReference":
      case "paragraph":
      case "heading":
      case "code":
      case "list":
      case "table":
      case "blockquote":
      case "callout":
      case "thematicBreak":
      default:
        return null;
    }
  });
}

function GithubTable({
  header,
  rows,
}: {
  header: GhTableCell[];
  rows: GhTableCell[][];
}): ReactNode {
  const weights = columnWeights(
    [header, ...rows].map((row) => row.map((cell) => textOf(cell.children))),
  );
  return (
    <View className="gap-0 rounded-sm border border-border-muted">
      <View className="flex-row gap-xs border-border-muted border-b px-xs py-xxs">
        {header.map((cell, index) => (
          <Text
            key={`header-${String(index)}`}
            className="min-w-0 basis-0 text-xs font-body-bold web:wrap-anywhere"
            style={{ flexGrow: weights[index] }}
          >
            <GithubInlines nodes={cell.children} />
          </Text>
        ))}
      </View>
      {rows.map((row, rowIndex) => (
        <View
          key={`row-${String(rowIndex)}`}
          className="flex-row gap-xs px-xs py-xxs"
        >
          {row.map((cell, index) => (
            <Text
              key={`cell-${String(index)}`}
              className="min-w-0 basis-0 select-auto text-xs web:wrap-anywhere"
              style={{ flexGrow: weights[index] }}
            >
              <GithubInlines nodes={cell.children} />
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

/** Its content arrives rendered: this is defined before the component that renders blocks. */
function GithubDetails({
  initiallyOpen,
  summary,
  children,
}: {
  initiallyOpen: boolean;
  summary: ReactNode;
  children: ReactNode;
}): ReactNode {
  const [open, setOpen] = useState(initiallyOpen);

  return (
    <View className="gap-xs">
      <PressableBox
        variant="soft"
        role="button"
        aria-expanded={open}
        className="flex-row items-center gap-xs self-start rounded-sm px-xs py-xxs"
        onPress={() => {
          setOpen((value) => !value);
        }}
      >
        <Icon
          icon={open ? <CaretDownRegularIcon /> : <CaretRightRegularIcon />}
          size={14}
          className="text-muted"
        />
        {summary}
      </PressableBox>
      {open ? (
        <View className="gap-xs border-border-muted border-l pl-m">
          {children}
        </View>
      ) : null}
    </View>
  );
}

/**
 * alouette's `Checkbox` owns a plain-text label, and a task's text is rich (a
 * link, emphasis, code), so the box is drawn here beside the rendered content.
 * Its name is the flattened text.
 */
function GithubTask({
  item,
  label,
}: {
  item: GhListItem;
  label: string;
}): ReactNode {
  const { toggle, busy } = use(TaskToggleContext);
  const { taskIndex } = item;
  const disabled = toggle === null || busy || taskIndex === undefined;
  const checked = item.checked === true;

  // Set in a line of text so the row can align it on the content's baseline: a
  // box pinned to the top sat above the text.
  return (
    <Text className="text-sm">
      <InteractiveBox
        withFocusVisibleOutline
        withPressEffect={false}
        role="checkbox"
        aria-checked={checked}
        aria-disabled={disabled}
        aria-label={label}
        disabled={disabled}
        className="size-[18px] items-center justify-center rounded-[5px] border-2 border-interactive-pressable web:align-middle"
        onPress={() => {
          if (taskIndex !== undefined) toggle?.(taskIndex);
        }}
      >
        {checked ? (
          <Icon
            icon={<CheckFatFillIcon />}
            size={12}
            className="text-interactive-pressable"
          />
        ) : null}
      </InteractiveBox>
    </Text>
  );
}

const elementItems = (node: GhElement): GhListItem[] =>
  node.children.flatMap((child): GhListItem[] =>
    child.type === "element" && child.tag === "li"
      ? [{ type: "listItem", children: child.children }]
      : [],
  );

const headingDepth = (tag: string): 1 | 2 | 3 | 4 | 5 | 6 | undefined => {
  switch (tag) {
    case "h1":
      return 1;
    case "h2":
      return 2;
    case "h3":
      return 3;
    case "h4":
      return 4;
    case "h5":
      return 5;
    case "h6":
      return 6;
    default:
      return undefined;
  }
};

/** Null for a plain item; a task's accessible name is its flattened text. */
const taskLabel = (item: GhListItem): string | null => {
  if (item.checked === undefined) return null;
  return emojify(textOf(item.children)).trim() || "Task item";
};

/**
 * A run of inline nodes is one `Text`, so a sentence with a `<sub>` in it stays
 * a sentence; a run of nothing but pictures is a row of them, which is what a
 * line of badges is.
 */
function GithubRun({ nodes }: { nodes: GhBlockNode[] }): ReactNode {
  if (isImageRun(nodes)) {
    return (
      <View className="flex-row flex-wrap items-center gap-xs">
        <GithubInlines
          nodes={nodes.filter(
            (node) => node.type !== "text" && node.type !== "break",
          )}
        />
      </View>
    );
  }
  return (
    <Text className="select-auto text-sm">
      <GithubInlines nodes={nodes} />
    </Text>
  );
}

function GithubCode({
  node,
}: {
  node: Extract<GhBlockNode, { type: "code" }>;
}): ReactNode {
  if (node.lang === "suggestion") return <SuggestedChange value={node.value} />;
  return (
    <CopyableCodeBlock
      size="sm"
      title={node.title ?? node.lang}
      text={node.value}
    />
  );
}

function GithubBlocks({ nodes }: { nodes: GhBlockNode[] }): ReactNode {
  const rendered: ReactNode[] = [];
  let run: GhBlockNode[] = [];

  const flush = (): void => {
    if (run.length === 0) return;
    const blank = textOf(run).trim() === "" && collectImages(run).length === 0;
    if (!blank) {
      rendered.push(
        <GithubRun key={`run-${String(rendered.length)}`} nodes={run} />,
      );
    }
    run = [];
  };

  const renderList = ({
    key,
    ordered,
    start,
    items,
  }: {
    key: string;
    ordered: boolean;
    start: number;
    items: GhListItem[];
  }): ReactNode => (
    <View key={key} className="gap-xxs">
      {items.map((item, itemIndex) => {
        const label = taskLabel(item);

        return (
          <View
            key={`item-${String(itemIndex)}`}
            className="flex-row items-baseline gap-xs pl-xs"
          >
            {label === null ? (
              <Text className="text-sm text-muted">
                {ordered ? `${String(start + itemIndex)}.` : "•"}
              </Text>
            ) : (
              <GithubTask item={item} label={label} />
            )}
            <View className="min-w-0 flex-1 gap-xxs">
              <GithubBlocks nodes={item.children} />
            </View>
          </View>
        );
      })}
    </View>
  );

  const renderElement = (node: GhElement, key: string): ReactNode => {
    const { tag, attrs, children } = node;
    const depth = headingDepth(tag);

    if (droppedTags.has(tag)) return null;
    if (tag === "details") {
      const summary = children.find(
        (child): child is GhElement =>
          child.type === "element" && child.tag === "summary",
      );
      return (
        <GithubDetails
          key={key}
          initiallyOpen={"open" in attrs}
          summary={
            <Text className="select-auto font-body-bold text-sm">
              {summary ? <GithubInlines nodes={summary.children} /> : "Details"}
            </Text>
          }
        >
          <GithubBlocks nodes={children.filter((child) => child !== summary)} />
        </GithubDetails>
      );
    }
    if (depth !== undefined) {
      return (
        <Text key={key} className={`select-auto ${headingClass(depth)}`}>
          <GithubInlines nodes={children} />
        </Text>
      );
    }
    if (tag === "hr") {
      return <Separator key={key} className={markdownSeparatorClass} />;
    }
    if (tag === "ul" || tag === "ol") {
      const start = Number.parseInt(attrs.start ?? "1", 10);
      return renderList({
        key,
        ordered: tag === "ol",
        start: Number.isNaN(start) ? 1 : start,
        items: elementItems(node),
      });
    }
    if (tag === "pre") {
      return (
        <CopyableCodeBlock
          key={key}
          size="sm"
          text={textOf(children).replace(/^\n+|\n+$/g, "")}
        />
      );
    }
    if (tag === "blockquote") {
      return (
        <MarkdownQuote key={key}>
          <GithubBlocks nodes={children} />
        </MarkdownQuote>
      );
    }
    if (tag === "tr") {
      return (
        <View key={key} className="flex-row gap-xs">
          <GithubBlocks nodes={children} />
        </View>
      );
    }
    return (
      <View
        key={key}
        className={
          tag === "td" || tag === "th" ? "min-w-0 flex-1 gap-xs" : "gap-xs"
        }
      >
        <GithubBlocks nodes={children} />
      </View>
    );
  };

  nodes.forEach((node, index) => {
    const key = `${node.type}-${String(index)}`;

    if (isInlineNode(node)) {
      run.push(node);
      return;
    }
    flush();

    switch (node.type) {
      case "paragraph":
        rendered.push(<GithubRun key={key} nodes={node.children} />);
        break;
      case "heading":
        rendered.push(
          <Text key={key} className={`select-auto ${headingClass(node.depth)}`}>
            <GithubInlines nodes={node.children} />
          </Text>,
        );
        break;
      case "code":
        rendered.push(<GithubCode key={key} node={node} />);
        break;
      case "list":
        rendered.push(
          renderList({
            key,
            ordered: node.ordered,
            start: node.start ?? 1,
            items: node.items,
          }),
        );
        break;
      case "table":
        rendered.push(
          <GithubTable key={key} header={node.header} rows={node.rows} />,
        );
        break;
      case "blockquote":
      case "callout":
        rendered.push(
          <MarkdownQuote key={key}>
            <GithubBlocks nodes={node.children} />
          </MarkdownQuote>,
        );
        break;
      case "thematicBreak":
        rendered.push(
          <Separator key={key} className={markdownSeparatorClass} />,
        );
        break;
      case "element":
        rendered.push(renderElement(node, key));
        break;
      case "text":
      case "inlineCode":
      case "strong":
      case "emphasis":
      case "strike":
      case "footnoteReference":
      case "link":
      case "image":
      case "break":
      default:
        break;
    }
  });
  flush();

  return rendered;
}

const errorText = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

function GithubMarkdown({
  text,
  onTaskToggle,
}: Pick<MarkdownTextProps, "onTaskToggle" | "text">): ReactNode {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const paired = useMemo(() => {
    try {
      return pairGithubHtml(parseMarkdown(text, { allowHtml: true }).children);
    } catch {
      return null;
    }
  }, [text]);

  if (paired === null) {
    return <Text className="select-auto text-sm">{text}</Text>;
  }

  // Boxes are pressable only when every marker in the source can be matched to
  // a task item of the tree; `toggleTask` refuses otherwise.
  const editable =
    onTaskToggle !== undefined &&
    paired.taskCount > 0 &&
    toggleTask(text, 0, paired.tasks) !== null;

  const toggle = (taskIndex: number): void => {
    const next = toggleTask(text, taskIndex, paired.tasks);
    if (next === null || onTaskToggle === undefined) return;
    setBusy(true);
    setError(null);
    onTaskToggle(next).then(
      () => {
        setBusy(false);
      },
      (error_: unknown) => {
        setError(errorText(error_));
        setBusy(false);
      },
    );
  };

  return (
    // oxlint-disable-next-line react/jsx-no-constructed-context-values -- built after the early return above, so no hook can hold it; its consumers are one message's task boxes
    <TaskToggleContext value={{ toggle: editable ? toggle : null, busy }}>
      <Box className="gap-xs">
        <GithubBlocks nodes={paired.children} />
        {error === null ? null : (
          <ErrorMessage size="sm" variant="flat">
            {error}
          </ErrorMessage>
        )}
      </Box>
    </TaskToggleContext>
  );
}

/**
 * Markdown rendered with alouette components, falling back to the source text.
 *
 * The fallback is the point: this is a *display* of something a model wrote,
 * and the format has no schema either. A parse that throws must cost the
 * formatting, never the message — the operator opened the screen to read what
 * the agent said.
 */
export interface MarkdownTextProps {
  text: string;
  /**
   * GitHub-flavoured rendering for a pull request's description and comments:
   * the HTML GitHub allows (`<details>`, `<sub>`, `<br>`…), `:shortcode:` emoji.
   * Off for an agent's transcript, which is not GitHub's markdown.
   */
  github?: boolean;
  /**
   * Makes task-list checkboxes pressable: called with the whole source, the
   * pressed box flipped, for the caller to save. Absent, they are read-only.
   */
  onTaskToggle?: (nextText: string) => Promise<void>;
}

function PlainMarkdown({ text }: Pick<MarkdownTextProps, "text">): ReactNode {
  const document = useMemo(() => {
    try {
      return parseMarkdown(text);
    } catch {
      return null;
    }
  }, [text]);

  if (document === null) {
    return <Text className="select-auto text-sm">{text}</Text>;
  }

  return (
    <Box className="gap-xs">
      <BlockNodes nodes={document.children} />
    </Box>
  );
}

/**
 * Memoized because a transcript renders one per message and grows with every
 * appended event: only the new message should be parsed and rendered.
 */
function MarkdownTextBase({
  text,
  github = false,
  onTaskToggle,
}: MarkdownTextProps): ReactNode {
  if (github) {
    return <GithubMarkdown text={text} onTaskToggle={onTaskToggle} />;
  }
  return <PlainMarkdown text={text} />;
}

export const MarkdownText = memo(MarkdownTextBase);
