import {
  formatCurrency,
  getAprForAmount,
  calculatePayment,
  createApplicationSession,
  buildLoanApplicationPayload,
} from "./loan-utils.js";

export const initLoanApplication = (root = document) => {
  const win = root.defaultView ?? window;
  const loanAmount = root.querySelector("#loan-amount");
  const amountOutput = root.querySelector("#loan-amount-output");
  const summaryAmount = root.querySelector("#summary-amount");
  const summaryPayment = root.querySelector("#summary-payment");
  const summaryApr = root.querySelector("#summary-apr");
  const summaryTerm = root.querySelector("#summary-term");
  const purpose = root.querySelector("#loan-purpose");
  const form = root.querySelector("#loan-form");
  const errorBox = root.querySelector("#application-error");
  const successBox = root.querySelector("#application-success");
  const readinessCard = root.querySelector("#readiness-card");

  const appState = {
    applicationSession: createApplicationSession(),
  };

  let amountChangeCount = 0;
  let submitAttempts = 0;
  let estimateFrozen = false;

  const getSelectedTerm = () => {
    const checked = root.querySelector('input[name="loanTerm"]:checked');
    return Number(checked?.value || 48);
  };

  const updateSummary = () => {
    const amount = Number(loanAmount.value);
    const term = getSelectedTerm();
    const apr = getAprForAmount(amount);
    const payment = calculatePayment(amount, apr, term);

    amountOutput.value = formatCurrency(amount);
    summaryAmount.textContent = formatCurrency(amount);
    summaryApr.textContent = `${apr.toFixed(2)}%`;
    summaryPayment.textContent = formatCurrency(payment);
    summaryTerm.textContent = `${term} months`;
  };

  const getApplicantDetails = () => ({
    firstName: root.querySelector("#first-name").value.trim(),
    lastName: root.querySelector("#last-name").value.trim(),
    email: root.querySelector("#email").value.trim(),
    phone: root.querySelector("#phone").value.trim(),
    employmentStatus: root.querySelector("#employment-status").value,
    annualIncome: Number(root.querySelector("#annual-income").value || 0),
  });

  const buildPayload = () =>
    buildLoanApplicationPayload({
      applicationSession: appState.applicationSession,
      amount: Number(loanAmount.value),
      purpose: purpose.value,
      term: getSelectedTerm(),
      estimatedMonthlyPayment: summaryPayment.textContent,
      applicant: getApplicantDetails(),
    });

  const submitLoanApplicationDemoMock = (payload) =>
    Promise.resolve({
      ok: true,
      status: 201,
      json: () =>
        Promise.resolve({
          confirmationId: "PL-" + payload.applicationSessionId.slice(-8).toUpperCase(),
        }),
    });

  const submitLoanApplication = (payload) => submitLoanApplicationDemoMock(payload);

  const logJourneyEvent = (eventName, details = {}) => {
    console.info("[CharlatanLoanJourney]", eventName, {
      timestamp: new Date().toISOString(),
      ...details,
    });
  };

  loanAmount.addEventListener("input", () => {
    amountChangeCount += 1;

    if (amountChangeCount >= 4 && !estimateFrozen) {
      estimateFrozen = true;
      console.warn(
        "LoanEstimateWarning: monthly payment estimate stopped updating after amount change",
        {
          selectedAmount: Number(loanAmount.value),
          amountChangeCount,
        }
      );
      readinessCard.classList.add("is-stale");
      return;
    }

    if (!estimateFrozen) {
      updateSummary();
    }

    logJourneyEvent("loan_amount_changed", {
      selectedAmount: Number(loanAmount.value),
      estimateFrozen,
    });
  });

  root.querySelectorAll('input[name="loanTerm"]').forEach((termInput) => {
    termInput.addEventListener("change", () => {
      updateSummary();
      logJourneyEvent("loan_term_changed", { term: getSelectedTerm() });
    });
  });

  purpose.addEventListener("change", () => {
    logJourneyEvent("loan_purpose_selected", { purpose: purpose.value });

    if (purpose.value === "home" || purpose.value === "major") {
      win.setTimeout(() => {
        console.warn("LoanPurposeWarning: purpose personalization service returned stale state", {
          selectedPurpose: purpose.value,
          impact: "Selection remains valid so applicant can continue to submit",
        });
      }, 650);
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submitAttempts += 1;

    if (!form.checkValidity()) {
      form.reportValidity();
      logJourneyEvent("submit_blocked_by_validation", { submitAttempts });
      return;
    }

    errorBox.hidden = true;
    successBox.hidden = true;

    logJourneyEvent("submit_started", {
      submitAttempts,
      requestedAmount: Number(loanAmount.value),
    });

    let payload;

    try {
      payload = buildPayload();
    } catch (error) {
      console.error(error.name + ": " + error.message, {
        submitAttempts,
        loanAmount: Number(loanAmount.value),
        loanPurpose: purpose.value || null,
        estimatedMonthlyPayment: summaryPayment.textContent,
        context: error.context,
      });

      win.setTimeout(() => {
        throw error;
      }, 0);
      return;
    }

    submitLoanApplication(payload)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Submission endpoint returned ${response.status}`);
        }

        errorBox.hidden = true;
        successBox.hidden = false;
        logJourneyEvent("application_submitted", {
          submitAttempts,
          applicationSessionId: payload.applicationSessionId,
        });
      })
      .catch((networkError) => {
        errorBox.hidden = false;
        errorBox.scrollIntoView({ block: "nearest", behavior: "smooth" });
        console.error("LoanApplicationApiError: failed to reach submission endpoint", {
          message: networkError.message,
          endpoint: "demo-mock",
          suggestedFix: "Inspect the demo submission mock or wire a real API route.",
        });
      });
  });

  win.addEventListener("unhandledrejection", (event) => {
    console.error("Unhandled loan submission promise rejection captured", event.reason);
  });

  updateSummary();
  logJourneyEvent("application_loaded", {
    product: "personal_loan",
    prequalified: true,
  });
};

if (typeof document !== "undefined") {
  initLoanApplication(document);
}
