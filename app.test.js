import { beforeEach, describe, expect, it, vi } from "vitest";
import { calculatePayment, formatCurrency, getAprForAmount } from "./loan-utils.js";

class FakeClassList {
  constructor() {
    this.classes = new Set();
  }

  add(...names) {
    names.forEach((name) => this.classes.add(name));
  }

  contains(name) {
    return this.classes.has(name);
  }
}

class FakeElement {
  constructor({ value = "", textContent = "", checked = false } = {}) {
    this.value = value;
    this.textContent = textContent;
    this.checked = checked;
    this.hidden = true;
    this.listeners = new Map();
    this.classList = new FakeClassList();
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }

    this.listeners.get(type).push(handler);
  }

  dispatch(type, event = {}) {
    const handlers = this.listeners.get(type) || [];
    handlers.forEach((handler) => handler({ target: this, ...event }));
  }

  scrollIntoView() {}

  checkValidity() {
    return true;
  }

  reportValidity() {}
}

const buildEnvironment = () => {
  const loanAmount = new FakeElement({ value: "32500" });
  const amountOutput = new FakeElement({ value: "$32,500" });
  const summaryAmount = new FakeElement({ textContent: "$32,500" });
  const summaryPayment = new FakeElement({ textContent: "$804" });
  const summaryApr = new FakeElement({ textContent: "8.74%" });
  const summaryTerm = new FakeElement({ textContent: "48 months" });
  const purpose = new FakeElement({ value: "debt" });
  const consentLabel = new FakeElement();
  const form = new FakeElement();
  const errorBox = new FakeElement();
  const successBox = new FakeElement();
  const readinessCard = new FakeElement();

  const firstName = new FakeElement({ value: "Jane" });
  const lastName = new FakeElement({ value: "Doe" });
  const email = new FakeElement({ value: "jane@example.com" });
  const phone = new FakeElement({ value: "5551234567" });
  const employmentStatus = new FakeElement({ value: "employed" });
  const annualIncome = new FakeElement({ value: "85000" });

  const term36 = new FakeElement({ value: "36", checked: false });
  const term48 = new FakeElement({ value: "48", checked: true });
  const term60 = new FakeElement({ value: "60", checked: false });
  const termInputs = [term36, term48, term60];

  const selectors = new Map([
    ["#loan-amount", loanAmount],
    ["#loan-amount-output", amountOutput],
    ["#summary-amount", summaryAmount],
    ["#summary-payment", summaryPayment],
    ["#summary-apr", summaryApr],
    ["#summary-term", summaryTerm],
    ["#loan-purpose", purpose],
    ["#consent-label", consentLabel],
    ["#loan-form", form],
    ["#application-error", errorBox],
    ["#application-success", successBox],
    ["#readiness-card", readinessCard],
    ["#first-name", firstName],
    ["#last-name", lastName],
    ["#email", email],
    ["#phone", phone],
    ["#employment-status", employmentStatus],
    ["#annual-income", annualIncome],
  ]);

  const document = {
    querySelector(selector) {
      if (selector === 'input[name="loanTerm"]:checked') {
        return termInputs.find((input) => input.checked);
      }

      return selectors.get(selector);
    },
    querySelectorAll(selector) {
      if (selector === 'input[name="loanTerm"]') {
        return termInputs;
      }

      return [];
    },
  };

  const window = {
    setTimeout: vi.fn(),
    addEventListener: vi.fn(),
  };

  return {
    loanAmount,
    summaryAmount,
    summaryPayment,
    summaryApr,
    summaryTerm,
    readinessCard,
    document,
    window,
  };
};

describe("loan amount updates", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("keeps the monthly payment estimate in sync after repeated amount changes", async () => {
    const env = buildEnvironment();

    vi.stubGlobal("document", env.document);
    vi.stubGlobal("window", env.window);
    vi.stubGlobal("fetch", vi.fn());
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    await import("./app.js");

    ["35000", "40000", "45500", "50000", "62500"].forEach((value) => {
      env.loanAmount.value = value;
      env.loanAmount.dispatch("input");
    });

    const finalAmount = 62500;
    const finalApr = getAprForAmount(finalAmount);
    const finalPayment = calculatePayment(finalAmount, finalApr, 48);

    expect(env.summaryAmount.textContent).toBe(formatCurrency(finalAmount));
    expect(env.summaryApr.textContent).toBe(`${finalApr.toFixed(2)}%`);
    expect(env.summaryPayment.textContent).toBe(formatCurrency(finalPayment));
    expect(env.summaryTerm.textContent).toBe("48 months");
    expect(env.readinessCard.classList.contains("is-stale")).toBe(false);
  });
});
