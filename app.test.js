import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

describe("loan application markup", () => {
  it("associates the consent copy with the checkbox through a real label", () => {
    const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");

    expect(html).toMatch(
      /<input id="consent" name="consent" type="checkbox" required \/>[\s\S]*<label for="consent" class="consent-label">/
    );
  });
});
