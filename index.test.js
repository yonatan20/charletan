import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("consent control markup", () => {
  it("associates the consent copy with the checkbox through a real label", () => {
    const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");

    expect(html).toContain('<input id="consent" name="consent" type="checkbox" required />');
    expect(html).toContain('<label for="consent" id="consent-label" class="consent-label">');
  });
});
