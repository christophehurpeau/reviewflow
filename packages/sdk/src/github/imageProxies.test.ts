import { describe, expect, it } from "vitest";
import { imageProxiesOf, mergeImageProxies } from "./imageProxies.ts";

const camo =
  "https://camo.githubusercontent.com/4f0c/68747470733a2f2f782e746573742f612e706e67";

describe("imageProxiesOf", () => {
  it("maps the url the markdown wrote to the one GitHub serves", () => {
    const html = `<p><a target="_blank" rel="noopener noreferrer nofollow" href="${camo}"><img src="${camo}" alt="shot" data-canonical-src="https://x.test/a.png?w=1&amp;h=2" style="max-width: 100%;"></a></p>`;

    expect(imageProxiesOf(html)).toEqual({
      "https://x.test/a.png?w=1&h=2": camo,
    });
  });

  it("leaves out an image GitHub serves itself, and reads nothing from no html", () => {
    expect(
      imageProxiesOf(
        '<img src="https://github.com/user-attachments/assets/1" alt="a">',
      ),
    ).toEqual({});
    expect(imageProxiesOf(null)).toEqual({});
  });

  it("merges the bodies of a part", () => {
    expect(
      mergeImageProxies([
        `<img src="${camo}" data-canonical-src="https://x.test/a.png">`,
        undefined,
        `<img data-canonical-src="https://x.test/b.png" src="${camo}2">`,
      ]),
    ).toEqual({
      "https://x.test/a.png": camo,
      "https://x.test/b.png": `${camo}2`,
    });
  });
});
