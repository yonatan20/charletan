import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("consent interaction markup", () => {
  it("associates the consent copy with the checkbox through a label", async () => {
    const html = await readFile(new URL("./index.html", import.meta.url), "utf8");

    expect(html).toMatch(/<label class="consent-label" for="consent">/);
    expect(html).not.toMatch(/id="consent-label"/);
  });
});

describe("consent interaction behavior", () => {
  it("does not keep the dead-click warning handler in app code", async () => {
    const script = await readFile(new URL("./app.js", import.meta.url), "utf8");

    expect(script).not.toContain("ConsentClickWarning");
    expect(script).not.toContain('querySelector("#consent-label")');
  });
});
