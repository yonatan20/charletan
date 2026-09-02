import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const html = readFileSync(join(__dirname, "index.html"), "utf8");

describe("loan application consent control", () => {
  it("binds the consent copy to the checkbox as a real label", () => {
    const dom = new JSDOM(html);
    const { document } = dom.window;
    const consentCheckbox = document.querySelector("#consent");
    const consentLabel = document.querySelector("#consent-label");

    expect(consentCheckbox?.tagName).toBe("INPUT");
    expect(consentLabel?.tagName).toBe("LABEL");
    expect(consentLabel?.getAttribute("for")).toBe("consent");
    expect(consentCheckbox?.labels).toHaveLength(1);
    expect(consentCheckbox?.labels?.[0]).toBe(consentLabel);
  });
});
