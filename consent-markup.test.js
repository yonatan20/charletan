import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const htmlPath = fileURLToPath(new URL("./index.html", import.meta.url));
const html = readFileSync(htmlPath, "utf8");

describe("consent markup", () => {
  it("associates the consent copy with the checkbox via a label", () => {
    expect(html).toMatch(/<input id="consent" name="consent" type="checkbox" required \/>/);
    expect(html).toMatch(/<label for="consent" class="consent-label">/);
  });
});
