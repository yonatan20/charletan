import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const indexHtml = readFileSync(join(currentDir, "index.html"), "utf8");

describe("loan application consent field", () => {
  it("associates the consent checkbox with an explicit label", () => {
    expect(indexHtml).toMatch(/<input id="consent" name="consent" type="checkbox" required \/>/);
    expect(indexHtml).toMatch(/<label for="consent" class="consent-label">/);
    expect(indexHtml).not.toMatch(/<span id="consent-label" class="consent-label">/);
  });
});
