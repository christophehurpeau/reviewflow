import { describe, expect, it } from "vitest";
import { selectPrOwners } from "./selectPrOwners.ts";

const alice = { id: 1, login: "alice" };
const bob = { id: 2, login: "bob" };

describe("selectPrOwners", () => {
  /** `autoAssignToCreator` makes this the shape of most pull requests */
  it("states a byline when the only assignee is the author", () => {
    expect(
      selectPrOwners(
        { creator: alice, assignees: [alice] },
        { currentUserLogin: "bob" },
      ),
    ).toEqual({ users: [alice], label: "by @alice" });
  });

  it("states both halves when the pull request is assigned away", () => {
    expect(
      selectPrOwners(
        { creator: alice, assignees: [bob] },
        { currentUserLogin: "carol" },
      ),
    ).toEqual({
      users: [alice, bob],
      label: "by @alice · assigned to @bob",
    });
  });

  it("names every assignee when the author is one of several", () => {
    expect(
      selectPrOwners(
        { creator: alice, assignees: [alice, bob] },
        { currentUserLogin: "carol" },
      ),
    ).toEqual({ users: [alice, bob], label: "assigned to @alice, @bob" });
  });

  it("falls back to the assignment when the author is unknown", () => {
    expect(
      selectPrOwners(
        { creator: undefined, assignees: [alice] },
        { currentUserLogin: "bob" },
      ),
    ).toEqual({ users: [alice], label: "assigned to @alice" });
  });

  it("names nobody when the viewer is the only person", () => {
    expect(
      selectPrOwners(
        { creator: alice, assignees: [alice] },
        { currentUserLogin: "alice" },
      ),
    ).toBeUndefined();
  });

  it("uses the self label for the viewer among others", () => {
    expect(
      selectPrOwners(
        { creator: alice, assignees: [bob] },
        { currentUserLogin: "bob", selfLabel: "_you_" },
      )?.label,
    ).toBe("by @alice · assigned to _you_");
  });
});
