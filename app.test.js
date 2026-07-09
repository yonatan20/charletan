import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";

import { initializeLoanApplication } from "./app.js";
import { calculatePayment, formatCurrency, getAprForAmount } from "./loan-utils.js";

const buildTestDocument = () => {
  const dom = new JSDOM(`
    <!DOCTYPE html>
    <html lang="en">
      <body>
        <form id="loan-form" novalidate>
          <input id="loan-amount" type="range" min="5000" max="75000" step="500" value="32500" />
          <output id="loan-amount-output" for="loan-amount"></output>
          <select id="loan-purpose">
            <option value="">Choose a purpose</option>
            <option value="debt">Debt consolidation</option>
          </select>
          <input id="first-name" value="" />
          <input id="last-name" value="" />
          <input id="email" value="" />
          <input id="phone" value="" />
          <select id="employment-status">
            <option value="">Select status</option>
            <option value="employed">Employed full time</option>
          </select>
          <input id="annual-income" type="number" value="" />
          <input id="consent" type="checkbox" />
          <span id="consent-label"></span>
          <div id="application-error" hidden></div>
          <div id="application-success" hidden></div>
          <input type="radio" name="loanTerm" value="36" />
          <input type="radio" name="loanTerm" value="48" checked />
          <input type="radio" name="loanTerm" value="60" />
        </form>
        <dd id="summary-amount"></dd>
        <dd id="summary-apr"></dd>
        <dd id="summary-payment"></dd>
        <dd id="summary-term"></dd>
        <div id="readiness-card" class="readiness-card"></div>
      </body>
    </html>
  `);

  return dom;
};

describe("initializeLoanApplication", () => {
  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps updating the monthly payment after repeated amount changes", () => {
    const dom = buildTestDocument();
    const { document, Event } = dom.window;
    const loanAmount = document.querySelector("#loan-amount");
    const summaryPayment = document.querySelector("#summary-payment");
    const readinessCard = document.querySelector("#readiness-card");

    initializeLoanApplication(document, dom.window);

    for (const amount of ["10000", "20000", "30000", "40000", "75000"]) {
      loanAmount.value = amount;
      loanAmount.dispatchEvent(new Event("input", { bubbles: true }));
    }

    const expectedPayment = formatCurrency(
      calculatePayment(75000, getAprForAmount(75000), 48)
    );

    expect(summaryPayment.textContent).toBe(expectedPayment);
    expect(readinessCard.classList.contains("is-stale")).toBe(false);
    expect(console.warn).not.toHaveBeenCalledWith(
      "LoanEstimateWarning: monthly payment estimate stopped updating after amount change",
      expect.anything()
    );
  });
});
