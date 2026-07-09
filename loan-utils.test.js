import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import {
  LoanSubmissionError,
  formatCurrency,
  getAprForAmount,
  calculatePayment,
  createApplicationSession,
  buildLoanApplicationPayload,
} from "./loan-utils.js";

const fixturePath = (relativePath) =>
  fileURLToPath(new URL(relativePath, import.meta.url));

describe("formatCurrency", () => {
  it("formats whole-dollar amounts in USD", () => {
    expect(formatCurrency(32500)).toBe("$32,500");
    expect(formatCurrency(5000)).toBe("$5,000");
    expect(formatCurrency(75000)).toBe("$75,000");
  });
});

describe("getAprForAmount", () => {
  it("returns the lowest tier APR for amounts up to $25,000", () => {
    expect(getAprForAmount(5000)).toBe(7.89);
    expect(getAprForAmount(25000)).toBe(7.89);
  });

  it("returns the middle tier APR for amounts above $25,000 up to $50,000", () => {
    expect(getAprForAmount(25001)).toBe(8.74);
    expect(getAprForAmount(32500)).toBe(8.74);
    expect(getAprForAmount(50000)).toBe(8.74);
  });

  it("returns the highest tier APR for amounts above $50,000", () => {
    expect(getAprForAmount(50001)).toBe(9.34);
    expect(getAprForAmount(75000)).toBe(9.34);
  });
});

describe("calculatePayment", () => {
  it("computes the monthly payment for a standard loan", () => {
    const payment = calculatePayment(32500, 8.74, 48);
    expect(payment).toBeCloseTo(804.76, 1);
    expect(formatCurrency(payment)).toBe("$805");
  });

  it("returns a higher payment for shorter terms", () => {
    const payment48 = calculatePayment(32500, 8.74, 48);
    const payment36 = calculatePayment(32500, 8.74, 36);
    expect(payment36).toBeGreaterThan(payment48);
  });
});

describe("createApplicationSession", () => {
  it("creates a session with a prefixed id and ISO timestamp", () => {
    const session = createApplicationSession();

    expect(session.id).toMatch(/^loan-session-[a-z0-9]+$/);
    expect(() => new Date(session.createdAt)).not.toThrow();
    expect(new Date(session.createdAt).toISOString()).toBe(session.createdAt);
  });
});

describe("buildLoanApplicationPayload", () => {
  const applicant = {
    firstName: "Jane",
    lastName: "Doe",
    email: "jane@example.com",
    phone: "5551234567",
    employmentStatus: "employed",
    annualIncome: 85000,
  };

  it("builds a complete payload when the session is initialized", () => {
    const session = { id: "loan-session-abc123", createdAt: "2026-01-01T00:00:00.000Z" };

    const payload = buildLoanApplicationPayload({
      applicationSession: session,
      amount: 32500,
      purpose: "debt",
      term: 48,
      estimatedMonthlyPayment: "$804",
      applicant,
    });

    expect(payload).toEqual({
      applicationSessionId: "loan-session-abc123",
      amount: 32500,
      purpose: "debt",
      term: 48,
      estimatedMonthlyPayment: "$804",
      applicant,
    });
  });

  it("throws LoanSubmissionError when applicationSession is missing", () => {
    expect(() =>
      buildLoanApplicationPayload({
        applicationSession: undefined,
        amount: 32500,
        purpose: "debt",
        term: 48,
        estimatedMonthlyPayment: "$804",
        applicant,
      })
    ).toThrow(LoanSubmissionError);

    try {
      buildLoanApplicationPayload({
        applicationSession: undefined,
        amount: 32500,
        purpose: "debt",
        term: 48,
        estimatedMonthlyPayment: "$804",
        applicant,
      });
    } catch (error) {
      expect(error.message).toBe("applicationSessionId is undefined");
      expect(error.context).toEqual({
        reason: "appState.applicationSession was not initialized",
        expectedStateShape: "{ applicationSession: { id: string } }",
      });
    }
  });
});

describe("consent checkbox markup", () => {
  it("associates the consent copy with the checkbox using a real label", () => {
    const html = readFileSync(fixturePath("./index.html"), "utf8");

    expect(html).toContain('<input id="consent" name="consent" type="checkbox" required />');
    expect(html).toContain('<label id="consent-label" class="consent-label" for="consent">');
  });

  it("does not keep the broken consent click warning handler", () => {
    const appSource = readFileSync(fixturePath("./app.js"), "utf8");

    expect(appSource).not.toContain("ConsentClickWarning");
    expect(appSource).not.toContain('querySelector("#consent-label")');
  });
});
