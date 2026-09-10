import { describe, it, expect, vi } from "vitest";
import { formatCurrency, getAprForAmount, calculatePayment } from "./loan-utils.js";
import { initLoanApplication } from "./loan-app.js";

class FakeClassList {
  constructor() {
    this.classNames = new Set();
  }

  add(className) {
    this.classNames.add(className);
  }

  contains(className) {
    return this.classNames.has(className);
  }
}

class FakeElement {
  constructor({ value = "", textContent = "", checked = false } = {}) {
    this.value = value;
    this.textContent = textContent;
    this.checked = checked;
    this.hidden = true;
    this.classList = new FakeClassList();
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatch(type, event = {}) {
    const listeners = this.listeners.get(type) || [];
    listeners.forEach((listener) =>
      listener({
        preventDefault() {},
        reason: undefined,
        ...event,
      })
    );
  }

  checkValidity() {
    return true;
  }

  reportValidity() {}

  scrollIntoView() {}
}

const buildTestHarness = () => {
  const selectors = {
    "#loan-amount": new FakeElement({ value: "32500" }),
    "#loan-amount-output": new FakeElement({ value: "$32,500" }),
    "#summary-amount": new FakeElement({ textContent: "$32,500" }),
    "#summary-payment": new FakeElement({ textContent: "$804" }),
    "#summary-apr": new FakeElement({ textContent: "8.74%" }),
    "#summary-term": new FakeElement({ textContent: "48 months" }),
    "#loan-purpose": new FakeElement({ value: "debt" }),
    "#consent-label": new FakeElement(),
    "#loan-form": new FakeElement(),
    "#application-error": new FakeElement(),
    "#application-success": new FakeElement(),
    "#readiness-card": new FakeElement(),
    "#first-name": new FakeElement({ value: "Jane" }),
    "#last-name": new FakeElement({ value: "Doe" }),
    "#email": new FakeElement({ value: "jane@example.com" }),
    "#phone": new FakeElement({ value: "5551234567" }),
    "#employment-status": new FakeElement({ value: "employed" }),
    "#annual-income": new FakeElement({ value: "85000" }),
  };

  const term36 = new FakeElement({ value: "36", checked: false });
  const term48 = new FakeElement({ value: "48", checked: true });
  const term60 = new FakeElement({ value: "60", checked: false });
  const loanTerms = [term36, term48, term60];

  const doc = {
    querySelector(selector) {
      if (selector === 'input[name="loanTerm"]:checked') {
        return loanTerms.find((term) => term.checked);
      }

      return selectors[selector];
    },
    querySelectorAll(selector) {
      if (selector === 'input[name="loanTerm"]') {
        return loanTerms;
      }

      return [];
    },
  };

  const windowListeners = new Map();
  const win = {
    setTimeout: vi.fn(),
    addEventListener(type, listener) {
      const listeners = windowListeners.get(type) || [];
      listeners.push(listener);
      windowListeners.set(type, listeners);
    },
  };

  return {
    doc,
    win,
    selectors,
  };
};

describe("initLoanApplication", () => {
  it("keeps recalculating the monthly payment after repeated amount changes", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { doc, win, selectors } = buildTestHarness();

    initLoanApplication({
      doc,
      win,
      fetchImpl: vi.fn(),
    });

    const loanAmount = selectors["#loan-amount"];
    const summaryPayment = selectors["#summary-payment"];
    const readinessCard = selectors["#readiness-card"];

    const changedAmounts = [35000, 40000, 45000, 50000, 55000];

    changedAmounts.forEach((amount) => {
      loanAmount.value = String(amount);
      loanAmount.dispatch("input");
    });

    const expectedPayment = formatCurrency(
      calculatePayment(55000, getAprForAmount(55000), 48)
    );

    expect(summaryPayment.textContent).toBe(expectedPayment);
    expect(readinessCard.classList.contains("is-stale")).toBe(false);

    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
