import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";
import type { OrgMember, UserDmSettings } from "@reviewflow/core";
import type { TestMongoStores } from "@reviewflow/core/tests";
import { createTestMongoStores } from "@reviewflow/core/tests";
import type { OctokitPaginate, OctokitRestCompat } from "../../../octokit.ts";
import { syncTeams } from "./syncTeams.ts";

const org = { id: 1, login: "acme" };
const otherOrg = { id: 2, login: "other" };

interface GithubTeam {
  id: number;
  name: string;
  slug: string;
  description: string | null;
}

const octokitRest = {
  teams: { list: "teams.list" },
} as unknown as OctokitRestCompat;

const createOctokitPaginate = (teams: GithubTeam[]): OctokitPaginate =>
  ({
    *iterator() {
      yield { data: teams };
    },
  }) as unknown as OctokitPaginate;

const web = { id: 7, name: "Web", slug: "web" };
const api = { id: 8, name: "API", slug: "api" };

let stores: TestMongoStores;

beforeAll(async () => {
  stores = await createTestMongoStores();
});

afterAll(async () => {
  await stores.dispose();
});

beforeEach(async () => {
  await Promise.all([
    stores.orgTeams.deleteMany({}),
    stores.orgMembers.deleteMany({}),
    stores.userDmSettings.deleteMany({}),
  ]);
});

const insertMember = (
  memberOrg: { id: number; login: string },
  userId: number,
  teams: OrgMember["teams"],
): Promise<OrgMember> =>
  stores.orgMembers.insertOne({
    _id: `${memberOrg.id}_${userId}`,
    org: memberOrg,
    user: { id: userId, login: `user${userId}` },
    teams,
  });

const insertDmSettings = (
  userId: number,
  silentTeams: UserDmSettings["silentTeams"],
): Promise<UserDmSettings> =>
  stores.userDmSettings.insertOne({
    _id: `${org.id}_${userId}`,
    orgId: org.id,
    userId,
    // oxlint-disable-next-line typescript/consistent-type-assertions
    settings: {} as UserDmSettings["settings"],
    silentTeams,
  });

const findMemberTeams = async (key: string) => {
  const member = await stores.orgMembers.findByKey(key);
  return member?.teams;
};

const findSilentTeams = async (key: string) => {
  const dmSettings = await stores.userDmSettings.findByKey(key);
  return dmSettings?.silentTeams;
};

const runSyncTeams = (teams: GithubTeam[]) =>
  syncTeams(stores, octokitRest, createOctokitPaginate(teams), org);

describe("syncTeams", () => {
  test("renames the team embedded in members and dm settings", async () => {
    await insertMember(org, 10, [web, api]);
    await insertMember(otherOrg, 10, [web]);
    await insertDmSettings(10, [web]);

    await runSyncTeams([
      { ...web, name: "Frontend", slug: "frontend", description: null },
      { ...api, description: null },
    ]);

    const frontend = { id: web.id, name: "Frontend", slug: "frontend" };
    await expect(findMemberTeams("1_10")).resolves.toEqual([frontend, api]);
    await expect(findMemberTeams("2_10")).resolves.toEqual([web]);
    await expect(findSilentTeams("1_10")).resolves.toEqual([frontend]);
    await expect(stores.orgTeams.findByKey(web.id)).resolves.toMatchObject({
      slug: "frontend",
    });
  });

  test("removes a deleted team from members and dm settings", async () => {
    await insertMember(org, 10, [web, api]);
    await insertDmSettings(10, [web, api]);

    await runSyncTeams([{ ...api, description: null }]);

    await expect(findMemberTeams("1_10")).resolves.toEqual([api]);
    await expect(findSilentTeams("1_10")).resolves.toEqual([api]);
  });

  test("returns the embeds of the teams GitHub lists", async () => {
    await expect(
      runSyncTeams([
        { ...web, description: "web team" },
        { ...api, description: null },
      ]),
    ).resolves.toEqual([web, api]);
  });
});
