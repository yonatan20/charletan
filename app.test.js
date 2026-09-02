import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";

const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");

describe("loan application consent row", () => {
  it("toggles the consent checkbox when the consent copy is clicked", () => {
    const dom = new JSDOM(html);
    const { document } = dom.window;
    const checkbox = document.querySelector("#consent");
    const consentLabel = document.querySelector('label[for="consent"]');

    expect(checkbox).not.toBeNull();
    expect(consentLabel).not.toBeNull();
    expect(checkbox.checked).toBe(false);

    consentLabel.click();

    expect(checkbox.checked).toBe(true);
  });
});
