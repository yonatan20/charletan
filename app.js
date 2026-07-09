import {
  formatCurrency,
  getAprForAmount,
  calculatePayment,
  buildLoanApplicationPayload,
} from "./loan-utils.js";

const submitLoanApplication = (payload) =>
  fetch("/api/loan-applications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

export const submitLoanApplicationDemoMock = (payload) =>
  Promise.resolve({
    ok: true,
    status: 201,
    json: () =>
      Promise.resolve({
        confirmationId: "PL-" + payload.applicationSessionId.slice(-8).toUpperCase(),
      }),
  });

const logJourneyEvent = (eventName, details = {}) => {
  console.info("[CharlatanLoanJourney]", eventName, {
    timestamp: new Date().toISOString(),
    ...details,
  });
};

export const initApplication = (doc = document, options = {}) => {
  const loanAmount = doc.querySelector("#loan-amount");
  const amountOutput = doc.querySelector("#loan-amount-output");
  const summaryAmount = doc.querySelector("#summary-amount");
  const summaryPayment = doc.querySelector("#summary-payment");
  const summaryApr = doc.querySelector("#summary-apr");
  const summaryTerm = doc.querySelector("#summary-term");
  const purpose = doc.querySelector("#loan-purpose");
  const consentCheckbox = doc.querySelector("#consent");
  const consentLabel = doc.querySelector("#consent-label");
  const form = doc.querySelector("#loan-form");
  const errorBox = doc.querySelector("#application-error");
  const successBox = doc.querySelector("#application-success");
  const readinessCard = doc.querySelector("#readiness-card");
  const submitApplication = options.submitApplication ?? submitLoanApplication;

  if (
    !loanAmount ||
    !amountOutput ||
    !summaryAmount ||
    !summaryPayment ||
    !summaryApr ||
    !summaryTerm ||
    !purpose ||
    !consentCheckbox ||
    !consentLabel ||
    !form ||
    !errorBox ||
    !successBox ||
    !readinessCard
  ) {
    return;
  }

  const appState = {
    // Regression: this should be initialized when the application loads.
    applicationSession: undefined,
  };

  let amountChangeCount = 0;
  let submitAttempts = 0;
  let estimateFrozen = false;

  const getSelectedTerm = () => {
    const checked = doc.querySelector('input[name="loanTerm"]:checked');
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
    firstName: doc.querySelector("#first-name").value.trim(),
    lastName: doc.querySelector("#last-name").value.trim(),
    email: doc.querySelector("#email").value.trim(),
    phone: doc.querySelector("#phone").value.trim(),
    employmentStatus: doc.querySelector("#employment-status").value,
    annualIncome: Number(doc.querySelector("#annual-income").value || 0),
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

  doc.querySelectorAll('input[name="loanTerm"]').forEach((termInput) => {
    termInput.addEventListener("change", () => {
      updateSummary();
      logJourneyEvent("loan_term_changed", { term: getSelectedTerm() });
    });
  });

  purpose.addEventListener("change", () => {
    logJourneyEvent("loan_purpose_selected", { purpose: purpose.value });

    if (purpose.value === "home" || purpose.value === "major") {
      window.setTimeout(() => {
        console.warn("LoanPurposeWarning: purpose personalization service returned stale state", {
          selectedPurpose: purpose.value,
          impact: "Selection remains valid so applicant can continue to submit",
        });
      }, 650);
    }
  });

  consentCheckbox.addEventListener("change", () => {
    consentLabel.classList.toggle("label-clicked", consentCheckbox.checked);
    logJourneyEvent("consent_toggled", { checked: consentCheckbox.checked });
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
    errorBox.scrollIntoView({ block: "nearest", behavior: "smooth" });

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

      window.setTimeout(() => {
        throw error;
      }, 0);
      return;
    }

    submitApplication(payload)
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

  window.addEventListener("unhandledrejection", (event) => {
    console.error("Unhandled loan submission promise rejection captured", event.reason);
  });

  updateSummary();
  logJourneyEvent("application_loaded", {
    product: "personal_loan",
    prequalified: true,
  });
};

if (typeof document !== "undefined") {
  initApplication();
}
