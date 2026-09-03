import { describe, it, expect, vi } from "vitest";
import { initPersonalLoanApplication } from "./app.js";
import { calculatePayment, formatCurrency, getAprForAmount } from "./loan-utils.js";

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  add(name) {
    this.values.add(name);
  }

  remove(name) {
    this.values.delete(name);
  }

  contains(name) {
    return this.values.has(name);
  }
}

class FakeElement {
  constructor({ value = "", textContent = "", hidden = false, checked = false } = {}) {
    this.value = value;
    this.textContent = textContent;
    this.hidden = hidden;
    this.checked = checked;
    this.classList = new FakeClassList();
    this.listeners = new Map();
  }

  addEventListener(type, handler) {
    const handlers = this.listeners.get(type) || [];
    handlers.push(handler);
    this.listeners.set(type, handlers);
  }

  dispatch(type, event = {}) {
    const handlers = this.listeners.get(type) || [];
    const fullEvent = {
      type,
      preventDefault() {},
      ...event,
    };

    handlers.forEach((handler) => handler(fullEvent));
  }

  checkValidity() {
    return true;
  }

  reportValidity() {}

  scrollIntoView() {}
}

const buildHarness = () => {
  const term36 = new FakeElement({ value: "36", checked: false });
  const term48 = new FakeElement({ value: "48", checked: true });
  const term60 = new FakeElement({ value: "60", checked: false });
  const termInputs = [term36, term48, term60];

  const elements = {
    "#loan-amount": new FakeElement({ value: "32500" }),
    "#loan-amount-output": new FakeElement({ value: "$32,500" }),
    "#summary-amount": new FakeElement({ textContent: "$32,500" }),
    "#summary-payment": new FakeElement({ textContent: "$804" }),
    "#summary-apr": new FakeElement({ textContent: "8.74%" }),
    "#summary-term": new FakeElement({ textContent: "48 months" }),
    "#loan-purpose": new FakeElement({ value: "debt" }),
    "#consent-label": new FakeElement(),
    "#loan-form": new FakeElement(),
    "#application-error": new FakeElement({ hidden: true }),
    "#application-success": new FakeElement({ hidden: true }),
    "#readiness-card": new FakeElement(),
    "#first-name": new FakeElement(),
    "#last-name": new FakeElement(),
    "#email": new FakeElement(),
    "#phone": new FakeElement(),
    "#employment-status": new FakeElement(),
    "#annual-income": new FakeElement(),
  };

  const fakeDocument = {
    querySelector(selector) {
      if (selector === 'input[name="loanTerm"]:checked') {
        return termInputs.find((input) => input.checked);
      }

      return elements[selector] || null;
    },
    querySelectorAll(selector) {
      if (selector === 'input[name="loanTerm"]') {
        return termInputs;
      }

      return [];
    },
  };

  const fakeWindow = {
    setTimeout(callback) {
      callback();
      return 0;
    },
    addEventListener() {},
  };

  return { elements, fakeDocument, fakeWindow };
};

describe("initPersonalLoanApplication", () => {
  it("keeps the monthly payment estimate in sync across repeated amount changes", () => {
    const { elements, fakeDocument, fakeWindow } = buildHarness();
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    initPersonalLoanApplication({
      document: fakeDocument,
      window: fakeWindow,
      fetchImpl: vi.fn(),
      logger,
    });

    const loanAmount = elements["#loan-amount"];
    const summaryPayment = elements["#summary-payment"];
    const readinessCard = elements["#readiness-card"];

    ["33000", "34000", "35000", "36000"].forEach((value) => {
      loanAmount.value = value;
      loanAmount.dispatch("input");
    });

    const expectedPayment = formatCurrency(
      calculatePayment(36000, getAprForAmount(36000), 48)
    );

    expect(summaryPayment.textContent).toBe(expectedPayment);
    expect(readinessCard.classList.contains("is-stale")).toBe(false);
    expect(logger.warn).not.toHaveBeenCalledWith(
      "LoanEstimateWarning: monthly payment estimate stopped updating after amount change",
      expect.anything()
    );
  });
});
