import { describe, expect, it, vi } from "vitest";
import type { HttpAnswer, HttpRequest } from "./transport.ts";
import {
  createGitHubTransport,
  interpretGraphql,
  restErrorMessage,
} from "./transport.ts";

describe("interpretGraphql", () => {
  it("keeps the data GitHub answered beside its errors", () => {
    expect(
      interpretGraphql({
        status: 200,
        body: JSON.stringify({
          data: { viewer: { login: "octocat" } },
          errors: [{ message: "Could not resolve to a Repository" }, {}],
        }),
      }),
    ).toEqual({
      data: { viewer: { login: "octocat" } },
      errors: [
        "Could not resolve to a Repository",
        "github returned an unnamed error",
      ],
    });
  });

  it("raises GitHub's message when no data came back", () => {
    expect(() =>
      interpretGraphql({
        status: 401,
        body: JSON.stringify({ message: "Bad credentials" }),
      }),
    ).toThrow("GitHub graphql failed (HTTP 401): Bad credentials");
  });

  it("raises an answer that is not json", () => {
    expect(() =>
      interpretGraphql({ status: 502, body: "Bad Gateway\n<html>" }),
    ).toThrow("GitHub graphql failed (HTTP 502): Bad Gateway");
  });

  it("keeps partial data on a non-2xx status, and raises it when data is null", () => {
    expect(
      interpretGraphql({
        status: 500,
        body: JSON.stringify({ data: { a: 1 }, errors: [{ message: "boom" }] }),
      }),
    ).toEqual({ data: { a: 1 }, errors: ["boom"] });
    expect(() =>
      interpretGraphql({
        status: 200,
        body: "not json",
      }),
    ).toThrow("GitHub graphql failed (HTTP 200): not json");
  });
});

describe("restErrorMessage", () => {
  it("joins the message and each detail", () => {
    expect(
      restErrorMessage({
        status: 422,
        body: JSON.stringify({
          message: "Validation Failed",
          errors: [
            "Reviews may only be requested from collaborators",
            { field: "head", code: "invalid" },
          ],
        }),
      }),
    ).toBe(
      "Validation Failed: Reviews may only be requested from collaborators: head invalid",
    );
  });

  it("names the status when the body says nothing", () => {
    expect(restErrorMessage({ status: 404, body: "" })).toBe("HTTP 404");
  });
});

describe("createGitHubTransport", () => {
  const transportAnswering = (answer: HttpAnswer) => {
    const send = vi.fn<(request: HttpRequest) => Promise<HttpAnswer>>(() =>
      Promise.resolve(answer),
    );
    return { send, transport: createGitHubTransport(send) };
  };

  it("posts a graphql query with its variables to the graphql path", async () => {
    const { send, transport } = transportAnswering({
      status: 200,
      body: JSON.stringify({ data: { ok: true } }),
    });

    const result = await transport.graphql("query { ok }", { id: 1 });

    expect(result).toEqual({ data: { ok: true }, errors: [] });
    expect(send).toHaveBeenCalledWith({
      method: "POST",
      path: "graphql",
      accept: "application/json",
      body: JSON.stringify({ query: "query { ok }", variables: { id: 1 } }),
    });
  });

  it("sends no variables key when there are none", async () => {
    const { send, transport } = transportAnswering({
      status: 200,
      body: JSON.stringify({ data: {} }),
    });

    await transport.graphql("query { ok }");

    expect(send.mock.calls[0]?.[0].body).toBe(
      JSON.stringify({ query: "query { ok }" }),
    );
  });

  it("returns a partial graphql answer rather than raising it", async () => {
    const { transport } = transportAnswering({
      status: 200,
      body: JSON.stringify({
        data: { visible: { id: "1" }, hidden: null },
        errors: [{ message: "Could not resolve to a Repository" }],
      }),
    });

    await expect(transport.graphql("query")).resolves.toEqual({
      data: { visible: { id: "1" }, hidden: null },
      errors: ["Could not resolve to a Repository"],
    });
  });

  it("raises a graphql failure with no data", async () => {
    const { transport } = transportAnswering({
      status: 401,
      body: JSON.stringify({ message: "Bad credentials" }),
    });

    await expect(transport.graphql("query")).rejects.toThrow(
      "GitHub graphql failed (HTTP 401): Bad credentials",
    );
  });

  it("serializes a rest write and parses its answer", async () => {
    const { send, transport } = transportAnswering({
      status: 201,
      body: JSON.stringify({ id: 7 }),
    });

    const result = await transport.rest({
      method: "POST",
      path: "repos/acme/app/issues/1/comments",
      body: { body: "hi" },
    });

    expect(result).toEqual({ id: 7 });
    expect(send).toHaveBeenCalledWith({
      method: "POST",
      path: "repos/acme/app/issues/1/comments",
      accept: "application/vnd.github+json",
      body: JSON.stringify({ body: "hi" }),
    });
  });

  it("answers null to a rest write with an empty or non-json body", async () => {
    const { send, transport } = transportAnswering({ status: 204, body: "" });

    await expect(
      transport.rest({ method: "DELETE", path: "repos/acme/app/x" }),
    ).resolves.toBeNull();
    expect(send.mock.calls[0]?.[0].body).toBeUndefined();
  });

  it("raises GitHub's message when a rest write is refused", async () => {
    const { transport } = transportAnswering({
      status: 422,
      body: JSON.stringify({
        message: "Validation Failed",
        errors: [{ field: "head", code: "invalid" }],
      }),
    });

    await expect(
      transport.rest({ method: "PUT", path: "repos/acme/app/pulls/1/merge" }),
    ).rejects.toThrow(
      "GitHub refused PUT repos/acme/app/pulls/1/merge: Validation Failed: head invalid",
    );
  });

  it("raises a status-only message when a refused write has an empty body", async () => {
    const { transport } = transportAnswering({ status: 500, body: "" });

    await expect(
      transport.rest({ method: "PATCH", path: "repos/acme/app/pulls/1" }),
    ).rejects.toThrow("GitHub refused PATCH repos/acme/app/pulls/1: HTTP 500");
  });

  it("reads text with the accept header it is given", async () => {
    const { send, transport } = transportAnswering({
      status: 200,
      body: "diff --git a/x b/x\n",
    });

    const text = await transport.text({
      path: "repos/acme/app/pulls/1",
      accept: "application/vnd.github.diff",
    });

    expect(text).toBe("diff --git a/x b/x\n");
    expect(send).toHaveBeenCalledWith({
      method: "GET",
      path: "repos/acme/app/pulls/1",
      accept: "application/vnd.github.diff",
      body: undefined,
    });
  });

  it("raises GitHub's message when a diff is too large to read (406)", async () => {
    const { transport } = transportAnswering({
      status: 406,
      body: JSON.stringify({
        message: "Sorry, the diff exceeded the maximum number of lines (20000)",
      }),
    });

    await expect(
      transport.text({
        path: "repos/acme/app/pulls/1",
        accept: "application/vnd.github.diff",
      }),
    ).rejects.toThrow(
      "GitHub refused GET repos/acme/app/pulls/1: Sorry, the diff exceeded the maximum number of lines (20000)",
    );
  });
});
