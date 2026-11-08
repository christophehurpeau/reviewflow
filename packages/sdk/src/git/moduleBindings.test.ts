import { describe, expect, it } from "vitest";
import {
  exportedBindings,
  exportedNames,
  importedBindings,
  moduleBindings,
  touchedExports,
} from "./moduleBindings.ts";

const lines = (...rows: string[]): string => rows.join("\n");

describe("exportedBindings", () => {
  it("lists every form of local export with the lines of its statement", () => {
    const source = lines(
      "// é, so offsets counted in bytes would be off",
      "export const a = 1;",
      "export function f() {",
      "  return 1;",
      "}",
      "export class C {}",
      "export type T = string;",
      "export interface I {}",
      "export enum E {}",
      "export const { k, l: [m] } = obj;",
      "const z = 1;",
      "export { z as renamed };",
      "export default function main() {}",
    );
    const { bindings, reExports } = exportedBindings("x.ts", source);
    expect(reExports).toEqual([]);
    expect(
      bindings.map(({ name, local, lines: range }) => [
        name,
        local,
        range.start,
        range.end,
      ]),
    ).toEqual([
      ["a", "a", 2, 2],
      ["f", "f", 3, 5],
      ["C", "C", 6, 6],
      ["T", "T", 7, 7],
      ["I", "I", 8, 8],
      ["E", "E", 9, 9],
      ["k", "k", 10, 10],
      ["m", "m", 10, 10],
      ["renamed", "z", 12, 12],
      ["default", "main", 13, 13],
    ]);
  });

  it("names a default export of an expression, and `x as default`", () => {
    expect(
      exportedBindings("x.ts", "export default 5;").bindings.map(
        ({ name, local }) => [name, local],
      ),
    ).toEqual([["default", null]]);
    expect(
      exportedNames(
        exportedBindings("x.ts", "const x = 1;\nexport { x as default };"),
      ),
    ).toEqual(["default"]);
  });

  it("returns the re-exports apart, with their renames", () => {
    const source = lines(
      'import { a as b, type T } from "./x";',
      'import * as ns from "./n";',
      'import d from "./d";',
      "export { b, ns, d as dd };",
      "export type { T };",
      'export { q as r } from "./q";',
      'export * from "./s";',
      'export * as t from "./t";',
      'export { default } from "./dd";',
      "export const own = 1;",
    );
    const { bindings, reExports } = exportedBindings("barrel.ts", source);
    expect(bindings.map(({ name }) => name)).toEqual(["own"]);
    expect(
      reExports.map(({ specifier, local, exported, lines: range }) => [
        specifier,
        local,
        exported,
        range.start,
      ]),
    ).toEqual([
      ["./x", "a", "b", 4],
      ["./x", "T", "T", 5],
      ["./d", "default", "dd", 4],
      ["./n", "*", "ns", 4],
      ["./q", "q", "r", 6],
      ["./s", "*", "*", 7],
      ["./t", "*", "t", 8],
      ["./dd", "default", "default", 9],
    ]);
  });

  it("exportedNames leaves `export *` out and counts a re-export once, by its new name", () => {
    const source = lines(
      'export * from "./s";',
      'export { q as r } from "./q";',
      "export const r = 1;",
    );
    expect(exportedNames(exportedBindings("x.ts", source))).toEqual(["r"]);
  });
});

describe("importedBindings", () => {
  it("lists the names per specifier, merging the statements naming it", () => {
    const source = lines(
      'import { a as b, c } from "./x";',
      'import type { T } from "./x";',
      'import d, * as ns from "./d";',
      'import "./side-effect";',
      'import def from "./def";',
      'import { named } from "./named";',
      "const lazy = () => import(`./lazy`);",
      // oxlint-disable-next-line @pob/no-useless-template-literal -- a string literal would trip no-template-curly-in-string
      `const dynamic = (n: string) => import(\`./\${n}\`);`,
      'export { re } from "./re";',
    );
    expect(importedBindings("x.ts", source)).toEqual([
      { specifier: "./x", names: ["a", "c", "T"] },
      { specifier: "./d", names: ["default", "*"] },
      { specifier: "./side-effect", names: ["*"] },
      { specifier: "./def", names: ["default"] },
      { specifier: "./named", names: ["named"] },
      { specifier: "./lazy", names: ["*"] },
    ]);
  });
});

describe("importedBindings of a barrel", () => {
  it("leaves out what is only passed on, whatever the import form", () => {
    const source = lines(
      'import { a, kept } from "./x";',
      'import d from "./d";',
      'import * as ns from "./n";',
      "export { a, d, ns };",
    );
    expect(importedBindings("barrel.ts", source)).toEqual([
      { specifier: "./x", names: ["kept"] },
    ]);
  });
});

describe("importedBindings of a file passing on and using the same import", () => {
  it("keeps the import used locally, and the re-export edge", () => {
    const source = lines(
      'import { Foo, Other } from "./foo";',
      "export { Foo, Other };",
      "export const make = () => new Foo();",
    );
    const { imports, reExports } = moduleBindings("barrel.ts", source);
    expect(imports).toEqual([{ specifier: "./foo", names: ["Foo"] }]);
    expect(
      reExports.map(({ specifier, local, exported }) => [
        specifier,
        local,
        exported,
      ]),
    ).toEqual([
      ["./foo", "Foo", "Foo"],
      ["./foo", "Other", "Other"],
    ]);
  });

  it("keeps the import used by a type or a default export", () => {
    const source = lines(
      'import { T, d } from "./foo";',
      "export { T, d };",
      "export default d;",
      "export const x: T = 1;",
    );
    expect(importedBindings("x.ts", source)).toEqual([
      { specifier: "./foo", names: ["T", "d"] },
    ]);
  });
});

describe("exportedBindings of an export list", () => {
  it("gives each name of a multi-line list its own lines", () => {
    const source = lines(
      "const a = 1;",
      "const b = 2;",
      "const c = 3;",
      "export {",
      "  a,",
      "  b as bb,",
      "  c,",
      "};",
      "export {",
      "  x,",
      "  y as yy,",
      '} from "./z";',
    );
    const { bindings, reExports } = exportedBindings("x.ts", source);
    expect(
      bindings.map(({ name, lines: range }) => [name, range.start, range.end]),
    ).toEqual([
      ["a", 5, 5],
      ["bb", 6, 6],
      ["c", 7, 7],
    ]);
    expect(
      reExports.map(({ exported, lines: range }) => [
        exported,
        range.start,
        range.end,
      ]),
    ).toEqual([
      ["x", 10, 10],
      ["yy", 11, 11],
    ]);
  });
});

describe("touchedExports", () => {
  const touched = (
    source: string,
    touchedLines: [number, number][],
    baseExports: string[] = [],
  ) =>
    touchedExports({
      path: "x.ts",
      source,
      touchedLines: touchedLines.map(([start, end]) => ({ start, end })),
      baseExports,
    });

  const source = lines(
    "const helper = () => 1;", // 1
    "const deep = () => helper();", // 2
    "export const viaHelper = () => deep();", // 3
    "export const direct = 1;", // 4
    "export function big() {", // 5
    "  return 2;", // 6
    "}", // 7
    "export const untouched = 3;", // 8
    "const z = 4;", // 9
    "export { z as zed };", // 10
    'export { q as r } from "./q";', // 11
  );

  it("touches the export whose declaration holds a touched line", () => {
    expect(touched(source, [[6, 6]])).toMatchObject({
      touched: ["big"],
      removed: [],
    });
  });

  it("touches the exports mentioning a touched helper, through another helper", () => {
    expect(touched(source, [[1, 1]]).touched).toEqual(["viaHelper"]);
    expect(touched(source, [[2, 2]]).touched).toEqual(["viaHelper"]);
  });

  it("touches an export declared elsewhere than its export statement", () => {
    expect(touched(source, [[9, 9]]).touched).toEqual(["zed"]);
    expect(touched(source, [[10, 10]]).touched).toEqual(["zed"]);
  });

  it("touches a re-export by its new name", () => {
    expect(touched(source, [[11, 11]]).touched).toEqual(["r"]);
  });

  it("does not touch an export whose lines are untouched", () => {
    expect(touched(source, [])).toMatchObject({ touched: [], removed: [] });
  });

  it("does not follow a mention of another export", () => {
    const exported = lines("export const a = 1;", "export const b = () => a;");
    expect(touched(exported, [[1, 1]]).touched).toEqual(["a"]);
  });

  it("does not count a property or member of the same name as a use of a helper", () => {
    const labels = lines(
      "const helper = 1;",
      "export const o = { helper: 2 };",
      "export const p = o.helper;",
    );
    expect(touched(labels, [[1, 1]]).touched).toEqual([]);
  });

  it("reports the names of the base no longer exported as removed", () => {
    expect(touched(source, [], ["direct", "gone", "r"])).toMatchObject({
      touched: [],
      removed: ["gone"],
    });
  });

  it("touches every export of a new file", () => {
    expect(
      touched("export const a = 1;\nexport const b = 2;", [[1, 2]]).touched,
    ).toEqual(["a", "b"]);
  });

  it("touches only the name of a multi-line export list whose line is touched", () => {
    const list = lines(
      "const a = 1;",
      "const b = 2;",
      "export {",
      "  a,",
      "  b,",
      "};",
      "export {",
      "  q,",
      "  r,",
      '} from "./q";',
    );
    expect(touched(list, [[5, 5]]).touched).toEqual(["b"]);
    expect(touched(list, [[4, 4]]).touched).toEqual(["a"]);
    expect(touched(list, [[9, 9]]).touched).toEqual(["r"]);
  });

  describe("export *", () => {
    const barrel = lines(
      'export * from "./a";',
      'export * from "./b";',
      'export * as ns from "./c";',
    );

    it("reports the `export *` a touched line sits on, by specifier", () => {
      expect(touched(barrel, [[2, 2]])).toMatchObject({
        touched: [],
        touchedStars: ["./b"],
      });
      expect(touched(barrel, [[3, 3]])).toMatchObject({
        touched: ["ns"],
        touchedStars: [],
      });
    });

    it("reports the `export *` of the base no longer there", () => {
      expect(
        touchedExports({
          path: "x.ts",
          source: 'export * from "./a";',
          touchedLines: [],
          baseExports: [],
          baseStars: ["./a", "./gone"],
        }),
      ).toMatchObject({ touchedStars: [], removedStars: ["./gone"] });
    });
  });
});
