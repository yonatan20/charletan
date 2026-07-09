import { afterEach, describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { initApplication } from "./app.js";

const buildTestDocument = () =>
  new JSDOM(`<!DOCTYPE html>
    <html lang="en">
      <body>
        <form id="loan-form" novalidate>
          <input id="loan-amount" value="32500" />
          <output id="loan-amount-output"></output>
          <div id="summary-amount"></div>
          <div id="summary-payment"></div>
          <div id="summary-apr"></div>
          <div id="summary-term"></div>
          <select id="loan-purpose">
            <option value="">Choose a purpose</option>
            <option value="debt">Debt consolidation</option>
          </select>
          <input id="first-name" value="Jane" />
          <input id="last-name" value="Doe" />
          <input id="email" value="jane@example.com" />
          <input id="phone" value="5551234567" />
          <select id="employment-status">
            <option value="employed" selected>Employed full time</option>
          </select>
          <input id="annual-income" value="85000" />
          <label>
            <input id="consent" name="consent" type="checkbox" />
          </label>
          <label for="consent" id="consent-label" class="consent-label">
            I agree to receive application updates and authorize Charlatan Bank
            to verify my information.
          </label>
          <label>
            <input type="radio" name="loanTerm" value="48" checked />
            <span>48 months</span>
          </label>
          <button id="submit-application" type="submit">Submit application</button>
          <div id="application-error" hidden></div>
          <div id="application-success" hidden></div>
          <div id="readiness-card"></div>
        </form>
      </body>
    </html>`);

describe("initApplication consent interactions", () => {
  afterEach(() => {
    delete global.window;
    delete global.document;
  });

  it("toggles the consent checkbox when the visible consent text is clicked", () => {
    const dom = buildTestDocument();
    global.window = dom.window;
    global.document = dom.window.document;

    initApplication(dom.window.document);

    const consentCheckbox = dom.window.document.querySelector("#consent");
    const consentLabel = dom.window.document.querySelector("#consent-label");

    expect(consentCheckbox.checked).toBe(false);
    expect(consentLabel.classList.contains("label-clicked")).toBe(false);

    consentLabel.click();

    expect(consentCheckbox.checked).toBe(true);
    expect(consentLabel.classList.contains("label-clicked")).toBe(true);
  });
});
