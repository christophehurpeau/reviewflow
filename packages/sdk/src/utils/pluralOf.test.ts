import { describe, expect, it } from "vitest";
import { pluralOf } from "./pluralOf.ts";

describe("pluralOf", () => {
  it("keeps the word for one", () => {
    expect(pluralOf(1, "file")).toBe("1 file");
  });

  it("adds an s for zero and many", () => {
    expect(pluralOf(0, "file")).toBe("0 files");
    expect(pluralOf(2, "unresolved thread")).toBe("2 unresolved threads");
  });

  it("uses an irregular plural when given", () => {
    expect(pluralOf(1, "person", "people")).toBe("1 person");
    expect(pluralOf(3, "person", "people")).toBe("3 people");
  });
});
