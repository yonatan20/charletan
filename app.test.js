import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";

const buildTestDocument = () => `<!DOCTYPE html>
<html lang="en">
  <body>
    <form id="loan-form" novalidate>
      <input id="loan-amount" name="loanAmount" type="range" min="5000" max="75000" step="500" value="32500" />
      <output id="loan-amount-output" for="loan-amount">$32,500</output>
      <div id="summary-amount">$32,500</div>
      <div id="summary-payment">$804</div>
      <div id="summary-apr">8.74%</div>
      <div id="summary-term">48 months</div>
      <select id="loan-purpose" name="loanPurpose">
        <option value="">Choose a purpose</option>
        <option value="debt">Debt consolidation</option>
      </select>
      <span id="consent-label"></span>
      <div id="application-error" hidden></div>
      <div id="application-success" hidden></div>
      <div id="readiness-card" class="readiness-card is-stale"></div>
      <input type="radio" name="loanTerm" value="48" checked />
      <input id="first-name" value="Jane" />
      <input id="last-name" value="Doe" />
      <input id="email" value="jane@example.com" />
      <input id="phone" value="5551234567" />
      <select id="employment-status">
        <option value="employed" selected>Employed full time</option>
      </select>
      <input id="annual-income" value="85000" />
      <input id="consent" type="checkbox" checked />
    </form>
  </body>
</html>`;

describe("loan amount estimate updates", () => {
  let dom;

  beforeEach(() => {
    vi.resetModules();
    dom = new JSDOM(buildTestDocument(), {
      url: "http://localhost/",
    });

    global.window = dom.window;
    global.document = dom.window.document;
    global.navigator = dom.window.navigator;
    global.HTMLElement = dom.window.HTMLElement;
    global.Node = dom.window.Node;
    global.Event = dom.window.Event;
    global.CustomEvent = dom.window.CustomEvent;
    global.fetch = vi.fn();

    window.fetch = global.fetch;
    window.console = console;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    dom.window.close();
    delete global.window;
    delete global.document;
    delete global.navigator;
    delete global.HTMLElement;
    delete global.Node;
    delete global.Event;
    delete global.CustomEvent;
    delete global.fetch;
  });

  it("keeps the monthly payment summary in sync after repeated amount changes", async () => {
    await import("./app.js");

    const loanAmount = document.querySelector("#loan-amount");
    const summaryPayment = document.querySelector("#summary-payment");
    const summaryAmount = document.querySelector("#summary-amount");
    const readinessCard = document.querySelector("#readiness-card");

    loanAmount.value = "35000";
    loanAmount.dispatchEvent(new window.Event("input", { bubbles: true }));

    loanAmount.value = "40000";
    loanAmount.dispatchEvent(new window.Event("input", { bubbles: true }));

    loanAmount.value = "45000";
    loanAmount.dispatchEvent(new window.Event("input", { bubbles: true }));

    loanAmount.value = "50000";
    loanAmount.dispatchEvent(new window.Event("input", { bubbles: true }));

    loanAmount.value = "55000";
    loanAmount.dispatchEvent(new window.Event("input", { bubbles: true }));

    expect(summaryAmount.textContent).toBe("$55,000");
    expect(summaryPayment.textContent).toBe("$1,378");
    expect(readinessCard.classList.contains("is-stale")).toBe(false);
  });
});
