import { describe, it, expect, vi } from "vitest";
import { initApplication } from "./app.js";
import { calculatePayment, formatCurrency, getAprForAmount } from "./loan-utils.js";

const createClassList = (initialClasses = []) => {
  const classes = new Set(initialClasses);

  return {
    add: (className) => classes.add(className),
    remove: (className) => classes.delete(className),
    contains: (className) => classes.has(className),
  };
};

const createElement = (overrides = {}) => {
  const listeners = new Map();

  return {
    value: "",
    textContent: "",
    hidden: true,
    checked: false,
    classList: createClassList(),
    addEventListener: (eventName, listener) => {
      listeners.set(eventName, listener);
    },
    dispatch: (eventName, event = {}) => {
      const listener = listeners.get(eventName);
      if (listener) {
        listener({ preventDefault() {}, ...event });
      }
    },
    checkValidity: () => true,
    reportValidity: () => {},
    scrollIntoView: () => {},
    ...overrides,
  };
};

const createTestDocument = () => {
  const term36 = createElement({ value: "36", checked: false });
  const term48 = createElement({ value: "48", checked: true });
  const term60 = createElement({ value: "60", checked: false });
  const terms = [term36, term48, term60];

  const elements = {
    "#loan-amount": createElement({ value: "32500" }),
    "#loan-amount-output": createElement(),
    "#summary-amount": createElement(),
    "#summary-payment": createElement(),
    "#summary-apr": createElement(),
    "#summary-term": createElement(),
    "#loan-purpose": createElement({ value: "" }),
    "#consent-label": createElement(),
    "#loan-form": createElement(),
    "#application-error": createElement(),
    "#application-success": createElement(),
    "#readiness-card": createElement(),
    "#first-name": createElement({ value: "Jane" }),
    "#last-name": createElement({ value: "Doe" }),
    "#email": createElement({ value: "jane@example.com" }),
    "#phone": createElement({ value: "5551234567" }),
    "#employment-status": createElement({ value: "employed" }),
    "#annual-income": createElement({ value: "85000" }),
  };

  return {
    elements,
    documentRef: {
      querySelector: (selector) => {
        if (selector === 'input[name="loanTerm"]:checked') {
          return terms.find((term) => term.checked);
        }

        return elements[selector];
      },
      querySelectorAll: (selector) => {
        if (selector === 'input[name="loanTerm"]') {
          return terms;
        }

        return [];
      },
    },
  };
};

describe("initApplication", () => {
  it("keeps the monthly payment estimate in sync across repeated amount changes", () => {
    const { elements, documentRef } = createTestDocument();
    const windowRef = {
      setTimeout: vi.fn(),
      addEventListener: vi.fn(),
    };

    initApplication({
      documentRef,
      windowRef,
      fetchImpl: vi.fn(),
    });

    const loanAmount = elements["#loan-amount"];
    const summaryAmount = elements["#summary-amount"];
    const summaryPayment = elements["#summary-payment"];
    const readinessCard = elements["#readiness-card"];

    readinessCard.classList.add("is-stale");

    for (const amount of [33000, 33500, 34000, 34500, 35000]) {
      loanAmount.value = String(amount);
      loanAmount.dispatch("input");
    }

    const expectedPayment = formatCurrency(calculatePayment(35000, getAprForAmount(35000), 48));

    expect(summaryAmount.textContent).toBe("$35,000");
    expect(summaryPayment.textContent).toBe(expectedPayment);
    expect(readinessCard.classList.contains("is-stale")).toBe(false);
  });
});
