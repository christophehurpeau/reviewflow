import { describe, expect, it } from "vitest";
import elaxEnergieConfig from "./Elax-Energie.ts";

const templateUrl =
  "https://github.com/Elax-Energie/aquastats/blob/main/.github/pull_request_template.md";

const createDataImpactStatusInfo = (
  body: string,
  repositoryName = "aquastats",
) => {
  const rule = elaxEnergieConfig.parsePR?.body?.find(
    ({ status }) => status === "data-impact",
  );
  if (!rule) throw new Error("data-impact rule not found");
  return rule.createStatusInfo(
    rule.regExp.exec(body),
    { title: "feat(api): something [no ticket]" },
    false,
    repositoryName,
  );
};

const createBody = (dataImpact: string) => `### Context

Why.

### Solution

How.

### Data impact

${dataImpact}

<!-- Uncomment this if you need a human/manual testing plan
### Testing plan
- [ ] Test this
-->
`;

describe("parsePR.body data-impact", () => {
  it("succeeds on the untouched template section", () => {
    expect(
      createDataImpactStatusInfo(
        createBody(`None

<!-- Replace "None" when this PR, for data consumers:
- renames, removes or retypes an existing Mongo field;
Create a page in https://app.notion.com/p/elaxenergie/402d75d1baf5807baf17c083611045ae with its PR. Then paste its link and those lines here, or "Announcement not created":
[Annonce Notion](<url>)
-->`),
      ),
    ).toEqual({ type: "success", title: "✓ Data impact: none", summary: "" });
  });

  it("succeeds on None followed by an explanation or a footer", () => {
    expect(
      createDataImpactStatusInfo(
        createBody(
          "None. The scripts write to staging only, and the Valkey set is new.",
        ),
      ),
    ).toMatchObject({ type: "success", title: "✓ Data impact: none" });
    expect(
      createDataImpactStatusInfo(`### Data impact

None

🤖 Generated with [Claude Code](https://claude.com/claude-code)`),
    ).toMatchObject({ type: "success", title: "✓ Data impact: none" });
  });

  it("succeeds with the link of the announcement page", () => {
    expect(
      createDataImpactStatusInfo(
        createBody(`[Annonce Notion](https://app.notion.com/p/408d75d1baf58132a01dd31c1b7be530)
Champs touchés : demand_response.powerValorizedInMW
Déclencheur : un champ change de sens`),
      ),
    ).toEqual({
      type: "success",
      inBody: true,
      title: "✓ Data impact announced",
      summary:
        "[Data impact](https://app.notion.com/p/408d75d1baf58132a01dd31c1b7be530)",
      url: "https://app.notion.com/p/408d75d1baf58132a01dd31c1b7be530",
    });
  });

  it("accepts a slugged page url carrying a dashed page id", () => {
    expect(
      createDataImpactStatusInfo(
        createBody(
          "Announced in https://www.notion.so/elaxenergie/Backfill-408d75d1-baf5-8132-a01d-d31c1b7be530?pvs=4",
        ),
      ),
    ).toMatchObject({
      type: "success",
      url: "https://www.notion.so/elaxenergie/Backfill-408d75d1-baf5-8132-a01d-d31c1b7be530?pvs=4",
    });
  });

  it("fails when the section is missing", () => {
    expect(
      createDataImpactStatusInfo("### Context\n\nWhy.\n\n### Solution\n\nHow."),
    ).toEqual({
      type: "failure",
      inBody: true,
      title: "Data impact section missing",
      summary:
        "The PR body should have the ### Data impact section of the pull request template",
      url: templateUrl,
    });
  });

  it("fails when the section only holds the template comment", () => {
    expect(
      createDataImpactStatusInfo(
        createBody('<!-- Replace "None" when this PR, for data consumers -->'),
      ),
    ).toMatchObject({
      type: "failure",
      title: "Data impact section is empty",
    });
  });

  it("fails when the announcement was not created", () => {
    expect(
      createDataImpactStatusInfo(
        createBody(`Announcement not created
Champs touchés : aoe_submissions.averagePowerMW
Déclencheur : réécriture de données passées (backfill)`),
      ),
    ).toMatchObject({
      type: "failure",
      title: "Data impact announcement not created",
      url: templateUrl,
    });
  });

  it("fails when the impact is described without a page link", () => {
    expect(
      createDataImpactStatusInfo(
        createBody(
          "New optional `devices.upcomingFleet` field, journalled in `attribute_histories`.",
        ),
      ),
    ).toMatchObject({
      type: "failure",
      title: "Data impact announced without its Notion page link",
    });
  });

  it("does not take the template placeholder nor the database link for the page", () => {
    expect(
      createDataImpactStatusInfo(
        createBody(`[Annonce Notion](<url>)
See https://app.notion.com/p/elaxenergie/402d75d1baf5807baf17c083611045ae`),
      ),
    ).toMatchObject({
      type: "failure",
      title: "Data impact announced without its Notion page link",
    });
  });

  it("does not read a page link of the next section", () => {
    expect(
      createDataImpactStatusInfo(`### Data impact

Renames devices.fleet

### Testing plan

- [ ] Check https://app.notion.com/p/408d75d1baf58132a01dd31c1b7be530`),
    ).toMatchObject({
      type: "failure",
      title: "Data impact announced without its Notion page link",
    });
  });

  it("reads indented headings and windows line endings", () => {
    expect(
      createDataImpactStatusInfo(
        "  ### Context\r\n\r\n  Why.\r\n\r\n  ### Data impact\r\n  \r\n  None  \r\n",
      ),
    ).toMatchObject({ type: "success", title: "✓ Data impact: none" });
  });

  it("checks only the aquastats repository", () => {
    expect(
      createDataImpactStatusInfo("No template here.", "elax-dagster"),
    ).toBeNull();
  });
});
