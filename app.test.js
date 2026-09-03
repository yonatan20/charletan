// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("./index.html", `file://${process.cwd()}/`), "utf8");

const loadApplication = async () => {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  document.head.innerHTML = parsed.head.innerHTML;
  document.body.innerHTML = parsed.body.innerHTML;

  HTMLElement.prototype.scrollIntoView = vi.fn();
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    })
  );

  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});

  vi.resetModules();
  await import("./app.js");
};

describe("loan application UI", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await loadApplication();
  });

  it("lets applicants toggle consent by clicking the consent copy", () => {
    const consent = document.querySelector("#consent");
    const consentLabel = document.querySelector("#consent-label");

    consentLabel.click();

    expect(consent.checked).toBe(true);
  });

  it("submits a valid application through the demo transport", async () => {
    document.querySelector("#loan-purpose").value = "debt";
    document.querySelector("#first-name").value = "Jane";
    document.querySelector("#last-name").value = "Doe";
    document.querySelector("#email").value = "jane@example.com";
    document.querySelector("#phone").value = "5551234567";
    document.querySelector("#employment-status").value = "employed";
    document.querySelector("#annual-income").value = "85000";
    document.querySelector("#consent-label").click();

    document.querySelector("#loan-form").dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true })
    );

    await vi.waitFor(() => {
      expect(document.querySelector("#application-success").hidden).toBe(false);
    });

    expect(document.querySelector("#application-error").hidden).toBe(true);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
