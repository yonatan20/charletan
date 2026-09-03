import { beforeEach, describe, expect, it, vi } from "vitest";
import { initializeApplication } from "./app.js";
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
  constructor({ value = "", textContent = "", name = "", checked = false } = {}) {
    this.value = value;
    this.textContent = textContent;
    this.name = name;
    this.checked = checked;
    this.hidden = false;
    this.classList = new FakeClassList();
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatchEvent(event) {
    const listeners = this.listeners.get(event.type) ?? [];
    listeners.forEach((listener) => listener(event));
  }

  checkValidity() {
    return true;
  }

  reportValidity() {}

  scrollIntoView() {}
}

const buildTestDocument = () => {
  const elements = {
    "#loan-amount": new FakeElement({ value: "32500" }),
    "#loan-amount-output": new FakeElement(),
    "#summary-amount": new FakeElement({ textContent: "$32,500" }),
    "#summary-payment": new FakeElement({ textContent: "$805" }),
    "#summary-apr": new FakeElement({ textContent: "8.74%" }),
    "#summary-term": new FakeElement({ textContent: "48 months" }),
    "#loan-purpose": new FakeElement(),
    "#consent-label": new FakeElement(),
    "#loan-form": new FakeElement(),
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

  const loanTerms = [
    new FakeElement({ value: "36", name: "loanTerm", checked: false }),
    new FakeElement({ value: "48", name: "loanTerm", checked: true }),
    new FakeElement({ value: "60", name: "loanTerm", checked: false }),
  ];

  return {
    querySelector(selector) {
      if (selector === 'input[name="loanTerm"]:checked') {
        return loanTerms.find((term) => term.checked);
      }

      return elements[selector] ?? null;
    },
    querySelectorAll(selector) {
      if (selector === 'input[name="loanTerm"]') {
        return loanTerms;
      }

      return [];
    },
    elements,
    loanTerms,
  };
};

describe("initializeApplication", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("keeps the monthly payment estimate in sync across repeated amount changes", () => {
    const document = buildTestDocument();
    const window = {
      setTimeout: vi.fn(),
      addEventListener: vi.fn(),
    };

    initializeApplication({
      document,
      window,
      fetchImpl: vi.fn(),
    });

    const slider = document.elements["#loan-amount"];
    const payment = document.elements["#summary-payment"];
    const readinessCard = document.elements["#readiness-card"];

    readinessCard.classList.add("is-stale");

    [33000, 33500, 34000, 34500, 35000].forEach((amount) => {
      slider.value = String(amount);
      slider.dispatchEvent({ type: "input" });
    });

    const expectedPayment = formatCurrency(
      calculatePayment(35000, getAprForAmount(35000), 48)
    );

    expect(payment.textContent).toBe(expectedPayment);
    expect(readinessCard.classList.contains("is-stale")).toBe(false);
  });
});
