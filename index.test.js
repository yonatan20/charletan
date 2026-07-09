import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

describe("consent checkbox markup", () => {
  it("associates the consent copy with the checkbox through a label", () => {
    const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");

    expect(html).toMatch(/<input id="consent" name="consent" type="checkbox" required \/>/);
    expect(html).toMatch(/<label for="consent" class="consent-label">/);
    expect(html).not.toMatch(/id="consent-label"/);
  });
});
