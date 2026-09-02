import {
  formatCurrency,
  getAprForAmount,
  calculatePayment,
  createApplicationSession,
  buildLoanApplicationPayload,
} from "./loan-utils.js";

const submitLoanApplication = (payload) =>
  fetch("/api/loan-applications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

export const initializeLoanApplication = ({
  rootDocument = document,
  rootWindow = window,
  submitLoanApplicationImpl = submitLoanApplication,
} = {}) => {
  const loanAmount = rootDocument.querySelector("#loan-amount");
  const amountOutput = rootDocument.querySelector("#loan-amount-output");
  const summaryAmount = rootDocument.querySelector("#summary-amount");
  const summaryPayment = rootDocument.querySelector("#summary-payment");
  const summaryApr = rootDocument.querySelector("#summary-apr");
  const summaryTerm = rootDocument.querySelector("#summary-term");
  const purpose = rootDocument.querySelector("#loan-purpose");
  const form = rootDocument.querySelector("#loan-form");
  const errorBox = rootDocument.querySelector("#application-error");
  const successBox = rootDocument.querySelector("#application-success");
  const readinessCard = rootDocument.querySelector("#readiness-card");

  if (
    !loanAmount ||
    !amountOutput ||
    !summaryAmount ||
    !summaryPayment ||
    !summaryApr ||
    !summaryTerm ||
    !purpose ||
    !form ||
    !errorBox ||
    !successBox ||
    !readinessCard
  ) {
    return null;
  }

  const appState = {
    applicationSession: createApplicationSession(),
  };

  let amountChangeCount = 0;
  let submitAttempts = 0;
  let estimateFrozen = false;

  const getSelectedTerm = () => {
    const checked = rootDocument.querySelector('input[name="loanTerm"]:checked');
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
    firstName: rootDocument.querySelector("#first-name").value.trim(),
    lastName: rootDocument.querySelector("#last-name").value.trim(),
    email: rootDocument.querySelector("#email").value.trim(),
    phone: rootDocument.querySelector("#phone").value.trim(),
    employmentStatus: rootDocument.querySelector("#employment-status").value,
    annualIncome: Number(rootDocument.querySelector("#annual-income").value || 0),
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

  rootDocument.querySelectorAll('input[name="loanTerm"]').forEach((termInput) => {
    termInput.addEventListener("change", () => {
      updateSummary();
      logJourneyEvent("loan_term_changed", { term: getSelectedTerm() });
    });
  });

  purpose.addEventListener("change", () => {
    logJourneyEvent("loan_purpose_selected", { purpose: purpose.value });

    if (purpose.value === "home" || purpose.value === "major") {
      rootWindow.setTimeout(() => {
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

    errorBox.hidden = false;
    successBox.hidden = true;
    errorBox.scrollIntoView?.({ block: "nearest", behavior: "smooth" });

    console.error("Potential lost conversion", {
      product: "personal_loan",
      submitAttempts,
      requestedAmount: Number(loanAmount.value),
      businessImpact: "qualified borrower could not submit application",
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

      rootWindow.setTimeout(() => {
        throw error;
      }, 0);
      return;
    }

    submitLoanApplicationImpl(payload)
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
        console.error("LoanApplicationApiError: failed to reach submission endpoint", {
          message: networkError.message,
          endpoint: "/api/loan-applications",
          suggestedFix: "Use the existing static-demo submission mock or add a real API route.",
        });
      });
  });

  rootWindow.addEventListener("unhandledrejection", (event) => {
    console.error("Unhandled loan submission promise rejection captured", event.reason);
  });

  updateSummary();
  logJourneyEvent("application_loaded", {
    product: "personal_loan",
    prequalified: true,
    applicationSessionId: appState.applicationSession.id,
  });

  return { appState };
};

if (typeof document !== "undefined") {
  initializeLoanApplication();
}
