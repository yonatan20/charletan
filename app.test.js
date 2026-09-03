import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { initLoanApplication } from "./app.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

const createDom = () => {
  const dom = new JSDOM(html, {
    url: "http://127.0.0.1:8000/index.html",
  });

  Object.defineProperty(dom.window.HTMLElement.prototype, "scrollIntoView", {
    value: vi.fn(),
    configurable: true,
  });

  return dom;
};

const fillValidApplication = (document) => {
  document.querySelector("#loan-purpose").value = "debt";
  document.querySelector("#first-name").value = "Jane";
  document.querySelector("#last-name").value = "Doe";
  document.querySelector("#email").value = "jane@example.com";
  document.querySelector("#phone").value = "5551234567";
  document.querySelector("#employment-status").value = "employed";
  document.querySelector("#annual-income").value = "85000";
};

describe("loan application page", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("toggles the consent checkbox when the consent copy is clicked", () => {
    const dom = createDom();
    initLoanApplication(dom.window.document);

    const consent = dom.window.document.querySelector("#consent");
    const consentLabel = dom.window.document.querySelector("#consent-label");

    expect(consent.checked).toBe(false);

    consentLabel.click();

    expect(consent.checked).toBe(true);
  });

  it("submits a valid application after the consent copy is clicked", async () => {
    const dom = createDom();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    initLoanApplication(dom.window.document);
    fillValidApplication(dom.window.document);

    dom.window.document.querySelector("#consent-label").click();
    dom.window.document.querySelector("#submit-application").click();

    await Promise.resolve();
    await Promise.resolve();

    expect(dom.window.document.querySelector("#application-error").hidden).toBe(true);
    expect(dom.window.document.querySelector("#application-success").hidden).toBe(false);
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
