import { parseSync } from "oxc-parser";
import type { ParseResult, StaticExportEntry } from "oxc-parser";

/** Lines of a source, 1-based and inclusive. */
export interface LineRange {
  start: number;
  end: number;
}

export interface ExportedBinding {
  /** `default` for a default export */
  name: string;
  /** the local name it exports, null for an expression (`export default 5`) */
  local: string | null;
  /** the export statement; for `export { x }`, that line, not where `x` is declared */
  lines: LineRange;
}

/**
 * A module passing names of another one on: `export { x as y } from`
 * (`local` x, `exported` y), `export * from` (both `*`), `export * as ns from`
 * (`local` `*`, `exported` ns), and the barrel form `import { a } from "./x";
 * export { a }`.
 */
export interface ReExport {
  specifier: string;
  /** the name in the other module, `*` for all of them */
  local: string;
  /** the name given to it here, `*` when every name keeps its own */
  exported: string;
  lines: LineRange;
}

export interface ExportedBindings {
  bindings: ExportedBinding[];
  reExports: ReExport[];
}

export interface ImportedBinding {
  specifier: string;
  /** names in the other module, `default` included; `*` for the whole module */
  names: string[];
}

const stringLiteral = /^(["'`])(.*)\1$/s;

const lineStartsOf = (source: string): number[] => {
  const starts = [0];
  for (let index = source.indexOf("\n"); index !== -1;) {
    starts.push(index + 1);
    index = source.indexOf("\n", index + 1);
  }
  return starts;
};

/** The 1-based line holding the offset: the last line start at or before it. */
const lineOf = (starts: readonly number[], offset: number): number => {
  let low = 0;
  let high = starts.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (starts[middle]! <= offset) low = middle;
    else high = middle - 1;
  }
  return low + 1;
};

const rangeOf = (
  starts: readonly number[],
  { start, end }: { start: number; end: number },
): LineRange => ({
  start: lineOf(starts, start),
  end: lineOf(starts, Math.max(start, end - 1)),
});

const overlaps = (left: LineRange, right: LineRange): boolean =>
  left.start <= right.end && right.start <= left.end;

interface NameOf {
  kind: unknown;
  name: string | null;
}

const kindOf = ({ kind }: NameOf): string => String(kind);

/** The name of an entry; `default` for the `export default` and the `import x` forms. */
const nameOf = (entry: NameOf): string | null =>
  kindOf(entry) === "Default" ? "default" : entry.name;

interface Parsed {
  result: ParseResult;
  starts: number[];
}

const parse = (path: string, source: string): Parsed => ({
  result: parseSync(path, source),
  starts: lineStartsOf(source),
});

interface ImportedName {
  specifier: string;
  imported: string;
}

const importedNames = ({ result }: Parsed): Map<string, ImportedName> => {
  const names = new Map<string, ImportedName>();
  for (const { moduleRequest, entries } of result.module.staticImports) {
    for (const { importName, localName } of entries) {
      names.set(localName.value, {
        specifier: moduleRequest.value,
        imported:
          kindOf(importName) === "NamespaceObject"
            ? "*"
            : (nameOf(importName) ?? "*"),
      });
    }
  }
  return names;
};

interface MatchedImport {
  /** the name in the other module */
  name: string;
  /** the local binding of the import it is passed on from */
  local: string | null;
}

/**
 * The import a barrel-form re-export (`import d from "./d"; export { d }`)
 * passes on. For a default import the parser reports the local name as the
 * imported one, where the module's export is `default`.
 */
const matchImport = (
  { result }: Parsed,
  { importName, moduleRequest }: StaticExportEntry,
): MatchedImport => {
  const name = nameOf(importName) ?? "*";
  const statement = result.module.staticImports.find(
    ({ moduleRequest: request }) => request.start === moduleRequest?.start,
  );
  const entries = statement?.entries ?? [];
  const asDefault = entries.find(
    (entry) =>
      kindOf(entry.importName) === "Default" && entry.localName.value === name,
  );
  if (asDefault !== undefined) {
    return { name: "default", local: asDefault.localName.value };
  }
  const named = entries.find((entry) => entry.importName.name === name);
  return { name, local: named?.localName.value ?? null };
};

interface AstNode {
  type: string;
  start: number;
  end: number;
  [key: string]: unknown;
}

const isNode = (value: unknown): value is AstNode =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { type?: unknown }).type === "string";

/** `export { a }`, `export { a } from "./x"`: no declaration of its own. */
const isExportList = (node: AstNode): boolean =>
  node.type === "ExportNamedDeclaration" && node.declaration === null;

/** The children whose identifier is a label, not a use of a name. */
const labelKeys: Readonly<Record<string, string>> = {
  MemberExpression: "property",
  Property: "key",
  PropertyDefinition: "key",
  MethodDefinition: "key",
  TSPropertySignature: "key",
  TSMethodSignature: "key",
  TSQualifiedName: "right",
  JSXMemberExpression: "property",
  JSXAttribute: "name",
};

/**
 * Every name a subtree mentions, shadowing ignored: a local variable named
 * like a helper counts as a use of it, so what is reported is a superset.
 */
const collectNames = (root: unknown, names: Set<string>): void => {
  const stack: unknown[] = [root];
  while (stack.length > 0) {
    const value = stack.pop();
    if (Array.isArray(value)) {
      stack.push(...(value as unknown[]));
      continue;
    }
    if (!isNode(value)) continue;
    if (value.type === "Identifier" || value.type === "JSXIdentifier") {
      if (typeof value.name === "string") names.add(value.name);
      stack.push(value.typeAnnotation);
      continue;
    }
    const labelKey = labelKeys[value.type];
    for (const [key, child] of Object.entries(value)) {
      if (key === labelKey && value.computed !== true) continue;
      if (typeof child === "object" && child !== null) stack.push(child);
    }
  }
};

/**
 * Every name mentioned outside the imports and the export statements that
 * only list names (`export { a }`, `export { a } from`, `export *`): what the
 * file uses itself.
 */
const namesUsedLocally = ({ result }: Parsed): Set<string> => {
  const names = new Set<string>();
  for (const node of result.program.body as unknown as AstNode[]) {
    const isListing =
      node.type === "ImportDeclaration" ||
      node.type === "ExportAllDeclaration" ||
      isExportList(node);
    if (!isListing) collectNames(node, names);
  }
  return names;
};

interface Bindings extends ExportedBindings {
  /** local bindings of imports that are only passed on by a re-export */
  passedOn: Set<string>;
}

const readBindings = (parsed: Parsed): Bindings => {
  const { result, starts } = parsed;
  const imported = importedNames(parsed);
  const bindings: ExportedBinding[] = [];
  const reExports: ReExport[] = [];
  const passedOn = new Set<string>();
  for (const { start, end, entries } of result.module.staticExports) {
    for (const entry of entries) {
      const exported = nameOf(entry.exportName);
      const inStatement =
        entry.exportName.start === null ||
        (entry.exportName.start >= start && entry.exportName.start < end);
      const isListed = !inStatement || (entries.length > 1 && entry.end < end);
      const lines = rangeOf(
        starts,
        isListed ? { start: entry.start, end: entry.end } : { start, end },
      );
      const importKind = kindOf(entry.importName);
      if (entry.moduleRequest !== null && importKind !== "None") {
        const { value: specifier } = entry.moduleRequest;
        if (importKind === "AllButDefault") {
          reExports.push({ specifier, local: "*", exported: "*", lines });
        } else if (exported !== null) {
          const matched = matchImport(parsed, entry);
          if (matched.local !== null && !inStatement) {
            passedOn.add(matched.local);
          }
          reExports.push({
            specifier,
            local: importKind === "All" ? "*" : matched.name,
            exported,
            lines,
          });
        }
        continue;
      }
      if (exported === null) continue;
      const local = entry.localName.name;
      const viaImport = local === null ? undefined : imported.get(local);
      if (viaImport === undefined) {
        bindings.push({ name: exported, local, lines });
      } else {
        passedOn.add(local!);
        reExports.push({
          specifier: viaImport.specifier,
          local: viaImport.imported,
          exported,
          lines,
        });
      }
    }
  }
  return { bindings, reExports, passedOn };
};

/**
 * What a module exports: its own declarations, apart from what it passes on
 * from other modules (`reExports`), which are edges to follow, not declarations.
 * `export *` carries no name of its own. A syntax error yields whatever was
 * parsed before it.
 */
export const exportedBindings = (
  path: string,
  source: string,
): ExportedBindings => {
  const { bindings, reExports } = readBindings(parse(path, source));
  return { bindings, reExports };
};

/** The specifiers of the `export *` of a module. */
export const starSpecifiers = (reExports: readonly ReExport[]): string[] =>
  reExports
    .filter(({ local, exported }) => local === "*" && exported === "*")
    .map(({ specifier }) => specifier);

/** Every name a module exports, its re-exports by their new name; `export *` carries none. */
export const exportedNames = ({
  bindings,
  reExports,
}: ExportedBindings): string[] => [
  ...new Set([
    ...bindings.map(({ name }) => name),
    ...reExports.flatMap(({ exported }) =>
      exported === "*" ? [] : [exported],
    ),
  ]),
];

const importsOf = (
  parsed: Parsed,
  source: string,
  passedOn: ReadonlySet<string>,
): ImportedBinding[] => {
  const { result } = parsed;
  const { staticImports, dynamicImports } = result.module;
  const usedLocally = namesUsedLocally(parsed);
  const found: { start: number; specifier: string; names: string[] }[] = [
    ...staticImports.flatMap(({ start, moduleRequest, entries }) => {
      const used = entries.filter(
        ({ localName }) =>
          !passedOn.has(localName.value) || usedLocally.has(localName.value),
      );
      if (entries.length > 0 && used.length === 0) return [];
      const names =
        entries.length === 0
          ? ["*"]
          : used.map(({ importName }) =>
              kindOf(importName) === "NamespaceObject"
                ? "*"
                : (nameOf(importName) ?? "*"),
            );
      return [{ start, specifier: moduleRequest.value, names }];
    }),
    ...dynamicImports.flatMap(({ start, moduleRequest }) => {
      const literal = stringLiteral.exec(
        source.slice(moduleRequest.start, moduleRequest.end),
      );
      const specifier = literal?.[2];
      return specifier === undefined || specifier.includes("${")
        ? []
        : [{ start, specifier, names: ["*"] }];
    }),
  ];
  const bySpecifier = new Map<string, Set<string>>();
  for (const { specifier, names } of found.toSorted(
    (left, right) => left.start - right.start,
  )) {
    const merged = bySpecifier.get(specifier) ?? new Set<string>();
    for (const name of names) merged.add(name);
    bySpecifier.set(specifier, merged);
  }
  return [...bySpecifier].map(([specifier, names]) => ({
    specifier,
    names: [...names],
  }));
};

/**
 * What a module imports, per specifier, in source order: `import type`
 * included, a dynamic `import()` only when its argument is a plain string.
 * A namespace, a dynamic and a side-effect import use the whole module (`*`).
 * A re-export is not an import: see `exportedBindings`. Neither is an import
 * only passed on by `export { a }` (the barrel form); one the file also uses
 * outside its export lists stays an import. Uses are read by name, shadowing
 * ignored: a local variable named like the import counts as a use.
 */
export const importedBindings = (
  path: string,
  source: string,
): ImportedBinding[] => {
  const parsed = parse(path, source);
  return importsOf(parsed, source, readBindings(parsed).passedOn);
};

export interface ModuleBindings extends ExportedBindings {
  imports: ImportedBinding[];
}

/** `exportedBindings` and `importedBindings` of one parse. */
export const moduleBindings = (
  path: string,
  source: string,
): ModuleBindings => {
  const parsed = parse(path, source);
  const { bindings, reExports, passedOn } = readBindings(parsed);
  return { bindings, reExports, imports: importsOf(parsed, source, passedOn) };
};

/** The names a pattern binds: `a`, `{ a, b: [c] }`, `[a = 1, ...rest]`. */
const patternNames = (pattern: unknown, names: string[]): void => {
  if (!isNode(pattern)) return;
  switch (pattern.type) {
    case "Identifier":
      names.push(String(pattern.name));
      break;
    case "ObjectPattern":
      for (const property of pattern.properties as unknown[]) {
        if (isNode(property)) {
          patternNames(property.value ?? property.argument, names);
        }
      }
      break;
    case "ArrayPattern":
      for (const element of pattern.elements as unknown[]) {
        patternNames(element, names);
      }
      break;
    case "AssignmentPattern":
      patternNames(pattern.left, names);
      break;
    case "RestElement":
      patternNames(pattern.argument, names);
      break;
    default:
  }
};

const declaredNamesOf = (statement: AstNode): string[] => {
  const names: string[] = [];
  if (statement.type === "VariableDeclaration") {
    for (const declarator of statement.declarations as unknown[]) {
      if (isNode(declarator)) patternNames(declarator.id, names);
    }
  } else if (
    statement.type === "FunctionDeclaration" ||
    statement.type === "ClassDeclaration" ||
    statement.type.startsWith("TS")
  ) {
    patternNames(statement.id, names);
  }
  return names;
};

interface Statement {
  lines: LineRange;
  /** `isExportList`: its names have lines of their own */
  isList: boolean;
  /** declared by a statement that is not an export */
  declared: string[];
  /** every name the statement mentions */
  mentioned: Set<string>;
}

const statementsOf = ({ result, starts }: Parsed): Statement[] =>
  (result.program.body as unknown as AstNode[]).map((node) => {
    const mentioned = new Set<string>();
    collectNames(node, mentioned);
    return {
      lines: rangeOf(starts, node),
      isList: isExportList(node),
      declared: declaredNamesOf(node),
      mentioned,
    };
  });

export interface TouchedExportsParams {
  path: string;
  /** the file as it is after the change */
  source: string;
  /** the lines of `source` the change touches; a deletion touches the line it sits before */
  touchedLines: readonly LineRange[];
  /** the names the file exported before the change */
  baseExports: readonly string[];
  /** the specifiers of the `export *` the file had before the change */
  baseStars?: readonly string[];
}

export interface TouchedExports {
  /** exported now, whose declaration the change touches */
  touched: string[];
  /** exported before the change, not any more */
  removed: string[];
  /** the specifiers of the `export *` on a touched line: which names they pass on is told by the other module */
  touchedStars: string[];
  /** the specifiers of `baseStars` the file no longer has */
  removedStars: string[];
}

/**
 * The exports a change touches: those declared on a touched line; those
 * declared by a statement mentioning, directly or through another one, a
 * touched declaration that is not exported (a helper); a touched re-export
 * line's; and the names of `baseExports` no longer exported.
 *
 * Mentions are read by name, shadowing ignored: a superset of the real uses.
 * A helper reached through something built at runtime is not followed. An
 * `export *` touches no name here, as which names it passes on is told by the
 * other module: its specifier is returned in `touchedStars` or `removedStars`.
 */
export const touchedExports = ({
  path,
  source,
  touchedLines,
  baseExports,
  baseStars = [],
}: TouchedExportsParams): TouchedExports => {
  const parsed = parse(path, source);
  const { bindings, reExports } = readBindings(parsed);
  const statements = statementsOf(parsed);
  const isTouched = (lines: LineRange): boolean =>
    touchedLines.some((touched) => overlaps(touched, lines));

  const exportedLocals = new Set(
    bindings.flatMap(({ local }) => (local === null ? [] : [local])),
  );
  const helpers = statements.filter(
    ({ declared }) =>
      declared.length > 0 && !declared.some((name) => exportedLocals.has(name)),
  );
  const touchedHelperNames = new Set(
    helpers
      .filter(({ lines }) => isTouched(lines))
      .flatMap(({ declared }) => declared),
  );
  for (let grown = true; grown;) {
    grown = false;
    for (const { declared, mentioned } of helpers) {
      if (declared.every((name) => touchedHelperNames.has(name))) continue;
      if (![...touchedHelperNames].some((name) => mentioned.has(name))) {
        continue;
      }
      for (const name of declared) touchedHelperNames.add(name);
      grown = true;
    }
  }

  const isBindingTouched = ({ local, lines }: ExportedBinding): boolean => {
    const declaring = [
      ...statements.filter(
        (statement) => !statement.isList && overlaps(statement.lines, lines),
      ),
      ...(local === null
        ? []
        : statements.filter(({ declared }) => declared.includes(local))),
    ];
    return (
      isTouched(lines) ||
      declaring.some(
        ({ lines: declaringLines, mentioned }) =>
          isTouched(declaringLines) ||
          [...touchedHelperNames].some((name) => mentioned.has(name)),
      )
    );
  };

  const touched = new Set([
    ...bindings.filter(isBindingTouched).map(({ name }) => name),
    ...reExports
      .filter(({ exported, lines }) => exported !== "*" && isTouched(lines))
      .map(({ exported }) => exported),
  ]);
  const now = new Set(exportedNames({ bindings, reExports }));
  const stars = starSpecifiers(reExports);
  return {
    touched: [...touched],
    removed: baseExports.filter((name) => !now.has(name)),
    touchedStars: starSpecifiers(
      reExports.filter(({ lines }) => isTouched(lines)),
    ),
    removedStars: baseStars.filter((specifier) => !stars.includes(specifier)),
  };
};
