import { describe, expect, test, vi } from "vitest";
import type { SlackSentMessage } from "reviewflow-core";
import type { AppContext } from "../../../../context/AppContext.ts";
import type { RepoContext } from "../../../../context/repoContext.ts";
import {
  markAsDoneSlackSentMessages,
  unmarkAsDoneSlackSentMessages,
} from "./slackUtils.ts";

const setup = (initial: { isMarkedAsDone?: boolean }) => {
  const stored = {
    type: "review-comment",
    typeId: 101,
    message: { text: "comment" },
    sentTo: [{ user: { id: "U1" }, ts: "ts1", channel: "C1" }],
    ...initial,
  } as unknown as SlackSentMessage;
  const updateMessage = vi.fn();
  const partialUpdateMany = vi.fn();
  const appContext = {
    mongoStores: {
      slackSentMessages: {
        findAll: () => Promise.resolve([stored]),
        partialUpdateMany,
      },
    },
  } as unknown as AppContext;
  const repoContext = {
    accountEmbed: { id: 1, type: "Organization" },
    slack: { updateMessage },
  } as unknown as RepoContext;
  const options = { type: "review-comment", typeId: 101 } as const;

  return { appContext, repoContext, options, updateMessage, partialUpdateMany };
};

describe("markAsDoneSlackSentMessages and unmarkAsDoneSlackSentMessages", () => {
  test("mark strikes the text", async () => {
    const {
      appContext,
      repoContext,
      options,
      updateMessage,
      partialUpdateMany,
    } = setup({});

    await markAsDoneSlackSentMessages(appContext, repoContext, options);

    expect(updateMessage).toHaveBeenCalledWith({ id: "U1" }, "ts1", "C1", {
      text: "~comment~",
    });
    expect(partialUpdateMany).toHaveBeenCalledWith(expect.anything(), {
      $set: { isMarkedAsDone: true },
    });
  });

  test("unmark restores the stored text", async () => {
    const {
      appContext,
      repoContext,
      options,
      updateMessage,
      partialUpdateMany,
    } = setup({ isMarkedAsDone: true });

    await unmarkAsDoneSlackSentMessages(appContext, repoContext, options);

    expect(updateMessage).toHaveBeenCalledWith({ id: "U1" }, "ts1", "C1", {
      text: "comment",
    });
    expect(partialUpdateMany).toHaveBeenCalledWith(expect.anything(), {
      $set: { isMarkedAsDone: false },
    });
  });

  test("unmark ignores a message that is not struck", async () => {
    const {
      appContext,
      repoContext,
      options,
      updateMessage,
      partialUpdateMany,
    } = setup({});

    await unmarkAsDoneSlackSentMessages(appContext, repoContext, options);

    expect(updateMessage).not.toHaveBeenCalled();
    expect(partialUpdateMany).not.toHaveBeenCalled();
  });
});
