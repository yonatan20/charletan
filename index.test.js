import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("consent markup", () => {
  it("associates the consent copy with the checkbox through a real label", () => {
    const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");

    expect(html).toMatch(
      /<input id="consent" name="consent" type="checkbox" required \/>[\s\S]*<label for="consent" id="consent-label" class="consent-label">/
    );
  });
});
