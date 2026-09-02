import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { calculatePayment, formatCurrency, getAprForAmount } from "./loan-utils.js";

class FakeClassList {
  constructor() {
    this.classes = new Set();
  }

  add(...classNames) {
    classNames.forEach((className) => this.classes.add(className));
  }

  remove(...classNames) {
    classNames.forEach((className) => this.classes.delete(className));
  }

  contains(className) {
    return this.classes.has(className);
  }
}

class FakeElement {
  constructor({ value = "", checked = false } = {}) {
    this.value = value;
    this.checked = checked;
    this.textContent = "";
    this.hidden = true;
    this.classList = new FakeClassList();
    this.listeners = new Map();
  }

  addEventListener(type, callback) {
    const callbacks = this.listeners.get(type) || [];
    callbacks.push(callback);
    this.listeners.set(type, callbacks);
  }

  dispatch(type, event = {}) {
    const callbacks = this.listeners.get(type) || [];
    callbacks.forEach((callback) => callback(event));
  }

  scrollIntoView() {}
}

class FakeFormElement extends FakeElement {
  checkValidity() {
    return true;
  }

  reportValidity() {
    return true;
  }
}

const buildDocument = () => {
  const term36 = new FakeElement({ value: "36", checked: false });
  const term48 = new FakeElement({ value: "48", checked: true });
  const term60 = new FakeElement({ value: "60", checked: false });
  const termInputs = [term36, term48, term60];

  const elements = {
    "#loan-amount": new FakeElement({ value: "32500" }),
    "#loan-amount-output": new FakeElement(),
    "#summary-amount": new FakeElement(),
    "#summary-payment": new FakeElement(),
    "#summary-apr": new FakeElement(),
    "#summary-term": new FakeElement(),
    "#loan-purpose": new FakeElement(),
    "#consent-label": new FakeElement(),
    "#loan-form": new FakeFormElement(),
    "#application-error": new FakeElement(),
    "#application-success": new FakeElement(),
    "#readiness-card": new FakeElement(),
    "#first-name": new FakeElement(),
    "#last-name": new FakeElement(),
    "#email": new FakeElement(),
    "#phone": new FakeElement(),
    "#employment-status": new FakeElement(),
    "#annual-income": new FakeElement(),
  };

  return {
    elements,
    termInputs,
    querySelector(selector) {
      if (selector === 'input[name="loanTerm"]:checked') {
        return termInputs.find((input) => input.checked) || null;
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
};

describe("loan amount estimate updates", () => {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const originalFetch = globalThis.fetch;
  const originalConsole = globalThis.console;

  beforeEach(() => {
    vi.resetModules();

    const document = buildDocument();

    globalThis.document = document;
    globalThis.window = {
      addEventListener: vi.fn(),
      setTimeout,
    };
    globalThis.fetch = vi.fn();
    globalThis.console = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
  });

  afterEach(() => {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
    globalThis.fetch = originalFetch;
    globalThis.console = originalConsole;
  });

  it("keeps the monthly payment estimate in sync after repeated amount changes", async () => {
    await import("./app.js");

    const loanAmount = document.querySelector("#loan-amount");
    const summaryPayment = document.querySelector("#summary-payment");
    const summaryAmount = document.querySelector("#summary-amount");
    const readinessCard = document.querySelector("#readiness-card");

    ["33500", "34000", "34500", "35000", "35500"].forEach((nextAmount) => {
      loanAmount.value = nextAmount;
      loanAmount.dispatch("input");
    });

    const expectedPayment = formatCurrency(
      calculatePayment(35500, getAprForAmount(35500), 48)
    );

    expect(summaryAmount.textContent).toBe("$35,500");
    expect(summaryPayment.textContent).toBe(expectedPayment);
    expect(readinessCard.classList.contains("is-stale")).toBe(false);
  });
});
