import { describe, expect, it, vi } from "vitest";
import type { SlackSentMessage } from "reviewflow-core";
import type { AppContext } from "../../../context/AppContext.ts";
import type { RepoContext } from "../../../context/repoContext.ts";
import { voidTeamSlack } from "../../../context/slack/voidTeamSlack.ts";
import type { PullRequestWithDecentData } from "../utils/PullRequestData.ts";
import {
  markMergeConflictAsDone,
  syncMergeConflictSlackMessage,
} from "./mergeConflictSlackMessage.ts";

const owner = { id: 10, login: "owner", type: "User" };
const assignee = { id: 11, login: "assignee", type: "User" };

const createPullRequest = (
  overrides: Partial<PullRequestWithDecentData> = {},
): PullRequestWithDecentData =>
  ({
    id: 300,
    number: 30,
    html_url: "https://github.com/reviewflow/reviewflow-test/pull/30",
    closed_at: null,
    user: owner,
    assignees: [owner, assignee],
    base: { ref: "main" },
    ...overrides,
  }) as unknown as PullRequestWithDecentData;

const matches = (
  sentMessage: SlackSentMessage,
  criteria: Record<string, unknown>,
): boolean =>
  Object.entries(criteria).every(([key, value]) => {
    if (key === "isMarkedAsDone") return sentMessage.isMarkedAsDone !== true;
    if (key === "account.id") return sentMessage.account.id === value;
    if (key === "account.type") return sentMessage.account.type === value;
    return sentMessage[key as keyof SlackSentMessage] === value;
  });

const createContexts = () => {
  const sentMessages: SlackSentMessage[] = [];
  const slackSentMessages = {
    findAll: vi.fn((criteria: Record<string, unknown>) =>
      Promise.resolve(sentMessages.filter((m) => matches(m, criteria))),
    ),
    insertOne: vi.fn((message: SlackSentMessage) => {
      sentMessages.push(message);
      return Promise.resolve(message);
    }),
    partialUpdateMany: vi.fn(
      (
        criteria: Record<string, unknown>,
        { $set }: { $set: Record<string, unknown> },
      ) => {
        sentMessages
          .filter((m) => matches(m, criteria))
          .forEach((m) => {
            Object.entries($set).forEach(([key, value]) => {
              if (key === "message.text") m.message.text = value as string;
              else Object.assign(m, { [key]: value });
            });
          });
        return Promise.resolve();
      },
    ),
  };

  const slack = {
    ...voidTeamSlack(),
    mention: (login: string) => `@${login}`,
    postMessage: vi.fn((_category: string, user: { id: number }) =>
      Promise.resolve({ ts: `ts-${user.id}`, channel: "dm", user }),
    ),
    updateMessage: vi.fn(() => Promise.resolve(null)),
  };

  const appContext = {
    mongoStores: { slackSentMessages },
  } as unknown as AppContext;
  const repoContext = {
    slack,
    repoEmbed: { id: 2, name: "reviewflow-test" },
    accountEmbed: { id: 1, login: "reviewflow", type: "Organization" },
    repoFullName: "reviewflow/reviewflow-test",
    repoEmoji: undefined,
  } as unknown as RepoContext;

  return { appContext, repoContext, slack, sentMessages };
};

describe("syncMergeConflictSlackMessage", () => {
  it("messages the owner and the other assignees when the pull request conflicts", async () => {
    const { appContext, repoContext, slack, sentMessages } = createContexts();

    await syncMergeConflictSlackMessage(appContext, repoContext, {
      pullRequest: createPullRequest(),
      mergeable: "conflicting",
    });

    expect(slack.postMessage).toHaveBeenCalledTimes(2);
    expect(slack.postMessage).toHaveBeenCalledWith(
      "pr-merge-conflicts",
      owner,
      {
        text: ":warning: Merge conflict on your PR <https://github.com/reviewflow/reviewflow-test/pull/30|reviewflow/reviewflow-test#30> with `main`",
      },
    );
    expect(slack.postMessage).toHaveBeenCalledWith(
      "pr-merge-conflicts",
      assignee,
      {
        text: ":warning: Merge conflict on @owner's PR you're assigned to <https://github.com/reviewflow/reviewflow-test/pull/30|reviewflow/reviewflow-test#30> with `main`",
      },
    );
    expect(sentMessages).toEqual([
      expect.objectContaining({
        type: "pr-merge-conflicts",
        typeId: "2_300",
        messageId: "owner",
      }),
      expect.objectContaining({
        type: "pr-merge-conflicts",
        typeId: "2_300",
        messageId: "assignees",
      }),
    ]);
  });

  it("does not message twice while the conflict lasts", async () => {
    const { appContext, repoContext, slack } = createContexts();
    const options = {
      pullRequest: createPullRequest({ assignees: [] }),
      mergeable: "conflicting",
    } as const;

    await syncMergeConflictSlackMessage(appContext, repoContext, options);
    await syncMergeConflictSlackMessage(appContext, repoContext, options);

    expect(slack.postMessage).toHaveBeenCalledTimes(1);
    expect(slack.updateMessage).not.toHaveBeenCalled();
  });

  it("strikes the message through once the pull request is mergeable", async () => {
    const { appContext, repoContext, slack, sentMessages } = createContexts();
    const pullRequest = createPullRequest({ assignees: [] });

    await syncMergeConflictSlackMessage(appContext, repoContext, {
      pullRequest,
      mergeable: "conflicting",
    });
    const text = sentMessages[0]!.message.text;
    await syncMergeConflictSlackMessage(appContext, repoContext, {
      pullRequest,
      mergeable: "mergeable",
    });

    expect(slack.updateMessage).toHaveBeenCalledWith(owner, "ts-10", "dm", {
      text: `~${text}~`,
    });
    expect(sentMessages[0]!.isMarkedAsDone).toBe(true);
  });

  it("messages again when a resolved conflict comes back", async () => {
    const { appContext, repoContext, slack } = createContexts();
    const pullRequest = createPullRequest({ assignees: [] });

    for (const mergeable of [
      "conflicting",
      "mergeable",
      "conflicting",
    ] as const) {
      await syncMergeConflictSlackMessage(appContext, repoContext, {
        pullRequest,
        mergeable,
      });
    }

    expect(slack.postMessage).toHaveBeenCalledTimes(2);
  });

  it("neither messages nor strikes while github computes it", async () => {
    const { appContext, repoContext, slack } = createContexts();
    const pullRequest = createPullRequest({ assignees: [] });

    await syncMergeConflictSlackMessage(appContext, repoContext, {
      pullRequest,
      mergeable: "conflicting",
    });
    await syncMergeConflictSlackMessage(appContext, repoContext, {
      pullRequest,
      mergeable: "unknown",
    });

    expect(slack.postMessage).toHaveBeenCalledTimes(1);
    expect(slack.updateMessage).not.toHaveBeenCalled();
  });

  it("does not message about a closed pull request", async () => {
    const { appContext, repoContext, slack } = createContexts();

    await syncMergeConflictSlackMessage(appContext, repoContext, {
      pullRequest: createPullRequest({ closed_at: "2026-10-12T00:00:00Z" }),
      mergeable: "conflicting",
    });

    expect(slack.postMessage).not.toHaveBeenCalled();
  });
});

describe("markMergeConflictAsDone", () => {
  it("strikes the message through from the pull request id alone", async () => {
    const { appContext, repoContext, slack } = createContexts();

    await syncMergeConflictSlackMessage(appContext, repoContext, {
      pullRequest: createPullRequest({ assignees: [] }),
      mergeable: "conflicting",
    });
    await markMergeConflictAsDone(appContext, repoContext, 300);

    expect(slack.updateMessage).toHaveBeenCalledTimes(1);
  });
});
