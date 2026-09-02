import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const indexHtml = readFileSync(new URL("./index.html", import.meta.url), "utf8");

describe("application markup accessibility", () => {
  it("keeps the consent checkbox wrapped by a real label", () => {
    expect(indexHtml).toContain('<label class="consent-row" for="consent">');
    expect(indexHtml).toContain('<input id="consent" name="consent" type="checkbox" required />');
  });

  it("ships minimum target-size fallback styles in the document head", () => {
    expect(indexHtml).toContain(".nav-links a,");
    expect(indexHtml).toContain("input:not([type=\"range\"]),");
    expect(indexHtml).toContain("#consent");
    expect(indexHtml).toContain("min-height: 44px;");
    expect(indexHtml).toContain("inline-size: 24px;");
  });
});
