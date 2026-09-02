import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";

import { initializeLoanApplication } from "./app.js";

const fixtureHtml = readFileSync(
  fileURLToPath(new URL("./index.html", import.meta.url)),
  "utf8"
);

const setupApplication = () => {
  const dom = new JSDOM(fixtureHtml, {
    url: "http://127.0.0.1:4173/index.html",
  });
  const { window } = dom;
  const { document } = window;

  window.HTMLElement.prototype.scrollIntoView = vi.fn();

  const submitLoanApplicationImpl = vi.fn().mockResolvedValue({
    ok: true,
    status: 201,
    json: async () => ({ confirmationId: "PL-TEST123" }),
  });

  const app = initializeLoanApplication({
    rootDocument: document,
    rootWindow: window,
    submitLoanApplicationImpl,
  });

  return { app, document, submitLoanApplicationImpl, window };
};

describe("loan application page", () => {
  it("checks consent when the consent copy is clicked", () => {
    const { document } = setupApplication();
    const checkbox = document.querySelector("#consent");
    const consentLabel = document.querySelector("#consent-label");

    expect(consentLabel.tagName).toBe("LABEL");
    expect(consentLabel.getAttribute("for")).toBe("consent");

    consentLabel.click();

    expect(checkbox.checked).toBe(true);
  });

  it("initializes a session before submitting the form", async () => {
    const { app, document, submitLoanApplicationImpl, window } = setupApplication();

    document.querySelector("#loan-purpose").value = "debt";
    document.querySelector("#first-name").value = "Jane";
    document.querySelector("#last-name").value = "Doe";
    document.querySelector("#email").value = "jane@example.com";
    document.querySelector("#phone").value = "5551234567";
    document.querySelector("#employment-status").value = "employed";
    document.querySelector("#annual-income").value = "85000";
    document.querySelector("#consent").checked = true;

    document
      .querySelector("#loan-form")
      .dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));

    await vi.waitFor(() => expect(submitLoanApplicationImpl).toHaveBeenCalledTimes(1));

    expect(app.appState.applicationSession.id).toMatch(/^loan-session-[a-z0-9]+$/);
    expect(submitLoanApplicationImpl).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationSessionId: app.appState.applicationSession.id,
        amount: 32500,
        purpose: "debt",
        term: 48,
        estimatedMonthlyPayment: "$805",
        applicant: {
          firstName: "Jane",
          lastName: "Doe",
          email: "jane@example.com",
          phone: "5551234567",
          employmentStatus: "employed",
          annualIncome: 85000,
        },
      })
    );
    expect(document.querySelector("#application-error").hidden).toBe(true);
    expect(document.querySelector("#application-success").hidden).toBe(false);
  });
});
