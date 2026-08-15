import { describe, expect, it, vi } from "vitest";
import type {
  MongoStores,
  OrgTeamEmbed,
  UserDmSettings,
} from "reviewflow-core";
import { defaultDmSettings } from "reviewflow-core";
import { setDmSetting, setTeamSilenced } from "./updateUserDmSettings.ts";

const ref = { orgId: 1, userId: 42 };

const createExisting = (
  overrides: Partial<UserDmSettings> = {},
): UserDmSettings => ({
  _id: "1_42",
  orgId: 1,
  userId: 42,
  settings: { ...defaultDmSettings },
  silentTeams: [],
  created: new Date(),
  updated: new Date(),
  ...overrides,
});

interface MockedStores {
  mongoStores: MongoStores;
  insertOne: ReturnType<typeof vi.fn>;
  partialUpdateOne: ReturnType<typeof vi.fn>;
}

const createStores = (existing: UserDmSettings | undefined): MockedStores => {
  const insertOne = vi.fn((object: Partial<UserDmSettings>) =>
    Promise.resolve({ ...object, created: new Date(), updated: new Date() }),
  );
  const partialUpdateOne = vi.fn(
    (object: UserDmSettings, update: Record<string, any>) =>
      Promise.resolve({ ...object, ...update.$set }),
  );

  const mongoStores: any = {
    userDmSettings: {
      findOne: () => Promise.resolve(existing),
      insertOne,
      partialUpdateOne,
    },
  };

  return { mongoStores, insertOne, partialUpdateOne };
};

describe("setDmSetting", () => {
  it("creates the document on the first change", async () => {
    const { mongoStores, insertOne } = createStores(undefined);

    await setDmSetting(mongoStores, ref, "pr-review", false);

    expect(insertOne).toHaveBeenCalledWith(
      expect.objectContaining({ _id: "1_42", orgId: 1, userId: 42 }),
    );
  });

  it("only changes the requested setting", async () => {
    const { mongoStores, partialUpdateOne } = createStores(createExisting());

    await setDmSetting(mongoStores, ref, "pr-review", false);

    expect(partialUpdateOne).toHaveBeenCalledWith(expect.anything(), {
      $set: { settings: { ...defaultDmSettings, "pr-review": false } },
    });
  });

  it("keeps the other settings untouched", async () => {
    const { mongoStores, partialUpdateOne } = createStores(
      createExisting({
        settings: { ...defaultDmSettings, "pr-comment": false },
      }),
    );

    await setDmSetting(mongoStores, ref, "pr-review", false);

    expect(partialUpdateOne).toHaveBeenCalledWith(expect.anything(), {
      $set: {
        settings: {
          ...defaultDmSettings,
          "pr-comment": false,
          "pr-review": false,
        },
      },
    });
  });
});

describe("setTeamSilenced", () => {
  const team: OrgTeamEmbed = { id: 9, name: "dev", slug: "dev" };

  it("pushes the team when silencing it", async () => {
    const { mongoStores, partialUpdateOne } = createStores(createExisting());

    await setTeamSilenced(mongoStores, ref, team, true);

    expect(partialUpdateOne).toHaveBeenCalledWith(expect.anything(), {
      $push: { silentTeams: team },
    });
  });

  it("pulls the team by id when unsilencing it", async () => {
    const { mongoStores, partialUpdateOne } = createStores(
      createExisting({ silentTeams: [team] }),
    );

    await setTeamSilenced(mongoStores, ref, team, false);

    expect(partialUpdateOne).toHaveBeenCalledWith(expect.anything(), {
      $pull: { silentTeams: { id: 9 } },
    });
  });
});
